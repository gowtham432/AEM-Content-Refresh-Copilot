import html
import io
import os
import re
from urllib.parse import quote

import httpx
from dotenv import load_dotenv
from PIL import Image

load_dotenv()  # this module reads env at import time, before main.py's own load_dotenv()

# The app always talks to AEM_HOST: a real author instance, or the bundled mock (mock_aem_server.py).
# AEM_MODE only labels which one it is, so the UI can explain that a demo isn't touching a live site.
AEM_MODE = "mock" if os.environ.get("AEM_MODE", "live").strip().lower() == "mock" else "live"
AEM_HOST = os.environ.get("AEM_HOST", "http://localhost:4502").rstrip("/")
AEM_AUTH = (os.environ.get("AEM_USER", "admin"), os.environ.get("AEM_PASSWORD", "admin"))

# Component types we can read and write back. Others found on the page are skipped.
SUPPORTED_TYPES = {"text", "title", "image", "teaser"}


class AemError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


def html_to_plain(value: str) -> str:
    value = re.sub(r"</p>\s*<p[^>]*>", "\n\n", value, flags=re.I)
    value = re.sub(r"<br\s*/?>", "\n", value, flags=re.I)
    value = re.sub(r"<[^>]+>", "", value)
    return html.unescape(value).strip()


def plain_to_html(value: str) -> str:
    paragraphs = [p for p in re.split(r"\n\s*\n", value.strip()) if p.strip()]
    return "".join(f"<p>{html.escape(p.strip()).replace(chr(10), '<br>')}</p>" for p in paragraphs)


def normalize_page_path(raw: str) -> str:
    """Accept whatever the user pastes (bare path, path.html, full URL, editor URL) and return the JCR page path."""
    p = raw.strip()
    p = re.sub(r"^[a-z][a-z0-9+.-]*://[^/]+", "", p, flags=re.I)  # scheme + host
    p = p.split("?")[0].split("#")[0]
    p = re.sub(r"^/(?:editor|sites|assets)\.html(?=/content)", "", p)  # AEM UI wrappers
    p = re.sub(r"/jcr:content.*$", "", p.rstrip("/"))  # a component path -> its page
    p = re.sub(r"(?:\.(?:html?|json|xml|infinity))+$", "", p, flags=re.I)  # extensions
    return p.rstrip("/")


def _component_type(resource_type: str) -> str | None:
    parts = [p for p in resource_type.split("/") if p]
    while parts and re.fullmatch(r"v\d+", parts[-1]):  # core components: .../text/v2/text
        parts.pop()
    return parts[-1] if parts and parts[-1] in SUPPORTED_TYPES else None


def _walk(node: dict, path: str, found: list, ctx: str = "") -> None:
    """Collect supported components. `ctx` is the title of the container they sit in (e.g. an accordion panel)."""
    for name, child in node.items():
        if not isinstance(child, dict):
            continue
        child_path = f"{path}/{name}"
        kind = _component_type(str(child.get("sling:resourceType", "")))
        if kind:
            found.append((kind, name, child_path, child, ctx))
            _walk(child, child_path, found, ctx)
        else:
            title = str(child.get("cq:panelTitle") or child.get("jcr:title") or "")
            _walk(child, child_path, found, title or ctx)


def parse_page(page_path: str, data: dict) -> dict:
    content = data.get("jcr:content", {})
    found: list = []
    _walk(content, f"{page_path}/jcr:content", found)

    page_title = content.get("jcr:title", page_path.rsplit("/", 1)[-1])
    components: list[dict] = []

    def add(kind: str, label: str, jcr_path: str, **fields) -> None:
        components.append(
            {"id": f"comp-{len(components) + 1}", "type": kind, "label": label, "jcrPath": jcr_path, **fields}
        )

    def add_image(label: str, jcr_path: str, node: dict, what: str) -> None:
        ref = str(node.get("fileReference", ""))
        inline = isinstance(node.get("file"), dict)  # image uploaded straight onto the component
        if ref.startswith("/content/dam/"):
            source = ref
        elif inline:
            source = f"{jcr_path}/file"
        else:
            return  # no image to show or replace
        alt = str(node.get("alt", ""))
        add(
            "image",
            label,
            jcr_path,
            currentImageUrl=f"/api/aem-image?path={quote(source)}",
            altText=alt,
            imageContext=f"{what} on the '{page_title}' page. Alt text: {alt or 'none'}",
        )

    for kind, name, jcr_path, node, ctx in found:
        label = f"{kind.title()} ({ctx or name})"
        if kind == "image":
            add_image(label, jcr_path, node, f"Image '{name}'")
        elif kind == "teaser":
            text = teaser_to_text(node)
            if text.strip():
                add("teaser", label, jcr_path, currentContent=text)
            # A teaser's image is its own card so it can be regenerated separately.
            title = html_to_plain(str(node.get("jcr:title", ""))) or name
            add_image(f"Teaser image ({name})", jcr_path, node, f"Image for the teaser '{title}'")
        else:
            if kind == "text":
                raw = str(node.get("text", ""))
                text = html_to_plain(raw) if str(node.get("textIsRich", "")).lower() == "true" else raw
            else:
                text = str(node.get("jcr:title", ""))
            if text.strip():
                add(kind, label, jcr_path, currentContent=text)
    return {"pageTitle": page_title, "pagePath": page_path, "components": components}


