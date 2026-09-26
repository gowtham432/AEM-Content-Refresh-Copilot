# AEM Content Refresh Copilot

Enter an AEM page path and get **three AI variants of every component** next to what's live in AEM. Text comes back as *Safe Refresh*, *Bold Rewrite* and *SEO Optimized* (three strategies, two Gemini models); images come back as *Product Focus*, *Lifestyle* and *Editorial*. Pick one per component, edit it (text gets live suggestions, images get an editable prompt), and publish only the picks back to AEM.

- **Frontend:** React + Vite + Tailwind
- **Backend:** FastAPI + Google Gemini (`google-genai`)
- **AEM:** a real author instance over the Sling API, or the bundled mock AEM server (`backend/mock_aem_server.py`) for demos

## Run locally

**Backend**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env    # then edit .env (see Configuration)
uvicorn main:app --reload --port 8000
```

**Frontend**
```bash
cd frontend
npm install
npm run dev             # http://localhost:5173 (proxies /api to :8000)
```

The backend reads `.env` only at startup, and Vite reads `tailwind.config.js` only at startup, so restart them after changing those files.

## Configuration (`backend/.env`)

| Variable | Default | Notes |
| --- | --- | --- |
| `GEMINI_API_KEY` | – | Required. Get one from Google AI Studio. Never commit it. |
| `GEMINI_MODEL` | `gemini-3.8-flash` | Default text model (suggestions, apply, image prompts, Safe and SEO variants). Use a model your key has quota for, e.g. `gemini-3-flash-preview`. |
| `GEMINI_MODEL_BOLD` | `gemini-omni-1.1-flash` | Model for the Bold Rewrite variant. Omni models only work through the Interactions API, which the backend handles. If it fails, the variant falls back to `GEMINI_MODEL` and the card says so. |
| `GEMINI_MODEL_SAFE` / `GEMINI_MODEL_SEO` | `GEMINI_MODEL` | Optional per-variant overrides. |
| `GEMINI_IMAGE_MODEL` | `gemini-3.1-flash-lite-image` | Image generation model. |
| `DEMO_VIDEO_URL` | `https://youtu.be/mErtyRKxPn0` | Demo video linked from the demo-mode panel. |
| `AEM_HOST` | `http://localhost:4502` | Where the app reads and writes content: a real AEM author, or the mock server. |
| `AEM_MODE` | `live` | `mock` when `AEM_HOST` is the mock server. It only makes the UI show the "Demo mode" panel and demo wording. |
| `AEM_USER` / `AEM_PASSWORD` | `admin` / `admin` | Basic auth for fetch and publish. |
| `FRONTEND_URL` | – | Extra CORS origin for deployed frontends. |

## Using it

1. Enter an AEM page path, e.g. `/content/aisearchspa/us/en/ecommerce`, and click **Fetch content**.
2. Every component becomes a row: **Current** (read-only) plus three AI variants, all generated in parallel. **Regen all** re-runs one component's three variants.
3. Click **Select** on a variant. It becomes editable and the other two dim. Switching variants after you've edited asks for confirmation, since the edits are dropped.
4. **Text:** after you pause typing, three suggestions appear; click one to apply it.
5. **Images:** the selected image shows its prompt. Edit it (e.g. "violet glow" to "hot coral glow") and click **Regenerate**, or **Upload my own**.
6. The bottom bar shows *N of M components selected*. **Publish** sends only the selected variants; components without a selection keep their current content.

### Real AEM (`AEM_MODE=live`)
- Fetch reads `{AEM_HOST}{path}.infinity.json` and picks up **text**, **title**, **image** and **teaser** components under `jcr:content`. Images can be a DAM asset (`fileReference` under `/content/dam/`) or a file uploaded directly onto the component (a `file` child node); both are shown via an authenticated backend proxy. A teaser becomes two cards: its text (`Pretitle / Title / Description / CTA`) and its image. Components inside containers (e.g. accordion panels) are labelled with the container's title. Other component types and empty components are skipped.
- The page path can be a bare path, `path.html`, a full URL, or an editor URL; it's normalized to the JCR page path, and publish refuses any node path containing `.html`/`.json`.
- Each component is published independently: one failure is reported (with the reason) and doesn't block the others. Teaser variants are forced to keep their `Title:/Description:/CTA:` lines; a teaser can also be published partially (only the labelled fields present are written).
- Text and title: a Sling POST to `{AEM_HOST}{jcrPath}` (`text` + `textIsRich=true`, or `jcr:title`). Teaser: `pretitle`, `jcr:title`, `jcr:description`, and the first button's text under `actions/`.
- **Image publish overwrites the existing image**, re-encoded to its own format (a `.jpg` stays a JPEG): for a DAM asset it replaces the original via the Assets HTTP API (`PUT /api/assets/...`), so every page using that asset shows the new image; for an inline image it replaces the component's `file` node.
- After every publish the component's `jcr:lastModified` (and the page's `cq:lastModified`) is updated, like the AEM editor does. AEM builds image URLs from it (`.coreimg.jpeg/<lastModified>/...`), so without this a replaced image keeps its old URL and browsers keep showing the cached picture.
- Rich text is shown as plain text. Publishing rewrites it as simple `<p>` paragraphs, so inline formatting (bold, links) is lost.
- All of this **changes real content**, so try it on a scratch page first.

