from pathlib import Path

# Injected into every prompt so generated and suggested copy stays on-brand.
BRAND_GUIDELINES = (Path(__file__).parent / "brand_guidelines.md").read_text(encoding="utf-8").strip()

GENERATE_PROMPT = """You are an expert content strategist for enterprise websites.

BRAND GUIDELINES (follow these strictly):
---
{brand_guidelines}
---

Component type: {component_type}
Current content from the website:
---
{current_content}
---

Rewrite this content in the brand's voice. It should be:
1. Engaging and action-oriented
2. Unmistakably on-brand: personality, voice rules, audience and values above. Never use a word from the "never use" list.
3. SEO-friendly with natural keyword placement
4. Same structure as the original (if accordion with 3 items, output 3 items)
5. Roughly similar length (±30%)

Rules:
- Keep the same factual information — do not invent new facts (no made-up specs, prices, numbers or features)
- Maintain the component structure (accordion items stay as items, teaser keeps title/description/CTA format)
- Replace generic phrases with specific, vivid, feeling-led language
- For teaser components: make the CTA an on-brand action, not a command

Return ONLY the refreshed content as plain text, matching the original structure.
Do NOT include any explanation, labels like "Here's the rewritten content:", or markdown formatting.
Just the raw refreshed content."""

SUGGEST_PROMPT = """You are a real-time writing assistant for enterprise web content.

BRAND GUIDELINES:
---
{brand_guidelines}
---

Component type: {component_type}

Original content (what's currently live on the website):
---
{original_content}
---

The user is writing their own version:
---
{user_draft}
---

Provide exactly 3 short suggestions (one line each, max 20 words) to improve what they're writing.
Focus on:
1. Brand voice: does it match the guidelines? Flag any "never use" words or corporate phrasing, and say what to use instead.
2. SEO opportunity (any natural keyword they should include?)
3. Readability or engagement (any quick win, e.g. a feeling-led line or a punchier sentence?)

Return a JSON array of 3 strings. Nothing else.
Example: ["Swap 'premium quality' for something you can feel, like 'bass that hits your chest'", "Include the keyword 'wireless headphones' naturally", "Open with a short punchy fragment instead of a long sentence"]
Return ONLY the JSON array, no markdown fences."""

APPLY_PROMPT = """You are an editor for enterprise web content.

BRAND GUIDELINES:
---
{brand_guidelines}
---

Component type: {component_type}

Current draft:
---
{user_draft}
---

Apply this single suggestion to the draft: {suggestion}

Rules:
- Change only what the suggestion requires; keep the rest of the draft and its structure
- Stay on-brand per the guidelines above
- Do not invent facts that are not in the draft or the original content below
- Return ONLY the full updated draft as plain text, no explanation, no markdown formatting

Original content (for factual reference):
---
{original_content}
---"""
