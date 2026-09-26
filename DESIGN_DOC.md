# Live Content Copilot — Design Document

## Overview
A standalone web app where users type/paste content into an editor. As they type, Gemini 3.8 Flash runs **6 parallel analysis streams** in the background and displays results in a live sidebar. No submit button. No chatbot. The AI thinks continuously while the user works.

## Architecture

```
Browser (React + Vite)
  └── ContentEditor (left pane, 60% width)
  └── AnalysisSidebar (right pane, 40% width, 6 cards)
  └── Debounce logic (2 second pause triggers analysis)
        │
        ▼  POST /api/analyze  { content: "..." }
        │
FastAPI Backend (Python)
  └── POST /api/analyze
        ├── Fires 6 Gemini calls in parallel (asyncio.gather)
        ├── Each call = 1 analysis dimension
        └── Returns JSON with all 6 results
        │
        ▼
Google Gemini 3.8 Flash API (gemini-3.8-flash)
```

## Tech Stack
- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Python FastAPI with async
- **AI**: Google Gemini 3.8 Flash via `google-genai` Python SDK
- **Deployment**: Frontend on Vercel, Backend on Render/Railway (or both via single Streamlit app as fallback)

---

## Frontend Specification

### Layout
Single page, two-pane horizontal split, dark theme.

```
┌─────────────────────────────────┬──────────────────────────┐
│                                 │   ANALYSIS SIDEBAR       │
│   CONTENT EDITOR                │                          │
│                                 │   ┌──────────────────┐   │
│   <textarea> or contenteditable │   │ SEO Score: 72/100│   │
│   Full height, monospace font   │   │ • Missing meta..  │   │
│   Placeholder: "Start typing   │   └──────────────────┘   │
│   or paste your content..."     │   ┌──────────────────┐   │
│                                 │   │ Readability: B+  │   │
│                                 │   │ • Grade level 8  │   │
│                                 │   └──────────────────┘   │
│                                 │   ┌──────────────────┐   │
│                                 │   │ Tone: Professional│  │
│                                 │   └──────────────────┘   │
│                                 │   ┌──────────────────┐   │
│                                 │   │ Issues: 3 found  │   │
│                                 │   └──────────────────┘   │
│                                 │   ┌──────────────────┐   │
│                                 │   │ Summary: ...     │   │
│                                 │   └──────────────────┘   │
│                                 │   ┌──────────────────┐   │
│                                 │   │ Suggestions: ... │   │
│                                 │   └──────────────────┘   │
│                                 │                          │
│   Word count: 342 | Chars: 1893 │   Status: Analyzing...   │
└─────────────────────────────────┴──────────────────────────┘
```

### Behavior
1. User types or pastes text into the editor.
2. A **2-second debounce** timer starts/resets on every keystroke.
3. When the timer fires:
   - Show "Analyzing..." spinner on each card
   - POST the full editor content to `/api/analyze`
4. On response, each card updates with its result. Cards that received data stop spinning.
5. If the user types again while analysis is in flight, **cancel the previous request** (AbortController) and restart the debounce.
6. Minimum content length to trigger: **50 characters**. Below that, show "Keep typing..." on the cards.

### Card Components
Each of the 6 analysis cards has:
- **Icon** (emoji is fine)
- **Title** (e.g., "SEO Analysis")
- **Score or grade** (prominent, large text)
- **2-4 bullet points** of detail
- **Color indicator**: green (good), yellow (needs work), red (issues)

### Cards (in order):
1. **SEO Score** — Score out of 100, keyword density, meta description quality, heading structure
2. **Readability** — Grade level (Flesch-Kincaid equivalent), sentence complexity, passive voice %
3. **Tone Analysis** — Detected tone (professional/casual/technical/marketing), consistency rating
4. **Content Issues** — Factual red flags, vague claims, missing citations, jargon overload
5. **Smart Summary** — 2-3 sentence summary of what the content says
6. **Improvement Suggestions** — Top 3 actionable rewrites or additions

---

## Backend Specification

### File: `main.py`

```
FastAPI app with CORS enabled for localhost:5173 and deployed frontend URL.
Single endpoint: POST /api/analyze
```

