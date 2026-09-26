"""A tiny stand-in for an AEM author instance, for demos where real AEM isn't available.

It answers the same URLs the app uses against real AEM (default port 4502):

    GET  /<page>.infinity.json         full JCR tree of a page (also .json and .<depth>.json)
    GET  /content/dam/...              DAM images (generated placeholders)
    POST /<node path>                  Sling POST: accepted and logged, nothing is stored
    PUT  /api/assets/...               Assets HTTP API upload: accepted and logged
    GET  /_publish-log                 the requests received so far

Run:  uvicorn mock_aem_server:app --port 4502
The content is read-only on purpose: every visitor starts from the same "before".
"""
import io
import logging
import re
from datetime import datetime, timezone
from urllib.parse import parse_qs

from fastapi import FastAPI, HTTPException, Request, Response
from PIL import Image, ImageDraw, ImageFont

log = logging.getLogger("uvicorn.error")
app = FastAPI(title="Mock AEM")

TEXT = "core/wcm/components/text/v2/text"
TITLE = "core/wcm/components/title/v3/title"
IMAGE = "core/wcm/components/image/v3/image"
TEASER = "core/wcm/components/teaser/v1/teaser"
CONTAINER = "core/wcm/components/container/v1/container"


def node(resource_type: str, **props) -> dict:
    return {"jcr:primaryType": "nt:unstructured", "sling:resourceType": resource_type, **props}


def page(title: str, container: dict) -> dict:
    return {
        "jcr:primaryType": "cq:Page",
        "jcr:content": {
            "jcr:primaryType": "cq:PageContent",
            "jcr:title": title,
            "sling:resourceType": "nuvox/components/page",
            "root": {**node("nuvox/components/container"), "container": {**node(CONTAINER), **container}},
        },
    }


# Deliberately bland "current" content, so the AI refresh is an obvious step up.
PAGES = {
    "/content/nuvox/us/en/products/airwave-pro": page(
        "NUVOX AirWave Pro",
        {
            "title": node(TITLE, **{"jcr:title": "Premium Wireless Headphones", "type": "h1"}),
            "text": node(
                TEXT,
                textIsRich="true",
                text="<p>These are our wireless headphones. They are good quality and have nice sound. Many customers have bought them and they like them. The headphones are available in different colors. They are comfortable to wear for long periods of time. Buy them now.</p>",
            ),
            "image": node(
                IMAGE,
                fileReference="/content/dam/nuvox/products/airwave-pro-hero.jpg",
                alt="Wireless headphones on white background",
            ),
            "accordion": {
                **node("core/wcm/components/accordion/v1/accordion"),
                "item_1": {
                    **node(CONTAINER, **{"jcr:title": "Product Specifications"}),
                    "text": node(
                        TEXT,
                        textIsRich="true",
                        text="<p>Battery life is long. Sound quality is good. It has Bluetooth. Comes with a charging cable. The box contains headphones and some accessories.</p>",
                    ),
                },
                "item_2": {
                    **node(CONTAINER, **{"jcr:title": "Shipping Information"}),
                    "text": node(
                        TEXT,
                        textIsRich="true",
                        text="<p>We ship to many places. Shipping takes some days. Free shipping is available sometimes. Track your order on our website.</p>",
                    ),
                },
            },
            "teaser": {
                **node(
                    TEASER,
                    pretitle="Special Offer",
                    **{
                        "jcr:title": "Special Offer",
                        "jcr:description": "<p>We have a sale going on. Get discount on headphones. Limited time offer. Contact us for more details.</p>",
                    },
                    textIsRich="true",
                ),
                "actions": {
                    "jcr:primaryType": "nt:unstructured",
                    "item0": {"jcr:primaryType": "nt:unstructured", "text": "Click Here", "link": "/content/nuvox/us/en/products"},
                },
            },
            "text_1": node(
                TEXT,
                textIsRich="true",
                text="<p>If you have any questions about this product please contact us. Our team is available to help you. You can also check out our other products on the website. We have many different electronics and accessories available for purchase. Thank you for visiting our store.</p>",
            ),
        },
    ),
    "/content/nuvox/us/en/about-us": page(
        "About NUVOX",
        {
            "text": node(
                TEXT,
                textIsRich="true",
                text="<p>NUVOX is a company that makes audio products. We are committed to providing best-in-class quality to our customers. Our team is experienced and works hard to deliver state-of-the-art solutions. Please contact us with any questions.</p>",
            ),
            "text_1": node(
                TEXT,
                textIsRich="true",
                text="<p>Our mission is to provide customers with high quality audio products at competitive prices. We value customer satisfaction and care about the environment. Customers may provide feedback through our website.</p>",
            ),
            "image": node(IMAGE, fileReference="/content/dam/nuvox/about/team-photo.jpg", alt="NUVOX team photo"),
        },
    ),
}

