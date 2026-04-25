---
name: account-manager-inbox-analysis
description: >
  Analyze a DOXA account manager's Outlook inbox to produce a structured Word document intelligence report. Triggers on the slash command /aminbox or when anyone asks to analyze Michael Ross's (or any AM's) email, run an inbox report, review AM email patterns, check account workload, or asks "what issues is Michael dealing with." Also triggers for recurring weekly or monthly AM inbox reports. Covers: client issue trends, employee question patterns with attribution, daily net email volume, TL/OM email frequency, account workload distribution, CC traffic patterns, response time signals, sentiment indicators, and capacity risk flags. Output is a date-prefixed .docx file saved to /Users/ralph/Documents/Claude/Projects/am-inbox-analysis/. Uses Microsoft 365 for email access and docx-js for document generation.
---

# Account Manager Inbox Analysis Skill

Triggered by: `/aminbox` or any natural language request to analyze an AM's inbox.

Produces a Word document (.docx) saved to `/Users/ralph/Documents/Claude/Projects/am-inbox-analysis/`.
Filename format: `YYYY-MM-DD-AM-Inbox-Report-Michael-Ross.docx` (date prefix = date the report is run)

## Parameters (collect or use defaults)

| Parameter | Default | Notes |
|---|---|---|
| `mailbox` | michael.ross@doxatalent.com | Must have M365 delegate access |
| `start_date` | 2026-01-01 | ISO format |
| `end_date` | today | ISO format |
| `internal_domain` | doxatalent.com | Emails from this domain = internal |
| `max_batches` | 40 | 50 emails per batch = up to 2,000 deduplicated emails (full range) |

## TL/OM Reference List

Match by first name + last name against sender display names and email localparts.

Aldair Vargas, Alexandria Tomonton, Annie Jimeno, Banjo Morales, Benny Castillo, Catherine Palma, Dyna Gallarda Llorca, Elena Barreneche, Ethel Matutina, Francis Rheberg, Ivan Villamante, Janette Darnayla, John Mark Robles, Jonathan Sanchez, Joshua Duban, Josimar Rincon, Juanito Cruzada, Julie Robles, Justin Linatoc, Kristine Osis, Lucille Ramos, Luis Bernabe, Maria Christina Carter, Mary Subastil, Michael Siega, Nancy Del Pilar, Ricardo Cueto Perneth, Rodrigo Inso, Roland Villegas Esguerra, Romar (Andi) Muñoz, Ronell Nicor, Ruelin Francisco, Ruther Salas, Shiena Morales, Vanessa Jamison, Veron (Nika) Gonzaga, Vincent Manalansan

---

## Step 1: Pull and Deduplicate Emails

Pull inbox in batches of 50 using `offset` pagination with `mailboxOwnerEmail: michael.ross@doxatalent.com`. Deduplicate strictly by `internetMessageId` — the same email appears 4-8x in results with different message IDs. Keep only the first occurrence of each `internetMessageId`.

Continue until results return fewer than 50 (end of results) or `max_batches` is reached.

Collect per unique email: `sender`, `recipients`, `subject`, `summary`, `receivedDateTime`, `importance`, `hasAttachments`, `internetMessageId`

---

## Step 2: Classify Emails

### 2a. Filter Noise First

**NOISE** — exclude from all analysis. Sender or subject matches any of:
- Domains: ninety.io, ess.barracudanetworks.com, calendly.com, circle.so, mindvalley.com, alert.refer.io
- Senders: postmaster@doxatalent.com
- Subject patterns: "unsubscribe", "weekly digest", "daily update", "quarantine notification", "held messages", "new held messages"
- Any domain ending in .info with unsolicited pitch patterns

**AMBIGUOUS** — cold outreach with unsolicited pitch language. Count separately, exclude from all analysis.

### 2b. Classify Remaining Emails by Type

**INTERNAL** — sender domain is doxatalent.com
- Sub-classify: matches TL/OM list → `TL_OM`; otherwise → `DOXA_OTHER`

**CLIENT** — external domain, not noise, not cold outreach
- Extract domain as account identifier (fusiontek.com → Fusiontek, agiliit.com → Agile IT)

### 2c. Classify Each Email as DIRECT or CC

CC emails consume attention and require a judgment call even when no action follows. They count toward workload but are excluded from the issues and questions AI analysis. Apply these proxy rules (in order — first match wins):

**Treat as CC (informational/passive):**
- Subject starts with `FW:` or `FWD:`
- Subject contains "Weekly", "Report", "Update", "Notification", "Digest", "Summary", or "Alert"
- Recipients list contains 4 or more distinct email addresses
- Sender is a shared/group mailbox (e.g., recruitment@, accounting.ph@, servicedesk@, co.servicedelivery@)

**Treat as DIRECT (action-expected):**
- Michael is the only @doxatalent.com recipient, OR
- Subject starts with `Re:` with 2 or fewer total recipients, OR
- Email is marked `importance: high`

**Default:** if none of the above match, treat as DIRECT.

Tag each non-noise email with both its type (INTERNAL/CLIENT) and its mode (DIRECT/CC).

---

## Step 3: Build Raw Metrics

**Volume**
- Total pulled (raw) vs deduplicated vs net actionable (INTERNAL + CLIENT)
- Noise rate % and cold outreach count
- DIRECT count vs CC count (and CC as % of net actionable)
- Avg net emails per business day (count business days in range)
- Peak day (most net emails), trough day (fewest)

**TL/OM breakdown**
- For every person on the TL/OM reference list: total emails sent to Michael, split into DIRECT vs CC
- Sort by total descending. Flag zeros as "(no contact in period)"

**Account breakdown**
- For each external domain: total email count, split DIRECT vs CC
- Sort by total descending, take top 10

**High-importance emails**
- Count total and by sender domain

---

## Step 4: AI Analysis via Anthropic API

Use `claude-sonnet-4-20250514`, max_tokens 4000. Pass only DIRECT-mode emails to all three calls. CC-mode emails feed only the CC Traffic analysis in Step 5.

**Call A — Client Issues**
System: "You are analyzing email summaries from a DOXA Talent account manager's inbox. These are emails directed TO the account manager, not CC copies. Identify the top 10 recurring issues, concerns, or action items. For each: concise name, estimated email count, which client accounts are involved, and status: resolved / open / recurring. Return a JSON array only, no other text."
Input: CLIENT + DIRECT summaries (subject + summary + sender domain + date)

**Call B — Employee Questions**
System: "Identify the top 10 questions or recurring asks that internal DOXA employees direct to this account manager. These are emails sent TO Michael, not CC copies. For each: concise question name, specific sender names (first and last), frequency estimate, and whether it should be self-served via documentation or genuinely requires AM judgment. Return a JSON array only, no other text."
Input: INTERNAL + DIRECT summaries (subject + summary + sender name + date)

**Call C — Account Health Signals**
System: "Based on these email summaries, identify: (1) accounts showing friction or dissatisfaction, (2) accounts with low or no direct contact that may indicate disengagement, (3) accounts with escalation patterns. Return JSON with three arrays: friction_accounts, silent_accounts, escalation_accounts. No other text."
Input: CLIENT + DIRECT emails grouped by domain

**Call D — CC Traffic Patterns**
System: "These are emails where the account manager was CC'd rather than the primary recipient. Identify: (1) the top senders who copy the account manager most and on what topics, (2) whether the CC pattern appears to be for visibility, cover, or genuine need-to-know, (3) any CC threads that likely required the account manager's action anyway. Return JSON with keys: top_cc_senders (array with name, count, topics, pattern_type), action_required_ccs (array with subject and sender), cc_reduction_opportunities (array of suggestions). No other text."
Input: all CC-mode emails (INTERNAL + CLIENT), grouped by sender

---

## Step 5: Generate Word Document

Install docx-js if needed: `npm install -g docx`

### Document Sections

1. Cover: "Account Manager Inbox Report — Michael Ross", date range subtitle, generated date
2. Period Summary (table)
3. Top 10 Client Issues — DIRECT emails only (table)
4. Top 10 Employee Questions — DIRECT emails only (table)
5. Email Volume by TL/OM — total, DIRECT, CC split (table)
6. Top 10 Accounts by Volume — total, DIRECT, CC split (table)
7. CC Traffic Summary — who copies Michael, why, and reduction opportunities (narrative + table)
8. Account Health Signals (three subsections: friction, silent, escalation)
9. Capacity and Risk Flags (bullets)

### Section 2: Period Summary Table

| Metric | Value |
|---|---|
| Date range | start_date to end_date |
| Business days covered | N |
| Total emails (raw pulled) | N |
| Deduplicated total | N |
| Noise / automated filtered | N (X%) |
| Cold outreach filtered | N |
| Net actionable | N |
| — Direct (TO Michael) | N (X%) |
| — CC / group traffic | N (X%) |
| Avg per business day (net) | N |
| High-importance emails | N |
| Peak day | date (N emails) |

### Section 7: CC Traffic Summary

This section answers: is Michael being looped in appropriately, or is CC volume creating unnecessary overhead?

Include:
- Total CC emails and as % of net volume
- Top 5 CC senders with topic summary
- Count of CC emails that likely required action anyway (attention tax with no escape)
- Specific reduction opportunities (e.g., "Recruitment report threads: Michael copied on every reply — consider moving to weekly summary only")

### docx-js Pattern

```javascript
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType } = require('docx');
const fs = require('fs');

// Page: US Letter, 1-inch margins (content width = 9360 DXA)
const pageProps = {
  page: {
    size: { width: 12240, height: 15840 },
    margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
  }
};

const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

// Header row: white text on navy (1F3864), ShadingType.CLEAR
// Data rows: alternate F2F2F2 and FFFFFF
// Always set both columnWidths on Table AND width on each TableCell (DXA only, never PERCENTAGE)

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal",
        run: { size: 30, bold: true, font: "Arial", color: "1F3864" },
        paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal",
        run: { size: 24, bold: true, font: "Arial", color: "2E74B5" },
        paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 1 } },
    ]
  },
  sections: [{ properties: pageProps, children: [ /* all content */ ] }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('/home/claude/report.docx', buffer);
  console.log('Done');
});
```

Column width sets (must sum to 9360 DXA):
- 2-col equal: [4680, 4680]
- 2-col 1/3+2/3: [3120, 6240]
- 3-col equal: [3120, 3120, 3120]
- 4-col (name+total+direct+cc): [3120, 2080, 2080, 2080]
- 5-col (rank+issue+accounts+freq+status): [936, 2808, 2808, 1404, 1404]

After generating, validate:
```bash
python /mnt/skills/public/docx/scripts/office/validate.py /home/claude/report.docx
```

---

## Step 6: Save Output

**Determine today's date** for the filename prefix (format: YYYY-MM-DD).

**Target folder:** `/Users/ralph/Documents/Claude/Projects/am-inbox-analysis/`
Dedicated to this skill's outputs. Do not save elsewhere. If missing, create with `Filesystem:create_directory`.

**Filename:** `YYYY-MM-DD-AM-Inbox-Report-Michael-Ross.docx`
Example: `2026-04-25-AM-Inbox-Report-Michael-Ross.docx`

**Save steps:**
1. Generate and validate the docx at `/home/claude/YYYY-MM-DD-AM-Inbox-Report-Michael-Ross.docx`
2. Use `Filesystem:write_file` to write to `/Users/ralph/Documents/Claude/Projects/am-inbox-analysis/YYYY-MM-DD-AM-Inbox-Report-Michael-Ross.docx`
3. Confirm the full save path in chat
4. Call `present_files` for an in-chat download link

---

## Recurring Report Mode

Accept a `comparison_period` parameter (previous week or month). Compute delta metrics: volume change, direct vs CC ratio shift, new issues vs resolved, new TL/OM patterns, new client domains, accounts that went silent. Each run produces a new date-prefixed file; prior runs are preserved for historical comparison.

---

## Error Handling

- M365 auth error: verify Michael's mailbox has delegate sharing enabled with Mail.Read.Shared permission
- Fewer than 20 unique emails after dedup: warn of possible incomplete results
- Anthropic API failure: fall back to keyword frequency on subject lines, note degraded accuracy
- Filesystem write failure: fall back to present_files only and note the path
- TL/OM with no email matches: include in table with count = 0, flag as "(no contact)"
- Output folder missing: create with Filesystem:create_directory before writing

---

## File Locations

- Output folder: `/Users/ralph/Documents/Claude/Projects/am-inbox-analysis/`
- GitHub skill: `/Users/ralph/Documents/GitHub/Ralph-Claude-Connector/skills/account-manager-inbox-analysis/SKILL.md`
- Obsidian vault root: `/Users/ralph/Documents/Claude/`