### POST /api/analyze

**Request body:**
```json
{
  "content": "string — the full text from the editor"
}
```

**Response body:**
```json
{
  "seo": {
    "score": 72,
    "color": "yellow",
    "bullets": [
      "No H1 heading detected",
      "Keyword density: 2.3% (good)",
      "Missing meta description suggestion",
      "Good internal linking opportunity on paragraph 3"
    ]
  },
  "readability": {
    "score": "B+",
    "color": "green",
    "bullets": [
      "Grade level: 8 (accessible)",
      "Average sentence length: 16 words",
      "Passive voice: 12% (acceptable)",
      "3 sentences over 30 words — consider splitting"
    ]
  },
  "tone": {
    "score": "Professional",
    "color": "green",
    "bullets": [
      "Consistent professional tone throughout",
      "Slight shift to casual in paragraph 4",
      "Marketing language detected in conclusion"
    ]
  },
  "issues": {
    "score": "3 Issues",
    "color": "red",
    "bullets": [
      "Paragraph 2: Unverified statistic '90% of users...'",
      "Paragraph 5: Vague claim 'industry-leading'",
      "Missing date reference for 'recent study shows'"
    ]
  },
  "summary": {
    "score": "Summary",
    "color": "green",
    "bullets": [
      "This content discusses the benefits of cloud migration for mid-size enterprises, covering cost savings, scalability, and security considerations."
    ]
  },
  "suggestions": {
    "score": "3 Tips",
    "color": "yellow",
    "bullets": [
      "Add a concrete case study or data point in paragraph 2",
      "Replace 'industry-leading' with a specific metric",
      "Add a clear CTA at the end"
    ]
  }
}
```

### Gemini Integration Logic

```python
import asyncio
from google import genai

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

ANALYSIS_PROMPTS = {
    "seo": """You are an SEO analyst. Analyze this content and return a JSON object with:
- "score": integer 0-100
- "color": "green" if score >= 75, "yellow" if >= 50, "red" if < 50
- "bullets": array of 3-4 short bullet strings (max 15 words each)
Focus on: keyword usage, heading structure, meta-readiness, content length.
Return ONLY valid JSON, no markdown fences.

Content to analyze:
{content}""",

    "readability": """You are a readability expert. Analyze this content and return a JSON object with:
- "score": letter grade (A+, A, B+, B, C+, C, D, F)
- "color": "green" if A/B range, "yellow" if C, "red" if D/F
- "bullets": array of 3-4 short bullet strings (max 15 words each)
Focus on: grade level, sentence length, passive voice, complexity.
Return ONLY valid JSON, no markdown fences.

Content to analyze:
{content}""",

    "tone": """You are a tone analyst. Analyze this content and return a JSON object with:
- "score": detected primary tone (e.g., "Professional", "Casual", "Technical", "Marketing")
- "color": "green" if consistent, "yellow" if mixed, "red" if conflicting
- "bullets": array of 3-4 short bullet strings (max 15 words each)
Focus on: tone consistency, audience match, voice shifts.
Return ONLY valid JSON, no markdown fences.

Content to analyze:
{content}""",

    "issues": """You are a content fact-checker. Analyze this content and return a JSON object with:
- "score": "X Issues" where X is the count (e.g., "3 Issues" or "No Issues")
- "color": "green" if 0 issues, "yellow" if 1-2, "red" if 3+
- "bullets": array of 3-4 short bullet strings (max 15 words each)
Focus on: unverified claims, vague statements, missing sources, outdated references.
Return ONLY valid JSON, no markdown fences.

Content to analyze:
{content}""",

    "summary": """You are a content summarizer. Analyze this content and return a JSON object with:
- "score": "Summary"
- "color": "green"
- "bullets": array containing exactly 1 string — a 2-3 sentence summary of the content
Return ONLY valid JSON, no markdown fences.

Content to analyze:
{content}""",

    "suggestions": """You are a content strategist. Analyze this content and return a JSON object with:
- "score": "X Tips" where X is the count
- "color": "yellow"
- "bullets": array of 3 actionable improvement suggestions (max 15 words each)
Focus on: what to add, what to rewrite, what to remove.
Return ONLY valid JSON, no markdown fences.

Content to analyze:
{content}"""
}

async def call_gemini(prompt: str) -> dict:
    """Single Gemini call. Returns parsed JSON or error fallback."""
    try:
        response = await asyncio.to_thread(
            client.models.generate_content,
            model="gemini-3.8-flash",
            contents=prompt
        )
        text = response.text.strip()
        # Strip markdown fences if present
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        return json.loads(text)
    except Exception as e:
        return {
            "score": "Error",
            "color": "red",
            "bullets": [f"Analysis failed: {str(e)[:80]}"]
        }

async def analyze_content(content: str) -> dict:
    """Fire all 6 Gemini calls in parallel and return combined results."""
    tasks = {
        key: call_gemini(prompt.format(content=content))
        for key, prompt in ANALYSIS_PROMPTS.items()
    }
    results = await asyncio.gather(*tasks.values())
    return dict(zip(tasks.keys(), results))
```

