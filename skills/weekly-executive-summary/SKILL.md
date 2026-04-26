---
name: weekly-executive-summary
description: "Generate Ralph Nilssen's weekly executive summary and Ninety.io Headlines every Friday. Pulls emails, calendar, OneDrive files, and Zoom recordings from the current week and produces two polished Word documents saved to C:\\Users\\RalphNilssen\\Obsidian\\Claude\\outputs. Trigger this skill whenever Ralph asks for his weekly summary, Friday report, executive update, Ninety headlines, leadership update, or says anything like \"do my weekly,\" \"run the Friday summary,\" \"generate headlines,\" or \"write up my week.\" Trigger on context too, even without explicit naming."
---

# Weekly Executive Summary and Ninety Headlines

You are generating Ralph Nilssen's (Chief Sales Officer, DOXA Talent) weekly executive summary and Ninety.io headlines every Friday. This must produce two Word documents (.docx) saved to `C:\Users\RalphNilssen\Obsidian\Claude\outputs`.

## STEP 1: Gather Data

Run all queries before proceeding to Step 2.

### Emails (Received)

Use the Outlook email search tool. Search all folders except Deleted Items and Junk for emails received by ralph.nilssen@doxatalent.com. The search window runs from Saturday 12:00 AM of the prior weekend through Friday 3:00 PM of the current week. Set limit to 500.

### Emails (Sent)

Use the Outlook email search tool. Search the Sent folder for emails sent by ralph.nilssen@doxatalent.com using the same search window: Saturday 12:00 AM of the prior weekend through Friday 3:00 PM of the current week. Set limit to 500.

Combine the results of both email queries and deduplicate any messages that appear in both sets before proceeding.

### Calendar

Use the Outlook calendar search tool. Search with query "*" between Monday 12:00 AM and Friday 3:00 PM of the current week. Set limit to 50.

### OneDrive Files

Use the SharePoint search tool. Scope the search to doxaseven-my.sharepoint.com/personal/ only. Search with query "*" and filter by afterDateTime/beforeDateTime for the current week in ISO 8601 format. Set limit to 50.

### Zoom Recordings

Use the Zoom MCP to capture meeting content that the email and calendar pulls will not reveal on their own. Real decisions and risk signals often live inside the call, not the invite.

1. Call `recordings_list` for Ralph's account between Monday 12:00 AM and Friday 3:00 PM of the current week. For every recording returned, capture meeting title, date/time, duration, participants, and the recording ID.
2. If `recordings_list` returns nothing, fall back to `search_meetings` with a wildcard or with keywords tied to active deals, clients, or projects surfaced in the email and calendar results.
3. For any meeting that looks material (title mentions a client/deal, participants include leadership or external stakeholders, or it overlaps with a Top 10 candidate), pull the summary via `get_meeting_assets`. Use the AI summary, not the raw transcript. If a summary is unavailable and the meeting clearly matters, retrieve the transcript via `get_file_content` and extract key decisions and action items.
4. Do not dump raw transcripts into either output document. Zoom content is input for prioritization and context, not a standalone section.

### Zoom Notes

Zoom Notes are the AI Companion meeting notes tied to Ralph's calls. They contain decisions, action items, and discussion context that often never appear in email or calendar data. Pull and read every note from the week.

1. Call `search_zoom` with `search_entities: [{entity_type: "zoom_doc", filters: {doc_view: "notes"}}]` and `page_size: 100`. The API does not accept date filters on `zoom_doc`, so retrieve the full set and filter client-side by `create_time` to the window from Saturday 12:00 AM of the prior weekend through Friday 3:00 PM of the current week. Use UTC for the comparison.
2. For every note inside the window, call `get_file_content` with the `file_id` to retrieve the full markdown body. This applies to notes with generic titles (e.g., "Ralph Nilssen's notes") as well, since title alone cannot reveal content.
3. Extract per note: meeting title, date/time, participants (inferred from title or body), key outcomes, decisions made, action items, and any named clients, deals, dollar figures, or risk signals.
4. Feed Zoom Notes into Top 10 prioritization alongside emails, calendar, and recordings. A note that documents a decision, unblocks a deal, surfaces a risk, or aligns leadership belongs in the Top 10 even with no email trail.
5. Do not create a standalone Zoom Notes section in either output document. Notes are input for prioritization, Headlines context, and specificity (names, numbers, dates) only.

