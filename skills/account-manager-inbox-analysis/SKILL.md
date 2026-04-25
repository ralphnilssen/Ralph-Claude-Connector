---
name: account-manager-inbox-analysis
description: >
  Analyze a DOXA account manager's Outlook inbox to produce a structured Word document intelligence report. Triggers on the slash command /aminbox or when anyone asks to analyze Michael Ross's (or any AM's) email, run an inbox report, review AM email patterns, check account workload, or asks "what issues is Michael dealing with." Also triggers for recurring weekly or monthly AM inbox reports. Covers: client issue trends, employee question patterns with attribution, daily net email volume, TL/OM email frequency, account workload distribution, routine traffic volume, and capacity risk flags. Output is a date-prefixed .docx file saved to /Users/ralph/Documents/Claude/Projects/am-inbox-analysis/. Uses Microsoft 365 for email access and docx-js for document generation.
---

# Account Manager Inbox Analysis Skill

Triggered by: `/aminbox` or any natural language request to analyze an AM's inbox.

Produces a Word document (.docx) saved to `/Users/ralph/Documents/Claude/Projects/am-inbox-analysis/`.
Filename format: `YYYY-MM-DD-AM-Inbox-Report-Michael-Ross.docx`

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

Pull inbox in batches of 50 using `offset` pagination with `mailboxOwnerEmail: michael.ross@doxatalent.com`. Deduplicate strictly by `internetMessageId` — the same email appears 4-8x per batch due to threading. Keep only the first occurrence.

Continue until results return fewer than 50 (end of results) or `max_batches` is reached.

Collect per unique email: `sender`, `recipients`, `subject`, `summary`, `receivedDateTime`, `importance`, `hasAttachments`, `internetMessageId`

---

## Step 2: Classify Emails

Classification uses three buckets. No TO/CC inference is attempted — the M365 search API returns a flat recipient list that does not distinguish TO from CC. Testing confirmed that proxy rules based on recipient count or importance misclassify at an unacceptable rate. All classification is based on sender domain and subject pattern.

### Bucket A: NOISE — exclude from all analysis

Sender domain or subject pattern matches any of:
- Domains: ninety.io, ess.barracudanetworks.com, calendly.com, circle.so, mindvalley.com, alert.refer.io, chorus.ai, zoominfo.com, mandrillapp.com
- Senders: postmaster@doxatalent.com
- Subject patterns (case-insensitive): "unsubscribe", "quarantine notification", "held messages", "new held messages", "your daily briefs", "weekly team update"

### Bucket B: ROUTINE — count toward volume but exclude from AI analysis

Subject contains any of (case-insensitive): "weekly recruitment report", "weekly update", "daily update", "weekly report"

Rationale: Tested against Michael's sent items Jan 1–Apr 25 — zero replies to standard weekly recruitment report emails. When these threads escalate to require Michael's action, the subject line changes ("Urgent: Action Required", "Alignment Needed", "Immediate Action Required"). Those escalations are captured in Bucket C with their updated subject lines.

### Bucket C: ACTIONABLE — full analysis

All emails not matching Bucket A or B. Includes:
- INTERNAL: sender domain is doxatalent.com
  - Sub-classify: TL/OM list match → tag as `TL_OM`; otherwise → `DOXA_OTHER`
- CLIENT: external domain
  - Extract domain as account name (fusiontek.com → Fusiontek, agiliit.com → Agile IT)
- AMBIGUOUS: cold outreach patterns (unsolicited vendor/sales pitches from unknown senders)
  - Count separately, exclude from AI analysis

---

## Step 3: Build Raw Metrics

**Volume**
- Total pulled (raw) / deduplicated / noise filtered / routine filtered / actionable
- Routine traffic as % of deduplicated total
- Avg actionable emails per business day (count business days in date range)
- Peak day (highest actionable count), trough day (lowest)

**TL/OM breakdown** (actionable emails only)
- Every person on the TL/OM reference list: email count
- Sort descending. Flag zeros as "(no contact in period)"

**Account breakdown** (CLIENT actionable only)
- Every external domain: email count and subject thread summaries
- Sort descending, top 10

**High-importance emails**
- Total count and by sender domain, actionable only

---

## Step 4: AI Analysis via Anthropic API

Use `claude-sonnet-4-20250514`, max_tokens 4000. Run three calls, each on Bucket C (actionable) emails only. Pass subject + summary + sender domain/name + date for each email.

**Call A — Top 10 Client Issues**
System prompt:
"You are analyzing email summaries from a DOXA Talent account manager's inbox. DOXA is a staffing company placing remote workers (called VIPs) with US-based clients. Identify the top 10 recurring issues, concerns, or action items in the CLIENT emails provided. Group similar topics. For each issue: (1) a concise name, (2) estimated email count, (3) which client accounts are involved by domain, (4) status: resolved / open / recurring. Return a JSON array only. No preamble or markdown."

Input: all CLIENT actionable summaries

**Call B — Top 10 Employee Questions**
System prompt:
"You are analyzing internal emails sent to a DOXA Talent account manager. Identify the top 10 questions or recurring asks that DOXA employees bring to this account manager. For each: (1) concise question name, (2) specific senders — first and last name, (3) frequency estimate, (4) classification: self-serve (could be handled with an SOP or FAQ) vs requires-AM (genuinely needs account manager judgment). Return a JSON array only. No preamble or markdown."

Input: all INTERNAL actionable summaries (DOXA_OTHER + TL_OM)

**Call C — Account Health Signals**
System prompt:
"Based on these email summaries from a DOXA Talent account manager, identify: (1) accounts showing friction or dissatisfaction — look for complaints, escalations, missed deliverables, tone signals; (2) accounts with very low contact volume that may indicate disengagement or churn risk; (3) accounts with escalating thread complexity — same problem appearing in multiple threads. Return JSON with three arrays: friction_accounts (name, evidence, risk_level: high/medium/low), silent_accounts (name, last_contact_estimate), escalation_accounts (name, pattern_description). No preamble or markdown."

Input: CLIENT actionable emails grouped by domain

---

## Step 5: Generate Word Document

Install if needed: `npm install -g docx`

### Document Sections

1. Cover — title, date range, generated date
2. Period Summary (table)
3. Top 10 Client Issues — Bucket C CLIENT only (table)
4. Top 10 Employee Questions — Bucket C INTERNAL only (table)
5. Email Volume by TL/OM (table)
6. Top 10 Accounts by Volume (table)
7. Account Health Signals (three subsections)
8. Routine Traffic Summary (brief — volume of weekly report emails excluded from analysis, with top senders)
9. Capacity and Risk Flags (bullets)

### Section 2: Period Summary Table

| Metric | Value |
|---|---|
| Date range | start to end |
| Business days | N |
| Total emails pulled (raw) | N |
| Deduplicated | N |
| Noise filtered | N |
| Routine traffic filtered | N (X%) |
| Actionable emails analyzed | N |
| Avg actionable per business day | N |
| High-importance emails | N |
| Peak day | date (N) |

### Section 8: Routine Traffic Summary

Brief section — not a major analysis. Report:
- Total weekly report / routine emails excluded
- Top 5 senders of routine traffic by count
- Note: "These threads are monitored for subject-line escalations, which are included in the actionable analysis above."

### Section 9: Capacity and Risk Flags

Bullet list covering:
- Accounts where Michael appears to be the sole DOXA contact in threads (no other DOXA staff visible in recipients)
- Topics appearing in 3+ separate threads (systemic vs one-off)
- Employee question categories that suggest a missing SOP or FAQ (from Call B self-serve classifications)
- Any client domains that first appeared in the last 30 days of the period (new account signals)

### docx-js Pattern

```javascript
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType } = require('docx');
const fs = require('fs');

const pageProps = {
  page: {
    size: { width: 12240, height: 15840 },
    margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
  }
};

const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

// Header rows: white text on navy 1F3864, ShadingType.CLEAR
// Data rows: alternate F2F2F2 / FFFFFF
// Always set columnWidths on Table AND width on each TableCell (DXA only, never PERCENTAGE)
// columnWidths must sum to 9360 DXA

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
  sections: [{ properties: pageProps, children: [ /* content */ ] }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('/home/claude/report.docx', buffer);
  console.log('Done');
});
```

Column width sets (must sum to 9360):
- 2-col equal: [4680, 4680]
- 2-col 1/3+2/3: [3120, 6240]
- 3-col equal: [3120, 3120, 3120]
- 4-col: [3120, 2080, 2080, 2080]
- 5-col (rank+issue+accounts+freq+status): [936, 2808, 2808, 1404, 1404]

After generating, validate:
```bash
python /mnt/skills/public/docx/scripts/office/validate.py /home/claude/report.docx
```

---

## Step 6: Save Output

Date prefix = today's date (YYYY-MM-DD).

Target: `/Users/ralph/Documents/Claude/Projects/am-inbox-analysis/YYYY-MM-DD-AM-Inbox-Report-Michael-Ross.docx`

Steps:
1. Generate and validate at `/home/claude/YYYY-MM-DD-AM-Inbox-Report-Michael-Ross.docx`
2. Use `Filesystem:write_file` to write to the target path
3. Confirm save path in chat
4. Call `present_files` for in-chat download link

If output folder is missing, create with `Filesystem:create_directory` first.

---

## Recurring Report Mode

Accept `comparison_period` (previous week or month). Compute deltas: actionable volume change, new issues vs resolved, new TL/OM activity patterns, new client domains, accounts that went silent. Each run produces a new date-prefixed file — prior runs accumulate for trend comparison. Scheduling requires manual trigger each period.

---

## Error Handling

- M365 auth error: verify delegate sharing and Mail.Read.Shared permission on Michael's mailbox
- Fewer than 20 unique emails after dedup: warn of incomplete results, check date range
- Anthropic API failure: fall back to keyword frequency on subject lines, note degraded accuracy
- Filesystem write failure: fall back to present_files only
- TL/OM with no matches: include in table with count 0, flag "(no contact)"
- Output folder missing: create before writing

---

## File Locations

- Output folder: `/Users/ralph/Documents/Claude/Projects/am-inbox-analysis/`
- GitHub skill: `/Users/ralph/Documents/GitHub/Ralph-Claude-Connector/skills/account-manager-inbox-analysis/SKILL.md`
- Obsidian vault root: `/Users/ralph/Documents/Claude/`