# ---- teasers: "Pretitle / Title / Description / CTA" as plain text ----

_TEASER_FIELDS = ("Pretitle", "Title", "Description", "CTA")


def _first_action(node: dict) -> dict | None:
    actions = node.get("actions")
    if not isinstance(actions, dict):
        return None
    for key in sorted(actions):
        item = actions[key]
        if key.startswith("item") and isinstance(item, dict) and item.get("text"):
            return item
    return None


def teaser_to_text(node: dict) -> str:
    action = _first_action(node)
    values = {
        "Pretitle": str(node.get("pretitle", "")),
        "Title": html_to_plain(str(node.get("jcr:title", ""))),
        "Description": html_to_plain(str(node.get("jcr:description", ""))),
        "CTA": str(action["text"]) if action else "",
    }
    return "\n".join(f"{f}: {values[f]}" for f in _TEASER_FIELDS if values[f].strip())


def text_to_teaser(content: str) -> dict[str, str]:
    """Inverse of teaser_to_text. Lines without a 'Field:' prefix continue the previous field."""
    fields: dict[str, list[str]] = {}
    current = None
    for line in content.splitlines():
        m = re.match(rf"^\s*({'|'.join(_TEASER_FIELDS)})\s*:\s*(.*)$", line, flags=re.I)
        if m:
            current = next(f for f in _TEASER_FIELDS if f.lower() == m.group(1).lower())
            fields[current] = [m.group(2)]
        elif current:
            fields[current].append(line)
    return {k: "\n".join(v).strip() for k, v in fields.items()}


async def fetch_asset(path: str) -> tuple[bytes, str]:
    """Download a DAM asset (or a component's inline image) with AEM credentials for the browser."""
    is_dam = path.startswith("/content/dam/")
    is_inline = path.startswith("/content/") and "/jcr:content/" in path and path.endswith("/file")
    if not (is_dam or is_inline) or ".." in path:
        raise AemError(400, "Only DAM assets and component images can be fetched")
    try:
        async with httpx.AsyncClient(timeout=20) as http:
            resp = await http.get(f"{AEM_HOST}{path}", auth=AEM_AUTH)
    except httpx.HTTPError as e:
        raise AemError(502, f"Could not reach AEM at {AEM_HOST}: {e.__class__.__name__}")
    if resp.status_code != 200:
        raise AemError(resp.status_code if resp.status_code == 404 else 502, f"AEM returned {resp.status_code} for {path}")
    return resp.content, resp.headers.get("content-type", "application/octet-stream")


async def fetch_from_aem(path: str) -> dict:
    url = f"{AEM_HOST}{path}.infinity.json"
    try:
        async with httpx.AsyncClient(timeout=15) as http:
            resp = await http.get(url, auth=AEM_AUTH)
    except httpx.HTTPError as e:
        raise AemError(502, f"Could not reach AEM at {AEM_HOST}: {e.__class__.__name__}")
    if resp.status_code == 404:
        raise AemError(404, f"No AEM page at {path}")
    if resp.status_code in (401, 403):
        raise AemError(502, "AEM rejected the credentials (check AEM_USER / AEM_PASSWORD)")
    if resp.status_code != 200:
        raise AemError(502, f"AEM returned {resp.status_code} for {url}")
    return parse_page(path, resp.json())


_IMAGE_FORMATS = {  # extension -> (Pillow format, mime type)
    "jpg": ("JPEG", "image/jpeg"),
    "jpeg": ("JPEG", "image/jpeg"),
    "png": ("PNG", "image/png"),
    "webp": ("WEBP", "image/webp"),
    "gif": ("GIF", "image/gif"),
}


def _convert_image(data: bytes, ext: str) -> tuple[bytes, str]:
    """Re-encode the new image in the format of the asset it replaces (a .jpg stays a real JPEG)."""
    fmt, mime = _IMAGE_FORMATS[ext]
    img = Image.open(io.BytesIO(data))
    if fmt == "JPEG":
        if img.mode in ("RGBA", "LA", "P"):
            background = Image.new("RGB", img.size, "white")
            background.paste(img.convert("RGBA"), mask=img.convert("RGBA").split()[-1])
            img = background
        else:
            img = img.convert("RGB")
    out = io.BytesIO()
    img.save(out, fmt, **({"quality": 92} if fmt in ("JPEG", "WEBP") else {}))
    return out.getvalue(), mime


