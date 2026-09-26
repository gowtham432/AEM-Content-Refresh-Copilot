import html
import os
import re

import httpx
from dotenv import load_dotenv

load_dotenv()  # this module reads env at import time, before main.py's own load_dotenv()

AEM_ENABLED = os.environ.get("AEM_ENABLED", "false").lower() == "true"
AEM_HOST = os.environ.get("AEM_HOST", "http://localhost:4502").rstrip("/")
AEM_AUTH = (os.environ.get("AEM_USER", "admin"), os.environ.get("AEM_PASSWORD", "admin"))

# Component types we can read and write back. Others found on the page are skipped.
SUPPORTED_TYPES = {"text", "title"}


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


def _component_type(resource_type: str) -> str | None:
    parts = [p for p in resource_type.split("/") if p]
    while parts and re.fullmatch(r"v\d+", parts[-1]):  # core components: .../text/v2/text
        parts.pop()
    return parts[-1] if parts and parts[-1] in SUPPORTED_TYPES else None


def _walk(node: dict, path: str, found: list) -> None:
    for name, child in node.items():
        if not isinstance(child, dict):
            continue
        child_path = f"{path}/{name}"
        kind = _component_type(str(child.get("sling:resourceType", "")))
        if kind:
            found.append((kind, name, child_path, child))
        _walk(child, child_path, found)


def parse_page(page_path: str, data: dict) -> dict:
    content = data.get("jcr:content", {})
    found: list = []
    _walk(content, f"{page_path}/jcr:content", found)

    components = []
    for kind, name, jcr_path, node in found:
        if kind == "text":
            raw = str(node.get("text", ""))
            text = html_to_plain(raw) if str(node.get("textIsRich", "")).lower() == "true" else raw
        else:
            text = str(node.get("jcr:title", ""))
        if not text.strip():
            continue
        components.append(
            {
                "id": f"comp-{len(components) + 1}",
                "type": kind,
                "label": f"{kind.title()} ({name})",
                "jcrPath": jcr_path,
                "currentContent": text,
            }
        )
    return {
        "pageTitle": content.get("jcr:title", page_path.rsplit("/", 1)[-1]),
        "pagePath": page_path,
        "components": components,
    }


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


async def publish_to_aem(jcr_path: str, comp_type: str, content: str) -> None:
    if comp_type == "text":
        form = {"text": plain_to_html(content), "textIsRich": "true"}
    elif comp_type == "title":
        form = {"jcr:title": content.strip()}
    else:
        raise AemError(400, f"Publishing '{comp_type}' components is not supported")
    try:
        async with httpx.AsyncClient(timeout=15) as http:
            resp = await http.post(f"{AEM_HOST}{jcr_path}", auth=AEM_AUTH, data=form)
    except httpx.HTTPError as e:
        raise AemError(502, f"Could not reach AEM at {AEM_HOST}: {e.__class__.__name__}")
    if resp.status_code not in (200, 201):
        raise AemError(502, f"AEM returned {resp.status_code} updating {jcr_path}")