# path -> node, so any node path (a page, a component, actions/item0 ...) resolves
STORE: dict = {}
for _path, _page in PAGES.items():
    _cur = STORE
    for _seg in _path.strip("/").split("/")[:-1]:
        _cur = _cur.setdefault(_seg, {})
    _cur[_path.rsplit("/", 1)[-1]] = _page

requests_log: list[dict] = []


def resolve(path: str) -> dict | None:
    cur = STORE
    for seg in path.strip("/").split("/"):
        if not isinstance(cur, dict) or seg not in cur:
            return None
        cur = cur[seg]
    return cur if isinstance(cur, dict) else None


def prune(n: dict, depth: int | None) -> dict:
    """Sling JSON depth: 0 = properties only, N = N levels of children, None = everything."""
    out = {}
    for k, v in n.items():
        if not isinstance(v, dict):
            out[k] = v
        elif depth is None:
            out[k] = prune(v, None)
        elif depth > 0:
            out[k] = prune(v, depth - 1)
    return out


def placeholder(label: str) -> bytes:
    img = Image.new("RGB", (1200, 675), "#e5e7eb")
    draw = ImageDraw.Draw(img)
    font = ImageFont.load_default(size=40)
    text = "Current AEM image"
    for i, line in enumerate((text, label)):
        left, top, right, bottom = draw.textbbox((0, 0), line, font=font)
        draw.text(((1200 - (right - left)) / 2, 280 + i * 60), line, fill="#9ca3af", font=font)
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=88)
    return buf.getvalue()


def record(method: str, path: str, properties: dict) -> None:
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "method": method,
        "path": path,
        "properties": properties,
    }
    requests_log.append(entry)
    del requests_log[:-200]  # keep the last 200
    log.info("MOCK AEM %s %s %s", method, path, properties)


@app.get("/")
async def index():
    return {"server": "Mock AEM", "pages": list(PAGES), "publishLog": "/_publish-log"}


@app.get("/_publish-log")
async def publish_log():
    return {"total": len(requests_log), "entries": requests_log}


@app.get("/{path:path}")
async def get_content(path: str):
    full = "/" + path
    m = re.fullmatch(r"(.+?)\.(?:(infinity)|(\d+))?\.?json", full) if full.endswith(".json") else None
    if m:
        n = resolve(m.group(1))
        if n is None:
            raise HTTPException(status_code=404, detail=f"No node at {m.group(1)}")
        depth = None if m.group(2) else int(m.group(3)) if m.group(3) else 0
        return prune(n, depth)
    if full.startswith("/content/dam/"):
        return Response(content=placeholder(full.rsplit("/", 1)[-1]), media_type="image/jpeg")
    raise HTTPException(status_code=404, detail=f"Not found: {full}")


@app.put("/api/assets/{path:path}")
async def put_asset(path: str, request: Request):
    body = await request.body()
    record("PUT", f"/content/dam/{path}", {"bytes": len(body), "contentType": request.headers.get("content-type", "")})
    return {"status.code": 200, "status.message": "Asset updated (mock: nothing stored)"}


@app.post("/{path:path}")
async def sling_post(path: str, request: Request):
    full = "/" + path
    if resolve(full) is None:
        raise HTTPException(status_code=404, detail=f"No node at {full}")
    body = await request.body()
    if "multipart" in request.headers.get("content-type", ""):
        props = {"multipart": f"{len(body)} bytes"}
    else:
        props = {k: v[0] for k, v in parse_qs(body.decode("utf-8", "replace")).items()}
    record("POST", full, props)
    return {"status.code": 200, "status.message": "OK", "path": full, "changeLog": [f"Content modified at {full}"]}