## STEP 2: Analyze and Categorize

From the gathered data, identify:

1. The top 10 most significant items that Ralph owns, drives, or contributed to materially. Apply the Ownership Filter (defined after this list) before ranking. Within the qualified set, prioritize deals, revenue impact, strategic decisions, risks, and cross-functional issues. Zoom content (both recordings and notes) informs this list: a call that moved a deal, surfaced a risk, or aligned leadership belongs in the Top 10 only if Ralph owned or contributed to the outcome, not if he was informed or attended.
2. Non-recurring calendar meetings vs. recurring 1:1s and standing meetings.
3. Key email threads organized by: Deals/Pipeline, Operations/Finance, Team/Talent, Strategic, Admin.
4. All sent emails with date, subject, and action taken.
5. All OneDrive files modified this week, categorized by: Revenue/Sales, Franchise, Sales Enablement, Contracts, Service Delivery, Notes.

Zoom recordings and Zoom Notes do not get their own section in the output. They feed Top 10 prioritization and Headlines context only.

### Ownership Filter

A Headline is something Ralph announces to the leadership team in first person. Ownership is the gate. Importance alone does not qualify an item.

Tag every candidate item as one of four roles:

1. Owner. Ralph is the decision-maker or workstream lead. He drove the outcome.
2. Contributor. Ralph does not own the workstream, but he made a material decision, provided an insight that changed direction, or took an action that moved it forward. The test: can Ralph credibly write this headline in first person without narrating someone else's work?
3. Synthesizer. Ralph authored a perspective by integrating signals across sources (external research, multiple internal incidents, cross-functional patterns, macro-environment data) into a strategic flag the leadership team needs to register. He does not own the underlying events. He owns the synthesis and the implications. The test: would the leadership team see this connection without Ralph drawing it?
4. Informed. Ralph was cc'd, attended the meeting, was briefed, or was made aware. He did not drive, contribute, or synthesize.

Owner, Contributor, and Synthesizer items qualify for Headlines. Informed items are disqualified regardless of strategic importance. The Weekly Summary Top 10 remains broad and can include all four roles, since that document is Ralph's personal week-in-review. The Headlines document is the external-facing subset.

Disqualification examples:

1. A client escalation where David Nilssen is running point. Informed. Disqualified.
2. A marketing workstream like UTM tracking or Meta ad restructuring where Ralph was made aware. Informed. Disqualified.
3. A CEO-led initiative like Q3 AI workshops replacing events. Informed. Disqualified.
4. A tech or IT issue Ralph was told about but does not own. Informed. Disqualified.

Qualification examples:

1. An AR collections posture where Lauren owns the proposal but Ralph drove sales-side enforcement with Michael Ross. Contributor. Qualified.
2. A Dynamics enhancement Ralph scoped and Chris shipped. Owner. Qualified.
3. A recurring Job Order quality issue where Ralph established the weekly Steffy meeting and reinforced standards. Owner. Qualified.
4. A macro-environment flag integrating external industry data (ASA, JPMorgan, Deloitte) with internal pipeline implications for Q3 forecasting. Synthesizer. Qualified.
5. A pattern-recognition headline tying together four unrelated CRM incidents from the week into a structural diagnosis the leadership team needs to register. Synthesizer. Qualified.

If the qualified set yields fewer than 10 items in a given week, submit fewer Headlines. Do not pad with Informed items to hit the number.

## STEP 3: Create Weekly Summary (.docx)

Use the docx skill (npm docx library) to create a professionally formatted Word document with:

