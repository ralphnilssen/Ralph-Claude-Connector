---
name: weekly-executive-summary
description: Generate Ralph Nilssen's weekly executive summary and Ninety.io Headlines every Friday. Pulls emails, calendar, OneDrive files, and Zoom recordings from the current week and produces two polished Word documents saved to the outputs folder. Trigger this skill whenever Ralph asks for his weekly summary, Friday report, executive update, Ninety headlines, leadership update, or says anything like "do my weekly," "run the Friday summary," "generate headlines," or "write up my week." Trigger on context too, even without explicit naming.
---

# Weekly Executive Summary and Ninety Headlines

You are generating Ralph Nilssen's (Chief Sales Officer, DOXA Talent) weekly executive summary and Ninety.io headlines every Friday. This must produce two Word documents (.docx) saved to the outputs folder.

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

## STEP 2: Analyze and Categorize

From the gathered data, identify:

1. The top 10 most significant items for the executive team. Prioritize deals, revenue impact, strategic decisions, risks, and cross-functional issues. Zoom content informs this list: a call that moved a deal, surfaced a risk, or aligned leadership belongs in the Top 10 even without an email trail.
2. Non-recurring calendar meetings vs. recurring 1:1s and standing meetings.
3. Key email threads organized by: Deals/Pipeline, Operations/Finance, Team/Talent, Strategic, Admin.
4. All sent emails with date, subject, and action taken.
5. All OneDrive files modified this week, categorized by: Revenue/Sales, Franchise, Sales Enablement, Contracts, Service Delivery, Notes.

Zoom meetings do not get their own section in the output. They feed Top 10 prioritization and Headlines context only.

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

Convert the top 10 items into Headlines for https://app.ninety.io/headlines.

Each headline has a Title and a Description (max 65,000 characters).

### Audience and CI Profiles

The primary readers are the DOXA Leadership Team. The three most critical readers:

- David Nilssen (CEO) — Culture Index: Persuader. High autonomy (~8), high sociability (~7), low detail (~2). Wants outcomes, momentum, the "so what." Scan-reads for impact. Lead with results and strategic implications.
- Stephen Hosemann (CFO) — Culture Index: Scholar. High logic (~10), high compliance (~6), low sociability (~1). Wants numbers, precision, risk flags. Will interrogate the data. Include specific figures and financial implications.
- Lauren Hoover (COO) — Culture Index: Architect. High autonomy (~9), high detail/patience (~7), low sociability (~2). Systems thinker. Wants to know what is working, what is broken, and what the fix is. Use process and systems language.

Other leadership team members:

- Steve Gire (CTO) — Craftsman. Methodical, detail-oriented, technical.
- Christina Chambers (Chief Franchise Officer) — Influencer. Social, relationship-driven.

### Tone Requirements (strict)

- Neutral. Never assign blame to anyone.
- Take responsibility and ownership where appropriate.
- Forward-thinking and solution-oriented. Always include what happens next.
- Write in first person as Ralph Nilssen (Chief Sales Officer), conversational but professional prose. No bullet points.
- Use paragraph breaks between distinct thoughts.
- Include specific names, numbers, and dates.

### Voice examples

Match the voice and style of these examples:

**Example 1:** "I took several steps this week to tighten our approach to accounts receivable on the sales side. I engaged Michael Ross to follow up with all past-due clients along with a heads-up that there is a proposal circulating to restrict job order placement for clients who are late on payment. I discussed Lauren's 'Proposal: Clients with Aging AR' this week and gave some minor suggestions. All of these efforts are converging toward a more consistent collections posture."

**Example 2:** "Exciting progress this week. We released an update to the Opportunity object in Dynamics 365 that removes the 24-hour delay in contract status changes. Previously, when an MSA was sent through Adobe Sign, Dynamics wouldn't reflect the contract status until the next day. Chris shipped an enhancement that now updates Dynamics within five minutes of the MSA being sent and countersigned. This closes a visibility gap and strengthens our ability to manage active deals in real time."

**Example 3:** "Over the past few weeks, we have seen a pattern of Job Orders submitted with incomplete, inaccurate, or misaligned information in Dynamics. While these issues are being corrected as they surface, they are creating avoidable rework, delays at the front of the recruiting process, and additional time spent aligning across Sales and Recruitment. The impact shows up first in Recruitment through follow-up, clarification, and rework, and then downstream in candidate experience and client communication. As volume increases, this level of friction is not sustainable. Steffy and I are now meeting weekly to review issues as they arise, clarify expectations, and address recurring gaps. In parallel, we are reinforcing clearer submission standards and alignment across Sales, Franchisees, and Recruitment to reduce wasted motion and protect recruiting capacity."

### Document formatting

Format the document with:

- Title page with week number and date
- Each headline as a numbered block with labeled TITLE and DESCRIPTION sections
- Character count displayed for each description
- Header/footer matching the weekly summary style
- Validate using: `python scripts/office/validate.py [filepath]`

Save as: `Headlines_Week[N]_[date].docx`

## STEP 5: Deliver

Save both .docx files to the outputs folder. Provide computer:// links to both files. Give a brief summary of what was produced.
