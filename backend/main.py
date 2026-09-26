import asyncio
import base64
import binascii
import io
import json
import logging
import os
import re
import time
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from google import genai
from google.genai import types
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel

import aem
from mock_data import DEFAULT_MOCK, MOCK_PAGES
from prompts import (
    APPLY_PROMPT,
    BOLD_REWRITE_PROMPT,
    BRAND_GUIDELINES,
    IMAGE_PROMPT_GENERATOR,
    IMAGE_VARIANT_STYLES,
    SAFE_REFRESH_PROMPT,
    SEO_OPTIMIZED_PROMPT,
    SUGGEST_PROMPT,
)

load_dotenv()

log = logging.getLogger("uvicorn.error")

MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.8-flash")
IMAGE_MODEL = os.environ.get("GEMINI_IMAGE_MODEL", "gemini-3.1-flash-lite-image")
client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

STATIC_DIR = Path(__file__).parent / "static"
GENERATED_DIR = STATIC_DIR / "generated"
GENERATED_DIR.mkdir(parents=True, exist_ok=True)
(STATIC_DIR / "mock-images").mkdir(parents=True, exist_ok=True)

app = FastAPI(title="AEM Content Refresh Copilot")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

origins = ["http://localhost:5173"]
if os.environ.get("FRONTEND_URL"):
    origins.append(os.environ["FRONTEND_URL"].rstrip("/"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


def fill(template: str, **values: str) -> str:
    """Fill {placeholders} via replace so braces in user content are safe."""
    for key, value in values.items():
        template = template.replace("{" + key + "}", value)
    return template


GEMINI_SLOTS = asyncio.Semaphore(8)  # cap concurrent Gemini calls so a big page doesn't trip rate limits
_TRANSIENT = ("429", "500", "503", "UNAVAILABLE", "RESOURCE_EXHAUSTED")


async def _with_retry(fn, *args):
    """Run a blocking Gemini call in a thread; retry twice on rate-limit / overload errors."""
    for attempt in range(3):
        try:
            async with GEMINI_SLOTS:
                return await asyncio.to_thread(fn, *args)
        except Exception as e:
            if attempt == 2 or not any(t in str(e) for t in _TRANSIENT):
                raise
            await asyncio.sleep(2 * (attempt + 1))


def _call_text(prompt: str, model: str) -> str:
    if "omni" in model:  # Omni models only speak the Interactions API
        result = client.interactions.create(model=model, input=prompt)
        if result.errors:
            raise ValueError(f"{model}: {result.errors}")
        return result.output_text or ""
    return client.models.generate_content(model=model, contents=prompt).text or ""


async def gemini_text(prompt: str, model: str | None = None) -> str:
    return (await _with_retry(_call_text, prompt, model or MODEL)).strip()


def strip_fences(text: str) -> str:
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    return text


# ---------- fetch-page ----------

@app.get("/api/fetch-page")
async def fetch_page(path: str):
    path = path.strip().rstrip("/")
    if aem.AEM_ENABLED:
        try:
            return await aem.fetch_from_aem(path)
        except aem.AemError as e:
            raise HTTPException(status_code=e.status, detail=e.message)
    page = MOCK_PAGES.get(path)
    if page is None:
        page = {**DEFAULT_MOCK, "pagePath": path}
    return page


# ---------- text variants: 3 strategies / models per component ----------

class GenerateComponent(BaseModel):
    id: str
    type: str
    currentContent: str


class GenerateRequest(BaseModel):
    components: list[GenerateComponent]


TEXT_VARIANTS = [
    {
        "variantId": "safe",
        "label": "Safe Refresh",
        "model": os.environ.get("GEMINI_MODEL_SAFE", MODEL),
        "color": "green",
        "prompt": SAFE_REFRESH_PROMPT,
    },
    {
        "variantId": "bold",
        "label": "Bold Rewrite",
        "model": os.environ.get("GEMINI_MODEL_BOLD", "gemini-omni-1.1-flash"),
        "color": "violet",
        "prompt": BOLD_REWRITE_PROMPT,
    },
    {
        "variantId": "seo",
        "label": "SEO Optimized",
        "model": os.environ.get("GEMINI_MODEL_SEO", MODEL),
        "color": "blue",
        "prompt": SEO_OPTIMIZED_PROMPT,
    },
]


async def generate_text_variant(cfg: dict, comp: GenerateComponent) -> dict:
    prompt = fill(
        cfg["prompt"],
        brand_guidelines=BRAND_GUIDELINES,
        component_type=comp.type,
        current_content=comp.currentContent,
    )
    variant = {k: cfg[k] for k in ("variantId", "label", "model", "color")}
    try:
        try:
            text = strip_fences(await gemini_text(prompt, cfg["model"]))
        except Exception as e:
            if cfg["model"] == MODEL:
                raise
            # A non-default model (e.g. Omni) is down: fall back so the card isn't empty.
            log.warning("%s failed for %s (%s); falling back to %s", cfg["model"], comp.id, e, MODEL)
            text = strip_fences(await gemini_text(prompt, MODEL))
            variant["model"] = MODEL
            variant["fallbackFrom"] = cfg["model"]
        if not text:
            raise ValueError("empty response")
        variant["generatedContent"] = text
    except Exception as e:
        log.warning("%s variant failed for %s: %s", cfg["variantId"], comp.id, e)
        variant["generatedContent"] = None
        variant["error"] = str(e)[:200]
    return variant


@app.post("/api/generate-text-variants")
async def generate_text_variants(req: GenerateRequest):
    """components x 3 variants, all in parallel."""

    async def one(comp: GenerateComponent) -> dict:
        variants = await asyncio.gather(*(generate_text_variant(cfg, comp) for cfg in TEXT_VARIANTS))
        return {"id": comp.id, "variants": list(variants)}

    return {"results": await asyncio.gather(*(one(c) for c in req.components))}


# ---------- image variants: 3 visual styles per component ----------

IMAGE_VARIANTS = [
    ("product", "Product Focus", "green"),
    ("lifestyle", "Lifestyle", "violet"),
    ("editorial", "Editorial", "blue"),
]


class GenerateImageComponent(BaseModel):
    id: str
    imageContext: str = ""
    altText: str = ""


class GenerateImageVariantsRequest(BaseModel):
    components: list[GenerateImageComponent]


def _safe_id(component_id: str) -> str:
    return re.sub(r"[^\w-]", "_", component_id)[:40] or "img"


def _new_image_path(component_id: str, prefix: str = "") -> Path:
    return GENERATED_DIR / f"{prefix}{_safe_id(component_id)}_{time.time_ns() // 1_000_000}.png"


async def build_image_prompt(image_context: str, alt_text: str, style_instruction: str) -> str:
    prompt = fill(
        IMAGE_PROMPT_GENERATOR,
        image_context=image_context or "Image on a product page",
        alt_text=alt_text or "none",
        style_instruction=style_instruction,
    )
    text = (await gemini_text(prompt)).strip().strip('"')
    if not text:
        raise ValueError("empty image prompt")
    return text


def _render_image(prompt: str, name: str) -> str:
    response = client.models.generate_content(
        model=IMAGE_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(response_modalities=["IMAGE", "TEXT"]),
    )
    parts = (response.candidates[0].content.parts or []) if response.candidates else []
    for part in parts:
        if part.inline_data is not None and part.inline_data.data:
            path = _new_image_path(name)
            path.write_bytes(part.inline_data.data)
            return f"/static/generated/{path.name}"
    reason = " ".join(p.text for p in parts if getattr(p, "text", None))[:150]
    raise ValueError(f"model returned no image{': ' + reason if reason else ''}")


async def generate_image_variant(comp: GenerateImageComponent, variant_id: str, label: str, color: str) -> dict:
    variant = {
        "variantId": variant_id,
        "label": label,
        "color": color,
        "model": IMAGE_MODEL,
        "generatedImageUrl": None,
        "promptUsed": None,
    }
    try:
        variant["promptUsed"] = await build_image_prompt(
            comp.imageContext, comp.altText, IMAGE_VARIANT_STYLES[variant_id]
        )
        variant["generatedImageUrl"] = await _with_retry(
            _render_image, variant["promptUsed"], f"{comp.id}_{variant_id}"
        )
    except Exception as e:
        # promptUsed is kept when only the render failed, so the user can edit it and retry.
        log.warning("%s image failed for %s: %s", variant_id, comp.id, e)
        variant["error"] = str(e)[:200]
    return variant


@app.post("/api/generate-image-variants")
async def generate_image_variants(req: GenerateImageVariantsRequest):
    """components x 3 styles; each runs prompt-writer -> image model, all in parallel."""

    async def one(comp: GenerateImageComponent) -> dict:
        variants = await asyncio.gather(*(generate_image_variant(comp, *v) for v in IMAGE_VARIANTS))
        return {"id": comp.id, "variants": list(variants)}

    return {"results": await asyncio.gather(*(one(c) for c in req.components))}


class RegenerateImageRequest(BaseModel):
    componentId: str
    variantId: str
    prompt: str


@app.post("/api/regenerate-image")
async def regenerate_image(req: RegenerateImageRequest):
    """Re-render one variant from the user's (edited) prompt."""
    prompt = req.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt is empty")
    try:
        url = await _with_retry(_render_image, prompt, f"{req.componentId}_{req.variantId}")
    except Exception as e:
        log.warning("regenerate failed for %s/%s: %s", req.componentId, req.variantId, e)
        raise HTTPException(status_code=502, detail=f"Image generation failed: {str(e)[:200]}")
    return {
        "componentId": req.componentId,
        "variantId": req.variantId,
        "generatedImageUrl": url,
        "promptUsed": prompt,
    }


# ---------- upload-image (user's own replacement) ----------

MAX_UPLOAD_BYTES = 8 * 1024 * 1024


class UploadImageRequest(BaseModel):
    componentId: str
    dataUrl: str


@app.post("/api/upload-image")
async def upload_image(req: UploadImageRequest):
    try:
        raw = base64.b64decode(req.dataUrl.split(",", 1)[-1], validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(status_code=400, detail="Could not read the uploaded file")
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image is larger than 8 MB")
    try:
        img = Image.open(io.BytesIO(raw))
        img.load()
    except (UnidentifiedImageError, OSError):
        raise HTTPException(status_code=400, detail="That file is not a valid image")
    img.thumbnail((2048, 2048))
    path = _new_image_path(req.componentId, prefix="upload_")
    img.convert("RGBA" if img.mode in ("RGBA", "LA", "P") else "RGB").save(path, "PNG")
    return {"componentId": req.componentId, "generatedImageUrl": f"/static/generated/{path.name}"}


# ---------- aem-image (authenticated DAM proxy for real AEM mode) ----------

@app.get("/api/aem-image")
async def aem_image(path: str):
    if not aem.AEM_ENABLED:
        raise HTTPException(status_code=404, detail="AEM is not enabled")
    try:
        body, content_type = await aem.fetch_asset(path)
    except aem.AemError as e:
        raise HTTPException(status_code=e.status, detail=e.message)
    return Response(content=body, media_type=content_type)


# ---------- suggest ----------

class SuggestRequest(BaseModel):
    componentType: str
    originalContent: str
    userDraft: str


@app.post("/api/suggest")
async def suggest(req: SuggestRequest):
    prompt = fill(
        SUGGEST_PROMPT,
        brand_guidelines=BRAND_GUIDELINES,
        component_type=req.componentType,
        original_content=req.originalContent,
        user_draft=req.userDraft,
    )
    try:
        data = json.loads(strip_fences(await gemini_text(prompt)))
        if not isinstance(data, list):
            raise ValueError("unexpected response shape")
        return {"suggestions": [str(s) for s in data][:3]}
    except Exception as e:
        log.warning("suggest failed: %s", e)
        raise HTTPException(status_code=502, detail=f"Suggestion failed: {str(e)[:200]}")


# ---------- apply a suggestion ----------

class ApplyRequest(BaseModel):
    componentType: str
    originalContent: str
    userDraft: str
    suggestion: str


@app.post("/api/apply")
async def apply_suggestion(req: ApplyRequest):
    prompt = fill(
        APPLY_PROMPT,
        brand_guidelines=BRAND_GUIDELINES,
        component_type=req.componentType,
        original_content=req.originalContent,
        user_draft=req.userDraft,
        suggestion=req.suggestion,
    )
    try:
        text = strip_fences(await gemini_text(prompt))
        if not text:
            raise ValueError("empty response")
        return {"updatedContent": text}
    except Exception as e:
        log.warning("apply failed: %s", e)
        raise HTTPException(status_code=502, detail=f"Apply failed: {str(e)[:200]}")


# ---------- publish ----------

class PublishComponent(BaseModel):
    id: str
    type: str = "text"
    jcrPath: str
    selectedVariant: str | None = None  # which AI variant the user picked (for the log/response)
    updatedContent: str = ""
    updatedImageUrl: str | None = None  # image components


class PublishRequest(BaseModel):
    pagePath: str
    components: list[PublishComponent]


@app.post("/api/publish")
async def publish(req: PublishRequest):
    if aem.AEM_ENABLED:
        try:
            for c in req.components:
                if c.type == "image":
                    # Overwrites the DAM asset the component points at with the new image.
                    asset = await aem.replace_dam_image(c.jcrPath, _generated_bytes(c.updatedImageUrl))
                    log.info("Replaced DAM asset %s", asset)
                else:
                    await aem.publish_to_aem(c.jcrPath, c.type, c.updatedContent)
        except aem.AemError as e:
            raise HTTPException(status_code=e.status, detail=e.message)
        log.info("Published %d components to AEM page %s", len(req.components), req.pagePath)
    else:
        log.info("Would publish to AEM: %s", req.model_dump_json(indent=2))
    return {
        "status": "success",
        "message": f"Published {len(req.components)} components to AEM",
        "published": [{"id": c.id, "variant": c.selectedVariant} for c in req.components],
        "skipped": [],  # the frontend only sends components that have a selected variant
    }


def _generated_bytes(url: str | None) -> bytes:
    """Read a previously generated/uploaded image; only files we saved ourselves are allowed."""
    name = Path(url or "").name
    path = GENERATED_DIR / name
    if not url or not url.startswith("/static/generated/") or not path.is_file():
        raise aem.AemError(400, "That image no longer exists on the server; regenerate it and publish again")
    return path.read_bytes()


@app.get("/api/health")
async def health():
    return {"ok": True}