### Mock AEM (`AEM_MODE=mock`)
Real AEM needs heavy infrastructure, so for demos there is a tiny stand-in, `backend/mock_aem_server.py`. It has no UI: it just answers on the same URLs as an AEM author (port 4502 by default), so the app can't tell the difference and there's no mock-specific code in it.

```bash
cd backend
uvicorn mock_aem_server:app --port 4502     # then set AEM_HOST=http://localhost:4502 and AEM_MODE=mock
```

| Request | Answer |
| --- | --- |
| `GET /<page>.infinity.json` (also `.json`, `.1.json` ...) | the page's JCR tree; only the two sample pages exist, everything else is 404 |
| `GET /content/dam/...` | a generated grey placeholder image |
| `POST /<node path>` (Sling POST) | 200 if the node exists (404 otherwise), and the properties are logged |
| `PUT /api/assets/...` | 200, and logged |
| `GET /_publish-log` | everything received so far (a peek at what "publish" sent) |

It is read-only on purpose: nothing is stored, so every visitor starts from the same deliberately bland NUVOX copy. Sample pages: `/content/nuvox/us/en/products/airwave-pro` (7 components) and `/content/nuvox/us/en/about-us` (3). Locally, real AEM and the mock can't both use port 4502, so run the mock on another port and point `AEM_HOST` at it.

With `AEM_MODE=mock` the UI shows a **Demo mode** panel: content comes from a mock AEM server, publishing is only logged, and live updates can't be shown because real AEM is heavy to run. It links to the demo video, offers one-click sample pages, and the publish toast says it was a demo.

## Deploy (one public URL)

The `Dockerfile` builds the React app and runs everything in one container: FastAPI serves the site and the API, and the mock AEM runs beside it on `127.0.0.1:4502` (`AEM_MODE=mock`).

**Render** (free tier): New > Blueprint > pick this repo (it reads `render.yaml`), paste `GEMINI_API_KEY` when asked, deploy. Any Docker host works the same way (Railway, Fly.io, Cloud Run): set `GEMINI_API_KEY` and expose `$PORT`.

Notes for anyone trying the public demo:

> ⏳ **Cold start:** Render's free tier sleeps after about 15 minutes idle, so the first load can take ~30 seconds to wake up. After that it's fast.

> 🔑 **API quota:** each page fetch fires dozens of parallel Gemini calls (three variants per component, plus images). Many people fetching at the same moment can hit rate limits. For the best experience, let one page finish generating before fetching another.

If Render gives you trouble, Railway works the same way with the same `Dockerfile`: connect the repo, add `GEMINI_API_KEY`, deploy.

## Brand guidelines

All text prompts (the three variants, suggest, apply) include `backend/brand_guidelines.md`, the NUVOX voice, audience, values and banned phrases. Edit that file and restart the backend to change the brand; the prompts are in `backend/prompts.py`.

## API
- `GET /api/fetch-page?path=` – components on the page
- `POST /api/generate-text-variants` – 3 text variants per component (Safe / Bold / SEO), components x 3 calls in parallel
- `POST /api/generate-image-variants` – 3 image variants per component (Product / Lifestyle / Editorial): each writes a prompt, then renders it. Files go to `backend/static/generated/` (gitignored), served under `/static/`
- `POST /api/regenerate-image` – re-renders one variant from an edited prompt
- `POST /api/upload-image` – stores the user's own replacement image (validated, max 8 MB)
- `POST /api/suggest` – 3 suggestions on the user's draft
- `POST /api/apply` – applies one clicked suggestion to the draft
- `POST /api/publish` – writes the selected variants to AEM (or logs them in mock mode)
- `GET /api/aem-image?path=` – authenticated proxy for DAM images (AEM mode only)
- `GET /api/health`

## Troubleshooting
- **"No AEM page at …" in the demo** – the mock only has the two sample pages listed above.
- **`429 RESOURCE_EXHAUSTED`** – the Gemini project is out of quota. Wait, enable billing, or use a key from a different project or another model.
- **`404 ... models/... not found`** – `GEMINI_MODEL` isn't a valid model name for your key.
- **"Could not reach AEM"** – check `AEM_HOST` and that AEM is running. **"rejected the credentials"** – check `AEM_USER` / `AEM_PASSWORD`.
- **Variant cards empty or "Generation failed"** – make sure the backend is running on port 8000; the card shows the underlying error.
- **Slow first load** – a page with many components makes dozens of Gemini calls (capped at 8 at a time, with retries on rate limits), so expect 20-30 seconds.
