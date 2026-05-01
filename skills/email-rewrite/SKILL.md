---
name: email-rewrite
description: Rewrites Lindy AI email drafts in Ralph Nilssen's voice. Trigger immediately and without asking when the user types #rewrite. Goes into the Rewrite Queue folder in Outlook, pulls each draft, finds the original inbound thread and any related context threads across the inbox, then delivers each rewrite as a clean standalone copy-ready block. Never bundle rewrites together. Always deliver one per email with a clear header. This skill requires the Microsoft 365 MCP tool to access Outlook.
---

# Email Rewrite Skill

## Purpose

Ralph uses Lindy AI to draft email replies. When Lindy's drafts are not good, Ralph moves them to a folder called **Rewrite Queue** in Outlook, then types `#rewrite` in Claude. This skill handles everything from there.

## Trigger

`#rewrite` typed anywhere in the conversation. Execute immediately. Do not ask clarifying questions first.

---

## Workflow

### Step 1: Pull the Rewrite Queue

Search Outlook for all items in the Rewrite Queue folder:

```
folderName: "Rewrite Queue"
limit: 20
```

For each item found, read the full message content via `read_resource`.

If Rewrite Queue is empty, tell Ralph and stop.

---

### Step 2: Find the Original Inbound Email

Each draft in Rewrite Queue is a reply to an inbound email. Identify the original email by:

- The subject line (strip "Re:" prefix and search)
- The sender the draft is addressed to
- The conversationId if visible in the draft metadata

Read the full original inbound email to understand exactly what was asked, stated, or requested.

---

### Step 3: Search for Related Context Threads

This is the most important step and what separates a good rewrite from Lindy's generic output. Before writing anything, search the inbox for related threads that add relevant context.

Ask: what else has been discussed recently that bears on this email?

Search strategies:
- Search by the same sender or recipient to find prior exchanges
- Search by topic keywords from the subject or body
- Search by other participants copied on the thread
- Look for threads that resolve questions raised in the inbound email (e.g., a separate decision made by another team member that changes the answer)

Read full content of any relevant threads found. Synthesize what they add before writing.

If a related thread resolves the core issue in the inbound email, that resolution must be reflected in the rewrite. Do not write a holding reply when a definitive answer already exists.

---

### Step 4: Write the Rewrite

Apply Ralph's voice and standards:

**Voice and tone**
- Direct, warm, confident, MBA-level precision
- Peer-to-peer regardless of recipient seniority
- Takes a position immediately rather than deferring
- Does not over-explain or hedge
- Does not use filler phrases like "Happy to help", "Great question", "As discussed", or "I hope this finds you well"
- No em dashes anywhere
- No bullet points unless the content is genuinely list-like and the recipient would expect them
- Sentences are complete and clear; no run-ons

**Structure**
- Lead with the decision or the answer, not context
- Supporting rationale follows if needed, kept brief
- Close with a clear next step, owner, or timeline when one is warranted
- Do not sign off with "Best," "Thanks," or similar unless the email is very brief and conversational in nature, in which case a single word close is fine

**Audience awareness**
- Internal DOXA team: direct, no formality required, use first names
- Franchisees: warm but professional, avoid anything that reads as directive or threatening given the franchise relationship
- External vendors or partners: confident and peer-level, not overly formal
- David Nilssen (CEO): peer-level, concise, never deferential
- Lauren Hoover, Stephen Hosemann, Steve Gire, Christina Chambers: peer-level colleagues

**What to never include**
- References to Guidant Financial in any DOXA leadership communication
- Commitments to meetings or hard deadlines unless Ralph has explicitly confirmed them
- Anything that sounds like it was written by an AI

---

### Step 5: Deliver Each Rewrite

Present each rewrite as a fully standalone block. Format exactly as follows:

---

**TO:** [recipient name(s)]
**SUBJECT:** [subject line]

[rewrite body, ready to copy and paste]

---

One block per email. Never combine multiple rewrites into a single block. Never add commentary above or below the block unless a specific flag or question is warranted (see below).

---

## Flags and Edge Cases

**If the inbound email cannot be found:** Note it briefly above the block and rewrite based on the draft content alone with a caveat that full context was unavailable.

**If a related thread changes the answer materially:** Incorporate it silently into the rewrite. Do not explain the sourcing inside the email. The rewrite should read as if Ralph wrote it with full awareness.

**If the draft is addressing the wrong person or wrong thread:** Flag it above the block before delivering the rewrite.

**If the draft is a shell with no content (signature only, no body):** Skip it and note it was skipped with the subject or recipient if available.

**If the draft requires information Ralph would need to provide (a specific date, a number, a name):** Include a bracketed placeholder like [confirm date] so Ralph can fill it before sending.

---

## Example Output Format

---

**TO:** Steve Gire, Chris Olds
**SUBJECT:** Re: Qualified Leads Automation

Steve, good catch and good timing on the flag. Go ahead and proceed with the automation.

Context that closes the loop on Lara's concern: Maureen confirmed to Lauren and me last week that the AI vertical is being retired for Q2. The new PPC focus is VAs and a second vertical still being finalized, likely accounting or a role-based category like customer service. The off-intent clicks Lara referenced were a symptom of the old campaign targeting, not the direction we're heading. Once the new verticals are live, the leads coming through will be materially better qualified.

Automating the ingestion now actually sets us up well. When the new campaigns launch, the pipeline won't require manual intervention to get leads into Dynamics.

One thing worth flagging to Qualified Leads before you finalize the design: make sure the intake fields and lead source tagging can accommodate multiple PPC verticals cleanly. We don't want everything dumped into a single bucket when we go live with two distinct audiences.

---