async def replace_image(jcr_path: str, image_bytes: bytes) -> str:
    """Overwrite the image a component shows and return where it was written.

    Two layouts exist: a DAM asset the component points at (`fileReference`; replaced in place
    through the Assets HTTP API) and an image uploaded straight onto the component (a `file`
    child node; replaced with a Sling multipart POST).
    """
    try:
        async with httpx.AsyncClient(timeout=30) as http:
            node = await http.get(f"{AEM_HOST}{jcr_path}.1.json", auth=AEM_AUTH)  # depth 1 includes the file child
            if node.status_code != 200:
                raise AemError(502, f"AEM returned {node.status_code} reading {jcr_path}")
            props = node.json()
            asset = str(props.get("fileReference", ""))

            if asset:
                if not asset.startswith("/content/dam/") or ".." in asset:
                    raise AemError(400, f"{jcr_path} does not point at a DAM asset")
                ext = asset.rsplit(".", 1)[-1].lower()
                if ext not in _IMAGE_FORMATS:
                    raise AemError(400, f"Can't replace '.{ext}' assets (supported: jpg, png, webp, gif)")
                body, mime = _convert_image(image_bytes, ext)
                # Assets HTTP API: PUT replaces the asset's original binary.
                rel = quote(asset[len("/content/dam/"):], safe="/")
                resp = await http.put(
                    f"{AEM_HOST}/api/assets/{rel}", auth=AEM_AUTH, content=body, headers={"Content-Type": mime}
                )
                if resp.status_code not in (200, 201):
                    raise AemError(502, f"AEM returned {resp.status_code} replacing {asset}")
                return asset

            if isinstance(props.get("file"), dict):
                name = str(props.get("fileName") or "")
                ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
                if ext not in _IMAGE_FORMATS:
                    meta = await http.get(f"{AEM_HOST}{jcr_path}/file/jcr:content.json", auth=AEM_AUTH)
                    mime_type = str(meta.json().get("jcr:mimeType", "")) if meta.status_code == 200 else ""
                    ext = next((e for e, (_, m) in _IMAGE_FORMATS.items() if m == mime_type), "")
                    name = name or f"image.{ext}"
                if ext not in _IMAGE_FORMATS:
                    raise AemError(400, f"Can't tell the image type of {jcr_path}/file")
                body, mime = _convert_image(image_bytes, ext)
                # Sling POST: a file parameter named ./file replaces the nt:file child in place.
                resp = await http.post(
                    f"{AEM_HOST}{jcr_path}",
                    auth=AEM_AUTH,
                    data={"./fileName": name},
                    files={"./file": (name, body, mime)},
                )
                if resp.status_code not in (200, 201):
                    raise AemError(502, f"AEM returned {resp.status_code} replacing {jcr_path}/file")
                return f"{jcr_path}/file"

            raise AemError(400, f"{jcr_path} has no image (no fileReference or file)")
    except httpx.HTTPError as e:
        raise AemError(502, f"Could not reach AEM at {AEM_HOST}: {e.__class__.__name__}")


async def _sling_post(http: httpx.AsyncClient, jcr_path: str, form: dict) -> None:
    resp = await http.post(f"{AEM_HOST}{jcr_path}", auth=AEM_AUTH, data=form)
    if resp.status_code not in (200, 201):
        raise AemError(502, f"AEM returned {resp.status_code} updating {jcr_path}")


async def publish_to_aem(jcr_path: str, comp_type: str, content: str) -> None:
    try:
        async with httpx.AsyncClient(timeout=15) as http:
            if comp_type == "text":
                await _sling_post(http, jcr_path, {"text": plain_to_html(content), "textIsRich": "true"})
            elif comp_type == "title":
                await _sling_post(http, jcr_path, {"jcr:title": content.strip()})
            elif comp_type == "teaser":
                fields = text_to_teaser(content)
                if not fields:
                    raise AemError(400, "Teaser text needs lines like 'Title: ...', 'Description: ...', 'CTA: ...'")
                form = {}
                if "Pretitle" in fields:
                    form["pretitle"] = fields["Pretitle"]
                if "Title" in fields:
                    form["jcr:title"] = fields["Title"]
                if "Description" in fields:
                    form["jcr:description"] = plain_to_html(fields["Description"])
                    form["textIsRich"] = "true"
                if form:
                    await _sling_post(http, jcr_path, form)
                if fields.get("CTA"):
                    # Update the first existing button; a teaser without one is left alone.
                    resp = await http.get(f"{AEM_HOST}{jcr_path}/actions.1.json", auth=AEM_AUTH)
                    items = resp.json() if resp.status_code == 200 else {}
                    first = next((k for k in sorted(items) if k.startswith("item") and isinstance(items[k], dict)), None)
                    if first:
                        await _sling_post(http, f"{jcr_path}/actions/{first}", {"text": fields["CTA"]})
            else:
                raise AemError(400, f"Publishing '{comp_type}' components is not supported")
    except httpx.HTTPError as e:
        raise AemError(502, f"Could not reach AEM at {AEM_HOST}: {e.__class__.__name__}")