---

## Project File Structure

```
live-content-copilot/
├── backend/
│   ├── main.py              # FastAPI app with /api/analyze endpoint
│   ├── requirements.txt     # fastapi, uvicorn, google-genai
│   └── .env.example         # GEMINI_API_KEY=your-key-here
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── src/
│       ├── main.jsx          # React entry point
│       ├── App.jsx           # Main layout: Editor + Sidebar
│       ├── App.css           # Global styles (minimal, Tailwind handles most)
│       ├── components/
│       │   ├── Editor.jsx    # Left pane — textarea with debounce
│       │   ├── Sidebar.jsx   # Right pane — renders 6 AnalysisCards
│       │   └── AnalysisCard.jsx  # Single card (icon, title, score, bullets, color)
│       └── hooks/
│           └── useAnalysis.js  # Custom hook: debounce + fetch + abort logic
├── README.md
└── .gitignore
```

---

## Key Implementation Details

### Debounce + Abort (useAnalysis.js)
```
- Store AbortController ref
- On content change: clear previous timer, abort previous fetch
- Set new 2-second timer
- On timer fire: create new AbortController, POST to /api/analyze
- On response: update state
- On abort: do nothing (new request is coming)
```

### Error Handling
- If Gemini returns invalid JSON: show "Analysis failed" in that card, other cards still work
- If network error: show "Backend unreachable" banner at top
- If content < 50 chars: show "Keep typing..." in all cards, don't call API

### CORS
Backend must allow:
- `http://localhost:5173` (dev)
- The deployed frontend URL (prod)

### Environment Variables
- `GEMINI_API_KEY` — Google AI Studio API key (required)

---

## AEM Extension (ONLY IF TIME PERMITS)

Add an optional input field at top of the page:
- User pastes an AEM page URL like `http://localhost:4502/content/mysite/en/homepage.html`
- Backend fetches `{url}.infinity.json`, extracts all `text`, `jcr:title`, `jcr:description` properties recursively
- Populates the editor with the extracted text
- Analysis runs automatically

This is a **nice-to-have**. The core app works without it.

---

## Deployment Plan

### Option A: Separate deploy (preferred)
- Frontend → Vercel (connect GitHub repo, auto-deploy)
- Backend → Render free tier (Dockerfile or pip install)

### Option B: Single app fallback
- Rewrite as Streamlit app (editor + sidebar in Streamlit columns)
- Deploy to Streamlit Community Cloud
- Simpler but less polished UI

---

## Demo Script (for recording)
1. Open the app — empty editor, all cards show "Waiting for content..."
2. Start typing a marketing paragraph — cards stay idle during typing
3. Pause for 2 seconds — all 6 cards flash "Analyzing..." spinners
4. Cards fill in one by one (parallel results arriving)
5. Show an issue: type a vague claim like "We are the industry leader"
6. Pause — Issues card turns red, flags the vague claim
7. Fix the claim — pause — Issues card turns green
8. Paste a large blog post — show all cards update simultaneously
9. Highlight the speed: "6 parallel Gemini 3.8 Flash calls, results in under 2 seconds"
