---
name: networking-intel
description: Generate a pre-meeting intelligence briefing on any individual to help build personal connection at a networking meeting. Trigger this skill whenever a user provides a person's name and email (and optionally company) and asks for background, a briefing, research, or "what should I know" before meeting them. Also trigger for phrases like "help me prepare to meet", "look up this person", "what can you find on", or "networking prep". Use ZoomInfo for professional data and web search for public content like articles, interviews, and social presence.
---

# Networking Intel Skill

## Purpose
Produce a structured pre-meeting briefing on an individual that helps the user build authentic personal connection. Output must be warm, not clinical. Avoid surfacing anything that would feel invasive or surveillance-like if referenced in conversation.

## Inputs Required
- First and last name
- Email address (used to look up the individual in ZoomInfo)
- Company name (optional but improves lookup accuracy)

## Data Sources and Order of Operations

### 1. ZoomInfo Lookup (use if ZoomInfo is a connected tool; skip gracefully if not)
Use `search_contacts` with name and email to get the ZoomInfo contact ID, then use `contact_research` to extract:
- Current title and company
- Career history and tenure
- Company size, industry, location
- Education

If ZoomInfo is not connected or returns no match, proceed to web search only and note the limitation in the output.

### 2. Web Search (always run regardless of ZoomInfo availability)
Run 2-3 targeted searches:
- `"[First Last]" [Company] interview OR article OR podcast OR keynote`
- `"[First Last]" [Company] LinkedIn`
- `"[First Last]" [Company] news OR announcement OR award`

Extract only publicly shared professional content. Do not pull from personal social media accounts (Instagram, Facebook, personal Twitter/X not used for professional content).

### 3. ZoomInfo Company Enrichment (optional, only if ZoomInfo is connected)
If the company context seems relevant to the meeting, use `enrich_companies` to get firmographic context.

---

## Output Format

Produce the following sections. Keep each section tight: 3-5 bullets max. Skip any section where data is thin or absent rather than padding with generic filler.

If ZoomInfo was not available or returned no match, open the briefing with:
> Data source: web search only. Professional history may be incomplete — ZoomInfo was not connected or returned no match.

If ZoomInfo was used successfully, no source note is needed.

---

**[Full Name] | [Title] at [Company]**

**Professional Snapshot**
- Current role, how long they've been there
- What the company does (one line)
- Prior roles or career arc worth knowing
- Education if notable or relevant

**What They Work On**
- Their functional area and scope
- Any known initiatives, launches, or projects they've led or been associated with
- Industry or domain expertise

**Public Presence**
- Articles, interviews, or podcasts they've appeared in or published
- Speaking engagements or events
- Any public positions or thought leadership themes they return to

**Personal Dimensions** *(only include what they've shared publicly in a professional context)*
- Causes, boards, or volunteer work they've mentioned
- Hobbies or interests surfaced in interviews or bios
- Geographic or community ties if relevant

**Conversation Starters**
Provide 3 specific, natural openers grounded in what was found. Each should feel like something a well-prepared person would say, not a talking point. Format as actual sentences the user could say out loud.

- "I saw you spoke at [event] last year on [topic] — what was the reception like from that audience?"
- "Your piece on [topic] in [publication] stuck with me. How has your thinking on that evolved?"
- "You've been at [Company] through what sounds like a big growth phase — what's changed most in your role?"

---

## Quality Rules

- If ZoomInfo returns no match, say so clearly and proceed with web search only
- If web search returns nothing substantive, say so and deliver only what ZoomInfo provided
- Never fabricate details or infer facts not found in sources
- Flag uncertainty: if something is unclear or unverified, note it
- Omit the Personal Dimensions section entirely if nothing was found in professional public context
- Conversation starters must reference specific found details, not generic templates
- Do not include home address, personal phone, relationship status, or anything sourced from non-professional personal accounts
