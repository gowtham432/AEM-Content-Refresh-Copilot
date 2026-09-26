import asyncio
import json
import logging
import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from pydantic import BaseModel

import aem
from mock_data import DEFAULT_MOCK, MOCK_PAGES
from prompts import APPLY_PROMPT, BRAND_GUIDELINES, GENERATE_PROMPT, SUGGEST_PROMPT

load_dotenv()

log = logging.getLogger("uvicorn.error")

MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.8-flash")
client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

app = FastAPI(title="AEM Content Refresh Copilot")

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


async def gemini_text(prompt: str) -> str:
    response = await asyncio.to_thread(
        client.models.generate_content, model=MODEL, contents=prompt
    )
    return (response.text or "").strip()


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


# ---------- generate ----------

class GenerateComponent(BaseModel):
    id: str
    type: str
    currentContent: str


class GenerateRequest(BaseModel):
    components: list[GenerateComponent]


async def generate_one(comp: GenerateComponent) -> dict:
    try:
        prompt = fill(
            GENERATE_PROMPT,
            brand_guidelines=BRAND_GUIDELINES,
            component_type=comp.type,
            current_content=comp.currentContent,
        )
        text = strip_fences(await gemini_text(prompt))
        if not text:
            raise ValueError("empty response")
        return {"id": comp.id, "generatedContent": text}
    except Exception as e:
        log.warning("generate failed for %s: %s", comp.id, e)
        return {"id": comp.id, "generatedContent": None, "error": str(e)[:200]}


@app.post("/api/generate")
async def generate(req: GenerateRequest):
    results = await asyncio.gather(*(generate_one(c) for c in req.components))
    return {"results": results}


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
    updatedContent: str


class PublishRequest(BaseModel):
    pagePath: str
    components: list[PublishComponent]


@app.post("/api/publish")
async def publish(req: PublishRequest):
    if aem.AEM_ENABLED:
        try:
            for c in req.components:
                await aem.publish_to_aem(c.jcrPath, c.type, c.updatedContent)
        except aem.AemError as e:
            raise HTTPException(status_code=e.status, detail=e.message)
        log.info("Published %d components to AEM page %s", len(req.components), req.pagePath)
    else:
        log.info("Would publish to AEM: %s", req.model_dump_json(indent=2))
    return {
        "status": "success",
        "message": f"Published {len(req.components)} components to AEM",
        "published": [c.id for c in req.components],
    }


@app.get("/api/health")
async def health():
    return {"ok": True}
