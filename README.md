# AEM Content Refresh Copilot

Enter an AEM page path and see each component's current content next to a Gemini-refreshed, **on-brand** version. Edit the right side and get live suggestions (2-second debounce), then publish back to AEM.

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
| `GEMINI_MODEL` | `gemini-3.8-flash` | Use a model your key has quota for, e.g. `gemini-3-flash-preview`. |
| `AEM_ENABLED` | `false` | `false` = mock pages, `true` = real AEM. |
| `AEM_HOST` | `http://localhost:4502` | AEM author instance. |
| `AEM_USER` / `AEM_PASSWORD` | `admin` / `admin` | Basic auth for fetch and publish. |
| `FRONTEND_URL` | – | Extra CORS origin for deployed frontends. |

## Using it

1. Enter an AEM page path, e.g. `/content/aisearchspa/us/en/home`, and click **Fetch content**.
2. Gemini rewrites every component in parallel. Each card shows *Before* (read-only) and *After* (editable), with a status of Original, AI generated or User edited. **Regen** re-runs a single component.
3. Edit the right side. After you pause typing, three suggestions appear; click one to apply it.
4. Click **Publish** to write the content back to AEM.

### AEM mode (`AEM_ENABLED=true`)
- Fetch reads `{AEM_HOST}{path}.infinity.json` and picks up **text** and **title** components under `jcr:content`. Other component types and empty components are skipped.
- Rich text is shown as plain text. Publishing rewrites it as simple `<p>` paragraphs, so inline formatting (bold, links) is lost.
- Publish sends a Sling POST per component to `{AEM_HOST}{jcrPath}` (`text` + `textIsRich=true`, or `jcr:title`). It **changes real content**, so try it on a scratch page first.

### Mock mode (`AEM_ENABLED=false`)
Serves deliberately bland, corporate NUVOX copy from `backend/mock_data.py` so the brand refresh is an instant contrast:
- `/content/nuvox/us/en/products/aura-headphones` (text, accordion, teaser)
- `/content/nuvox/us/en/about-us`
- any other path returns a sample page. Publish only logs the payload.

## Brand guidelines

All Gemini prompts (generate, suggest, apply) include `backend/brand_guidelines.md`, the NUVOX voice, audience, values and banned phrases. Edit that file and restart the backend to change the brand; the prompts are in `backend/prompts.py`.

## API
- `GET /api/fetch-page?path=` – components on the page
- `POST /api/generate` – parallel Gemini rewrite, one call per component
- `POST /api/suggest` – 3 suggestions on the user's draft
- `POST /api/apply` – applies one clicked suggestion to the draft
- `POST /api/publish` – writes content to AEM (or logs it in mock mode)
- `GET /api/health`

## Troubleshooting
- **`429 RESOURCE_EXHAUSTED`** – the Gemini project is out of quota. Wait, enable billing, or use a key from a different project or another model.
- **`404 ... models/... not found`** – `GEMINI_MODEL` isn't a valid model name for your key.
- **"Could not reach AEM"** – check `AEM_HOST` and that AEM is running. **"rejected the credentials"** – check `AEM_USER` / `AEM_PASSWORD`.
- **Sidebar/cards empty** – make sure the backend is running on port 8000.
