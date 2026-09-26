# AEM Content Refresh Copilot

Enter an AEM page path and get **three AI variants of every component** next to what's live in AEM. Text comes back as *Safe Refresh*, *Bold Rewrite* and *SEO Optimized* (three strategies, two Gemini models); images come back as *Product Focus*, *Lifestyle* and *Editorial*. Pick one per component, edit it (text gets live suggestions, images get an editable prompt), and publish only the picks back to AEM.

- **Frontend:** React + Vite + Tailwind
- **Backend:** FastAPI + Google Gemini (`google-genai`)
- **AEM:** real fetch/publish over the Sling API, or mock pages for demos

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
| `AEM_ENABLED` | `false` | `false` = mock pages, `true` = real AEM. |
| `AEM_HOST` | `http://localhost:4502` | AEM author instance. |
| `AEM_USER` / `AEM_PASSWORD` | `admin` / `admin` | Basic auth for fetch and publish. |
| `FRONTEND_URL` | – | Extra CORS origin for deployed frontends. |

## Using it

1. Enter an AEM page path, e.g. `/content/aisearchspa/us/en/ecommerce`, and click **Fetch content**.
2. Every component becomes a row: **Current** (read-only) plus three AI variants, all generated in parallel. **Regen all** re-runs one component's three variants.
3. Click **Select** on a variant. It becomes editable and the other two dim. Switching variants after you've edited asks for confirmation, since the edits are dropped.
4. **Text:** after you pause typing, three suggestions appear; click one to apply it.
5. **Images:** the selected image shows its prompt. Edit it (e.g. "violet glow" to "hot coral glow") and click **Regenerate**, or **Upload my own**.
6. The bottom bar shows *N of M components selected*. **Publish** sends only the selected variants; components without a selection keep their current content.

### AEM mode (`AEM_ENABLED=true`)
- Fetch reads `{AEM_HOST}{path}.infinity.json` and picks up **text**, **title**, **image** and **teaser** components under `jcr:content`. Images need a `/content/dam/` `fileReference` and are shown via an authenticated backend proxy. A teaser becomes two cards: its text (`Pretitle / Title / Description / CTA`) and its image. Other component types (e.g. accordion) and empty components are skipped.
- Teaser publish writes `pretitle`, `jcr:title`, `jcr:description` and the first button's text under `actions/`.
- **Image publish overwrites the DAM asset** the component's `fileReference` points at (Assets HTTP API `PUT /api/assets/...`), re-encoded to the asset's own format (a `.jpg` stays a JPEG). Every page using that asset will show the new image, so try it on a test asset first. In mock mode the image URL is just logged.
- Rich text is shown as plain text. Publishing rewrites it as simple `<p>` paragraphs, so inline formatting (bold, links) is lost.
- Publish sends a Sling POST per component to `{AEM_HOST}{jcrPath}` (`text` + `textIsRich=true`, or `jcr:title`). It **changes real content**, so try it on a scratch page first.

### Mock mode (`AEM_ENABLED=false`)
Serves deliberately bland, corporate NUVOX copy and plain grey placeholder images (`backend/static/mock-images/`, recreate with `python create_mock_images.py`) so the brand refresh is an instant contrast:
- `/content/nuvox/us/en/products/airwave-pro` (text, 2 images, accordion, teaser)
- `/content/nuvox/us/en/about-us`
- any other path returns a sample page. Publish only logs the payload.

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
- **`429 RESOURCE_EXHAUSTED`** – the Gemini project is out of quota. Wait, enable billing, or use a key from a different project or another model.
- **`404 ... models/... not found`** – `GEMINI_MODEL` isn't a valid model name for your key.
- **"Could not reach AEM"** – check `AEM_HOST` and that AEM is running. **"rejected the credentials"** – check `AEM_USER` / `AEM_PASSWORD`.
- **Variant cards empty or "Generation failed"** – make sure the backend is running on port 8000; the card shows the underlying error.
- **Slow first load** – a page with many components makes dozens of Gemini calls (capped at 8 at a time, with retries on rate limits), so expect 20-30 seconds.