- Title page: "Weekly Summary" with date range, Ralph Nilssen | Chief Sales Officer | DOXA Talent
- Header/footer on all pages with DOXA Talent branding and page numbers
- Navy blue (#1F3864) heading color, alternating row shading on tables
- US Letter size (12240 x 15840 DXA), 0.75" margins
- Sections: Top 10 table, Calendar (non-recurring then recurring), Key Email Threads (with bullet points using bold+normal text), Sent Emails table, Files table
- Validate using: `python scripts/office/validate.py [filepath]`

Save as: `Weekly_Summary_[date-range].docx`

## STEP 4: Create Ninety.io Headlines (.docx)

Convert the qualified Owner, Contributor, and Synthesizer items from Step 2 into Headlines for https://app.ninety.io/headlines. The Weekly Summary Top 10 may include Informed items; the Headlines document never does.

Each headline has a Title and a Description (max 65,000 characters).

### Audience and CI Profiles

The primary readers are the DOXA Leadership Team. The three most critical readers:

- David Nilssen (CEO). Culture Index: Persuader. High autonomy (~8), high sociability (~7), low detail (~2). Wants outcomes, momentum, the "so what." Scan-reads for impact. Lead with results and strategic implications.
- Stephen Hosemann (CFO). Culture Index: Scholar. High logic (~10), high compliance (~6), low sociability (~1). Wants numbers, precision, risk flags. Will interrogate the data. Include specific figures and financial implications.
- Lauren Hoover (COO). Culture Index: Architect. High autonomy (~9), high detail/patience (~7), low sociability (~2). Systems thinker. Wants to know what is working, what is broken, and what the fix is. Use process and systems language.

Other leadership team members:

- Steve Gire (CTO). Craftsman. Methodical, detail-oriented, technical.
- Christina Chambers (Chief Franchise Officer). Influencer. Social, relationship-driven.

### Tone Requirements (strict)

- Neutral. Never assign blame to anyone.
- Take responsibility and ownership where appropriate.
- Forward-thinking and solution-oriented. Always include what happens next.
- Write in first person as Ralph Nilssen (Chief Sales Officer), conversational but professional prose.
- Use numbered lists when itemizing incidents, implications, citations, framework questions, design considerations, or any set of parallel items the reader should track distinctly. Default to prose for narrative flow, transitions, and synthesis.
- Use paragraph breaks between distinct thoughts.
- Include specific names, numbers, and dates.
- Cite external sources with inline markdown links when integrating outside research or industry data.

### Title Conventions

Use one of two formats:

1. Short noun phrase, two to four words, for self-evident topics. Example: "Buyer Hesitation."
2. "Category: Specific Description" format when grouping by domain or function. Examples: "Account Management Redesign: Working Draft" or "Dynamics CRM: Systemic Gaps Affecting Sales Data, Routing, and Activity Capture."

No periods at the end of titles. No marketing framing, exclamation points, or rhetorical hooks.

### Calibrating Sign-Off

Most headlines close with a calibration line that tells the leadership team what response is and is not expected. This is especially important for Synthesizer headlines and for working drafts where the implied ask might otherwise be misread.

Standard formula:

"I am not asking for [a decision / a plan revision / action] this week. I am [flagging / asking the leadership team to register / surfacing] [the pattern / the dependency / the signal] before [trigger event]."

Skip the calibration line when the headline is a clean status update with a self-evident next step (e.g., a completed training rollout where the next step is already named in the body).

### Voice and Style Reference

Match the voice, structure, citation style, and length variance shown in `references/voice_examples.md`. Read the full file before drafting headlines. Each example is annotated with role classification, structural pattern (prose, numbered list, or mixed), use of external citations, sign-off pattern, and word count. Length range spans roughly 100 to 600 words depending on subject complexity. Do not pad short topics. Do not compress complex topics.

### Document formatting

Format the document with:

- Title page with week number and date
- Each headline as a numbered block with labeled TITLE and DESCRIPTION sections
- Character count displayed for each description
- Header/footer matching the weekly summary style
- Validate using: `python scripts/office/validate.py [filepath]`

Save as: `Headlines_Week[N]_[date].docx`

## STEP 5: Deliver

**Output folder:** `C:\Users\RalphNilssen\Obsidian\Claude`

Before writing the output files, connect this folder using `mcp__cowork__request_cowork_directory` with path `C:\Users\RalphNilssen\Obsidian\Claude`. Once connected, it mounts in bash at `/sessions/[session-id]/mnt/Claude/`. Use that bash path when writing files via shell commands or Node.js scripts.

Save both .docx files to `C:\Users\RalphNilssen\Obsidian\Claude`. Also save copies to the session outputs folder (`/sessions/[session-id]/mnt/outputs/`) as a fallback.

Provide computer:// links using the `C:\Users\RalphNilssen\Obsidian\Claude\` path. Give a brief summary of what was produced.