---
name: am-accountability-audit
description: >
  Daily accountability audit of Michael Ross's Outlook mailbox to detect dropped balls, slow responses, missed commitments, silent handoffs, and ownership mismatches between Michael (Co-Founder, Strategic Accounts) and Naji Kubon (Senior AE). Designed for HR-grade documentation; intended to inform personnel decisions. Triggered by /aaaudit or any natural language request to run the accountability audit, audit Michael's email, generate a Michael Ross daily report, track AM accountability, check Michael's follow-through, diagnose role drift, or analyze who is doing what work between Michael and Naji. Also runs on a daily schedule (Mon-Fri 6:00 AM CT) and produces a weekly scorecard every Sunday morning (7:00 AM CT). Pulls a rolling 7-day window across Inbox, Sent Items, Deleted Items, and Archive. Classifies each email as NOISE, ROUTINE, or ACTIONABLE; for ACTIONABLE items, identifies the expected owner per ownership-rules.md, matches the actual DOXA responder, calculates time-to-first-response against aggressive SLAs, extracts explicit commitments with deadlines, persists open commitments across daily runs, flags silent handoffs where someone else replied to a client email Michael was on as primary recipient, and flags ownership mismatches—especially the Naji-as-AM pattern where a Senior AE handles AM-level work. Output is one Excel ledger per day plus a Sunday weekly scorecard, saved to the OneDrive HR folder for Michael Ross with vault outputs as fallback. Every flag carries a direct email link for source verification. This skill is independent and self-contained; it is not a companion to other inbox-analysis skills.
---

# AM Accountability Audit

Daily accountability audit of Michael Ross's mailbox. Outputs an Excel ledger documenting response times, missed SLAs, silent handoffs, ownership mismatches, open commitments, and unresolved client issues. Designed for HR-grade documentation. Aggressive flagging.

## Purpose

Diagnose what work Michael is owning, what he is delegating to Naji Kubon (Senior AE), and where he is dropping balls. The output is intended to inform personnel decisions and HR documentation. Every finding carries a direct email link for source verification at the original record.

## Trigger

| Trigger | Behavior |
|---|---|
| `/aaaudit` slash command | Run daily audit |
| Natural language requests for accountability audit, daily Michael Ross report, response time tracking, ownership analysis, role drift diagnosis | Run daily audit |
| Day of week is Sunday | Run weekly scorecard (Step 10), referencing prior daily files |
| Explicit "weekly scorecard" or `/aaweekly` request | Run weekly scorecard only |

## Platform and Path Resolution

Detect platform at runtime. The vault syncs across PC and Mac; references live in the vault, output goes to OneDrive HR folder.

| Path | Windows | macOS |
|---|---|---|
| Vault root | `C:\Users\RalphNilssen\Obsidian\Claude\` | `/Users/ralph/Documents/Claude/` |
| Skill folder | `<vault>\scripts\am-accountability-audit\` | `<vault>/scripts/am-accountability-audit/` |
| Output primary | `C:\Users\RalphNilssen\OneDrive - DOXA Talent\HR\Sales Team\Michael Ross\Daily Report\` | `/Users/ralph/Library/CloudStorage/OneDrive-DOXATalent/HR/Sales Team/Michael Ross/Daily Report/` |
| Output fallback | `<vault>\outputs\am-accountability-audit\` | `<vault>/outputs/am-accountability-audit/` |
| Persistent ledger | `<output_primary>\_commitments-ledger.json` (or fallback if primary unwritable) | same pattern |
| Reference: client domains | `<skill_folder>\client-domains.csv` | `<skill_folder>/client-domains.csv` |
| Reference: ownership rules | `<skill_folder>\ownership-rules.md` | `<skill_folder>/ownership-rules.md` |

When the skill is migrated to the GitHub repo on Mac, skill folder becomes `/Users/ralph/Documents/GitHub/Ralph-Claude-Connector/skills/am-accountability-audit/`. All other paths unchanged.

If output primary write fails (OneDrive sync conflict, file lock, path missing), retry once after 5 seconds, then write to fallback. Always log the actual write path in the run summary.

## Parameters

| Parameter | Default | Notes |
|---|---|---|
| `mailbox` | michael.ross@doxatalent.com | Requires M365 delegate access (Mail.Read.Shared) |
| `audit_window_days` | 7 | Rolling window ending at run time |
| `internal_domain` | doxatalent.com | Sender from this domain is internal |
| `business_hours` | Mon-Fri 08:00-18:00 America/Chicago | SLA clock pauses outside this window |
| `max_batches` | 20 per folder | 50 emails per batch; capped at 1,000 deduplicated emails total |
| `client_domains_file` | client-domains.csv (skill folder) | Maps domain → account name → status (active/former) |
| `ownership_rules_file` | ownership-rules.md (skill folder) | Defines expected owner per item type |

## SLA and Severity Matrix

All time clocks measured in business hours only.

| Item type | First response SLA | Resolution SLA | Severity if breached |
|---|---|---|---|
| External client issue | 4 business hours | 2 business days | Critical at 24+ hours unresponded, Major otherwise |
| External client referral request | 2 business hours | Same business day | Critical at 4+ hours unresponded, Major otherwise |
| External client question (non-issue) | Same business day | 2 business days | Major |
| External client commitment with stated date | n/a | Stated deadline | Critical at deadline + 1 day, Major at deadline |
| Internal commitment to DOXA leader | Next business day | Stated deadline | Major |
| Internal commitment to TL/OM or other DOXA staff | 2 business days | Stated deadline | Minor |
| Silent handoff (someone else replied to client email Michael was on as primary recipient) | n/a | n/a | Critical, every instance |
| Ownership mismatch: naji_as_am | n/a | n/a | Critical, every instance |
| Ownership mismatch: michael_doing_ops_work | n/a | n/a | Major |
| Ownership mismatch: other | n/a | n/a | Minor |

---

## Step 1: Pull and Deduplicate Emails

Use Microsoft 365 MCP. Pull from all relevant folders.

Folders to query for `mailbox` = michael.ross@doxatalent.com:
- Inbox and all subfolders
- Sent Items
- Deleted Items
- Archive
- Any custom folders (enumerate via folder list, then query each)

For each folder, pull all messages where `receivedDateTime` (Inbox/Deleted/Archive) or `sentDateTime` (Sent Items) falls in the rolling 7-day window. Batch size 50 with offset pagination. Continue until results return fewer than 50 (end of folder) or `max_batches` reached.

Deduplicate strictly by `internetMessageId` across all folders. Same email appears 4-8x per batch due to threading. Keep first occurrence and preserve folder name in metadata.

Per unique email, capture: `internetMessageId`, `conversationId`, `from` (email + display name), `to` (full list), `cc` (full list), `subject`, `bodyPreview`, `summary`, `receivedDateTime`, `sentDateTime`, `importance`, `hasAttachments`, `folderName`, `webLink`.

If `webLink` is unavailable, construct a deep link manually using `internetMessageId`.

Folder filter quirk: the M365 connector does not always recognize the literal name "Sent Items" as a folder filter. If folder enumeration returns no Sent Items match, filter Sent traffic by `from.emailAddress.address = michael.ross@doxatalent.com` instead.

---

## Step 2: Classify Emails

Three-bucket classification.

### Bucket A: NOISE (exclude entirely)

Sender domain or subject pattern matches any of:
- Domains: ninety.io, ess.barracudanetworks.com, calendly.com, circle.so, mindvalley.com, alert.refer.io, chorus.ai, zoominfo.com, mandrillapp.com
- Senders: postmaster@doxatalent.com
- Subject patterns (case-insensitive): "unsubscribe", "quarantine notification", "held messages", "new held messages", "your daily briefs"

### Bucket B: ROUTINE (count toward volume but skip ownership and SLA analysis)

Subject contains any of (case-insensitive): "weekly recruitment report", "weekly update", "daily update", "weekly report"

Rationale: when these threads escalate to require Michael's action, the subject changes ("Urgent", "Action Required", "Alignment Needed"); those escalations land in Bucket C with their updated subjects.

### Bucket C: ACTIONABLE (full analysis)

All emails not matching A or B. For each ACTIONABLE inbound email, assign three additional tags.

#### Tag 1: Sender Bucket

Load `client-domains.csv`. Match sender domain (case-insensitive) against the `domain` column.

| Bucket | Rule |
|---|---|
| INTERNAL | Sender domain is doxatalent.com |
| CLIENT | Sender domain matches client-domains.csv with status=active |
| FORMER_CLIENT | Sender domain matches client-domains.csv with status=former |
| EXTERNAL_OTHER | Sender is external but no domain match (covers gmail.com, vendors, prospects) |

#### Tag 2: Action Requirement (inbound only; Michael in `to` or `cc`)

| Classification | Logic |
|---|---|
| ACTION_REQUIRED | Direct question, escalation, request, "can you", "please", "?", deadline, complaint signals, missed-payment language, or Michael in `to` and external sender |
| FYI | Newsletter, broadcast, Michael in `cc` only with no direct ask, automated notification, or routine status update |

Use Anthropic API (`claude-sonnet-4-20250514`, max_tokens 200) for ambiguous cases. Bias toward ACTION_REQUIRED. False positives are recoverable, false negatives hide accountability gaps.

#### Tag 3: Item Type and Expected Owner (ACTION_REQUIRED only)

Read `ownership-rules.md`. Apply the Item Type → Expected Owner matrix defined there. For each ACTION_REQUIRED inbound, assign one item_type and derive expected_owner.

Use Anthropic API for ambiguous cases. Default expected_owner is Michael for any external client item that does not clearly fall into another category.

---

## Step 3: Match Responses

For each ACTION_REQUIRED inbound, locate the first DOXA response in the same conversation.

Match by `conversationId`. Within the conversation, find the earliest message in Sent Items (any DOXA staff) where `sentDateTime` is after the inbound `receivedDateTime`.

Compute per ACTION_REQUIRED item:
- `time_to_first_response_business_hours`: business hours between inbound receipt and first DOXA reply
- `actual_responder`: email of the first DOXA staff member to reply
- `michael_responded`: whether Michael ever replied in the thread
- `michael_response_dt`: timestamp of Michael's reply if any
- `michael_substantive`: whether Michael's reply was substantive (true) or absent/perfunctory (false). Use Anthropic API on Michael's reply body to assess.
- `latest_thread_state`: who sent the most recent message in the thread

Reset SLA clock on each new client reply requiring action. If a thread has Michael's reply followed by a new client question, that new question starts a fresh SLA clock.

CC vs TO distinction: if Michael is only in `cc` and the body contains no direct ask to him, classify as FYI in Step 2 and skip response matching.

---

## Step 4: Detect Silent Handoffs

For every CLIENT inbound where Michael was in `to` (not just cc):
1. Find earliest reply in the thread after the inbound
2. If reply is from a non-Michael DOXA address (any `@doxatalent.com` other than michael.ross), flag as silent_handoff (Critical)
3. Capture: original inbound, who replied, time gap, current thread state, designated-co-owner check

Exclusions (load from `ownership-rules.md`):
- Michael's calendar shows OOO during the handoff period AND coverage was an explicit arrangement
- The DOXA replier is on the original `to` line as a designated co-owner per the Designated Co-Owner Exceptions table

---

## Step 5: Detect Ownership Mismatches

Separate detection layer from silent handoff. Silent handoff measures whether Michael was bypassed; ownership mismatch measures whether the right DOXA person responded regardless of whether Michael was bypassed.

For each ACTION_REQUIRED item, compare `expected_owner` (from Step 2 Tag 3) to `actual_responder` (from Step 3). Apply the Mismatch Severity Matrix from `ownership-rules.md`:

| Mismatch flag | Trigger condition | Severity |
|---|---|---|
| naji_as_am | actual_responder = naji.kubon AND expected_owner = michael.ross AND item_type in (client_rate_confirmation, client_question, client_referral_request, bench_inquiry, client_issue) | Critical |
| michael_doing_ops_work | actual_responder = michael.ross AND expected_owner in (vanessa.jamison, recruiter, tl_om) | Major |
| wrong_doxa_person | actual_responder is DOXA but neither expected_owner nor a recognized escalation path | Minor |
| correct_owner | actual_responder = expected_owner | (no flag, log as correct) |

Per detection capture: item_type, account, inbound subject and timestamp, expected_owner, actual_responder, michael_substantive in thread (yes/no, with time delta), email link.

---

## Step 6: Extract Commitments

For Michael's outbound emails (current 7-day window in Sent Items), extract explicit promises via Anthropic API.

System prompt: "Extract every explicit commitment from this email where the sender promises a specific deliverable with a stated or implied deadline. Return a JSON array. Each item has: commitment_text (verbatim quote), deliverable (what was promised), deadline (ISO date if stated, or 'unspecified'), recipient (email of person owed the deliverable), confidence (high if explicit promise with date, medium if explicit promise no date, low if soft commitment like 'I'll check'). Exclude soft commitments unless they include a date. Return [] if no commitments. JSON only, no preamble."

Confidence tiers:
- HIGH: explicit promise with date ("I'll send the proposal by Friday")
- MEDIUM: explicit promise no date ("I'll send the proposal")
- LOW: hedged language ("Let me check on that")

Track HIGH and MEDIUM in the daily ledger. LOW logged separately for trend visibility but generates no flags.

---

## Step 7: Update Persistent Commitments Ledger

Read `_commitments-ledger.json` from the output folder. If missing, initialize as empty array.

Schema per entry:
```
{
  "id": "16-char prefix of sha256(made_on + recipient + deliverable)",
  "made_on": "YYYY-MM-DD HH:MM",
  "recipient": "name or email",
  "recipient_type": "client | internal_leader | internal_other",
  "deliverable": "...",
  "deadline": "ISO date or free-text label",
  "status": "open | fulfilled | missed | stale",
  "confidence": "high | medium",
  "first_seen_run_date": "ISO date",
  "last_seen_run_date": "ISO date",
  "source_message_id": "internetMessageId",
  "source_web_link": "...",
  "fulfillment_evidence": null,
  "notes": "optional context"
}
```

Process:
1. For each new commitment extracted this run, compute id and check ledger; if exists, update last_seen_run_date; if new, insert
2. For each open commitment, check if Michael has sent a follow-up email to the recipient referencing the deliverable. If yes, mark `status = fulfilled` and capture the message id as `fulfillment_evidence`
3. For each open commitment where deadline is past and no fulfillment evidence: mark `status = missed`
4. For commitments older than 21 days with no deadline and no fulfillment: mark `status = stale`
5. Write updated ledger back to `_commitments-ledger.json`

Fulfillment detection uses Anthropic API on the candidate follow-up email plus the original commitment text. System prompt: "Did this email fulfill the stated commitment? Return JSON {fulfilled: true|false, evidence: short quote}. Be strict. Acknowledgment without delivery is not fulfillment."

---

## Step 8: AI Pattern Analysis

Use `claude-sonnet-4-20250514`, max_tokens 4000. Three calls per daily run.

### Call A: Ownership Pattern Analysis

Input: all ownership mismatch detections from Step 5.

System prompt: "You are analyzing accountability detections for Michael Ross, a DOXA Talent co-founder responsible for strategic accounts. The data below shows ACTION_REQUIRED items where actual_responder did not match expected_owner. For each Naji-as-AM detection, identify (1) item type, (2) account, (3) whether Michael followed up substantively or whether Naji's response was treated as final, (4) timing pattern (was the inbound during business hours; did Naji respond within minutes vs hours). Then summarize (a) which item types Naji systematically owns instead of Michael, (b) which accounts show the heaviest pattern, (c) whether the pattern looks like Michael delegating downward or Naji overstepping (cite evidence). Return JSON only."

### Call B: Account Health Signals

Input: ACTIONABLE CLIENT emails grouped by domain.

System prompt: "You are analyzing email summaries for a DOXA account manager. Identify (1) accounts showing friction or dissatisfaction (complaints, escalations, missed deliverables, tone signals), (2) accounts with very low contact volume that may indicate disengagement or churn risk, (3) accounts with escalating thread complexity (same problem in multiple threads). Return JSON with three arrays: friction_accounts (name, evidence, risk_level: high/medium/low), silent_accounts (name, last_contact_estimate), escalation_accounts (name, pattern_description). No preamble or markdown."

### Call C: Open Commitment Risk

Input: open commitments from the persistent ledger.

System prompt: "You are reviewing open commitments from a DOXA account manager's outbound email. For each open commitment, assess (1) likelihood the commitment will be missed based on the recipient and time elapsed, (2) blast radius if missed (low/medium/high based on recipient type and deliverable significance). Return JSON array. No preamble."

---

## Step 9: Build Daily Excel Workbook

Use `xlsx` skill conventions (openpyxl). Standard formatting: navy `#052538` header fill, white text, Aptos size 11, freeze top row, alternating row shading.

Severity color codes:
- Critical: `#D41A69` (Crimson)
- Major: `#F1AF21` (Gold)
- Minor: `#00ADEF` (Blue)
- correct_owner: `#05AF72` (Green)

Filename: `YYYY-MM-DD-AM-Accountability-Report-Michael-Ross.xlsx` (today's date, prefix per CLAUDE.md naming convention)

### Sheets

**Sheet 1: Summary** — two-column metric/value table:
- Run date, audit window, total emails pulled (raw and dedup), noise/routine/actionable counts
- Action-required inbound count, responded within SLA (count and %), responded but breached SLA, unresponded
- Silent handoffs detected
- Ownership mismatches by type (naji_as_am, michael_doing_ops, other)
- Ownership integrity score (correct_owner % of total action-required)
- Open commitments tracked, commitments fulfilled and missed this period
- Critical / Major / Minor flag counts
- Output path actually written (primary or fallback)

**Sheet 2: Critical Flags** — per Critical item: flag type (silent_handoff / naji_as_am / client_issue_24h+ / referral_4h+ / missed_commitment_overdue_1d+), detected at, account, sender, subject, inbound received, hours elapsed (business), status, email link, notes.

**Sheet 3: Major Flags** — same structure as Critical.

**Sheet 4: Minor Flags** — same structure.

**Sheet 5: Response Time Log** — every ACTION_REQUIRED inbound: inbound received, account, item type, sender, subject, michael_responded (yes/no), time to first response (business hours), within SLA, severity if breached, latest thread state, email link.

**Sheet 6: Ownership Analysis** — one row per ACTION_REQUIRED inbound. Columns: inbound time, account, sender, subject, item type, expected owner, actual responder, michael_substantive in thread, time gap, mismatch flag, severity, email link, notes. Sort: severity desc, then mismatch flag, then inbound time desc.

Aggregate panel below table: total action-required items classified, correctly owned (count and %), naji_as_am detections (and breakdown by item type), michael_doing_ops_work detections, other mismatches, ownership integrity score.

**Sheet 7: Silent Handoffs** — detail view of Step 4 detections. One row per handoff with full context including DOXA staff member who covered.

**Sheet 8: Open Commitments** — active entries from `_commitments-ledger.json` where status = open. Columns: first seen, recipient, recipient type, deliverable, deadline, days since commitment, days until/past deadline, confidence, source email link.

**Sheet 9: Resolved This Period** — commitments where status changed to fulfilled or missed during this run.

**Sheet 10: Account Health Signals** — output from Step 8 Call B as a readable table (friction, silent, escalation arrays, with evidence).

**Sheet 11: FYI Snapshot** — top 10 accounts by inbound action-required volume this period, plus any account with zero contact in 14+ days flagged as silent. Useful complementary signal that may not surface as a Critical flag but indicates portfolio attention pattern.

### openpyxl Pattern

```python
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

NAVY = "052538"; WHITE = "FFFFFF"; BLUE = "00ADEF"; GREEN = "05AF72"
CRIMSON = "D41A69"; GOLD = "F1AF21"; LIGHT_GRAY = "F2F2F2"

header_font = Font(name="Aptos", size=11, bold=True, color=WHITE)
header_fill = PatternFill("solid", fgColor=NAVY)
body_font = Font(name="Aptos", size=11)
body_alt_fill = PatternFill("solid", fgColor=LIGHT_GRAY)
thin = Side(style='thin', color='CCCCCC')
border = Border(left=thin, right=thin, top=thin, bottom=thin)

wb = Workbook()
ws = wb.active; ws.title = "Summary"
# ... build all 11 sheets
wb.save(output_path)
```

After generating, validate the workbook reloads cleanly with openpyxl `load_workbook(output_path)`.

---

## Step 10: Sunday Weekly Scorecard

Trigger: Sunday 7:00 AM CT scheduled run OR explicit `/aaweekly` request.

Filename: `YYYY-MM-DD-AM-Accountability-Weekly-Michael-Ross.xlsx` (date is the Sunday of the week being reported).

This file is in addition to (not instead of) the daily run from earlier in the week.

Aggregates the past 7 daily files in the output folder. If prior daily files are missing, run a fresh 7-day audit and treat that as the week's data.

### Sheet 1: Scorecard Summary

| Metric | This week | Last week | 4-week avg | Trend |
|---|---|---|---|---|
| Action-required inbound | | | | |
| Responded within SLA (count and %) | | | | |
| Average response time, business hours | | | | |
| Median response time, business hours | | | | |
| 90th percentile response time | | | | |
| Silent handoffs | | | | |
| Naji-as-AM detections | | | | |
| Michael-doing-ops detections | | | | |
| Ownership integrity score | | | | |
| Critical flags | | | | |
| Commitments made | | | | |
| Commitments fulfilled | | | | |
| Commitments missed | | | | |
| Commitments still open | | | | |

Trend column: arrow indicator and percent change vs 4-week average.

### Sheet 2: Account-Level Performance

One row per account contacted this week. Columns: account, inbound action-required count, responded within SLA, breached SLA, unresponded, silent handoffs, naji_as_am count, average response time, open commitments to this account, health flag.

Health flag logic:
- Red: any silent handoff OR any naji_as_am detection OR any unresponded action-required older than 24 business hours OR any missed commitment
- Yellow: SLA breach but eventually responded OR open commitment past deadline by less than 1 day
- Green: all action items addressed within SLA by correct owner

### Sheet 3: Ownership Pattern Analysis

Run Step 8 Call A on the full week's mismatch data. Render as a readable table with item-type breakdown, account concentration, and the delegating-downward vs Naji-overstepping assessment.

### Sheet 4: Recommendation Summary

| Field | Content |
|---|---|
| Week of | Mon-Sun dates |
| Performance vs SLA | X% within SLA (vs Y% last week) |
| Ownership integrity | X% correctly owned (vs Y% last week) |
| Top concern | highest severity unresolved item or top mismatch pattern |
| Trend assessment | Improving / Stable / Deteriorating based on 4-week comparison |

---

## Step 11: Save and Present

1. Generate workbook in working directory
2. Validate workbook reloads cleanly via openpyxl `load_workbook`
3. Attempt write to output_primary (OneDrive HR folder)
4. On failure (sync conflict, file lock, path missing), retry once after 5s
5. On second failure, write to output_fallback (vault outputs/)
6. Update `_commitments-ledger.json` in the same folder used for the workbook
7. If today is Sunday OR weekly scorecard requested, repeat 1-6 for the weekly scorecard file
8. Confirm actual save path(s) in chat
9. Call `present_files` with the daily report (and weekly if generated) for in-chat preview

---

## Verification (run before scheduling)

This skill has been recreated multiple times. Before scheduling automated runs, run a manual verification pass to confirm each layer works.

| Step | Verification | Pass criteria |
|---|---|---|
| 1 | Pull emails from all 4 folders | Each folder returns at least 1 unique email; total dedup count > 50 for a 7-day window |
| 1 | Sent Items access | Folder filter or sender filter pulls Michael's outbound; verify by spot-check against Outlook directly |
| 2 | Sender bucket classification | Open client-domains.csv, pick 3 active and 1 former; verify those domains classify correctly |
| 2 | Action-required vs FYI | Spot-check 10 emails; confirm no obvious action-required items classified as FYI |
| 3 | Response matching | Pick 3 inbound action-required emails and verify the actual_responder field matches what Outlook shows |
| 4 | Silent handoff | Manually identify one known silent handoff case; verify it appears in Sheet 7 with correct fields |
| 5 | Ownership mismatch | Manually identify one known naji_as_am case; verify it appears in Sheet 6 with severity = Critical |
| 6-7 | Commitment ledger | After first run, open `_commitments-ledger.json` and verify entries have valid IDs, deadlines, and status fields |
| 9 | Excel output | Open file in Excel; verify all 11 sheets render, severity coloring is applied, freeze panes work |
| 11 | Output path | Verify file lands in OneDrive HR folder (not fallback); if fallback was used, surface the reason |

If any check fails, do not schedule. Fix and rerun verification.

---

## Recurring Report Mode and Scheduling

Daily runs accumulate as date-prefixed files. Weekly scorecard runs Sunday and references prior daily files for trend computation. Each run produces a new file; prior runs are not modified.

After verification passes, set up two scheduled tasks via the `schedule` skill:

| Task | Cron | Action |
|---|---|---|
| Daily audit | 0 6 * * 1-5 (America/Chicago) | Run daily audit |
| Weekly scorecard | 0 7 * * 0 (America/Chicago) | Run weekly scorecard (Step 10) |

Daily Mon-Fri 6:00 AM CT. Weekly Sunday 7:00 AM CT.

---

## Anthropic API Call Inventory (per daily run)

Use `claude-sonnet-4-20250514`, max_tokens scaled to call type. Estimated volume:

| Purpose | Calls | Max tokens |
|---|---|---|
| Action-required classification (ambiguous cases) | 10-30 | 200 |
| Item type and expected owner classification (ambiguous cases) | 5-15 | 200 |
| Michael substantive-response assessment | 1 per item where Michael replied | 200 |
| Commitment extraction from outbound | 1 per Michael Sent email with potential commitment | 800 |
| Fulfillment detection | 1 per open commitment with candidate follow-up | 200 |
| Ownership pattern analysis (Call A) | 1 | 4000 |
| Account health signals (Call B) | 1 | 4000 |
| Open commitment risk (Call C) | 1 | 2000 |

Sunday weekly run adds: 1 weekly ownership pattern analysis call (4000 tokens).

---

## Error Handling

| Failure | Behavior |
|---|---|
| M365 auth error | Surface clearly, instruct Ralph to verify Mail.Read.Shared and delegate access on Michael's mailbox |
| Folder enumeration fails | Log, fall back to Inbox + Sent + Deleted only |
| Sent Items folder not recognized | Switch to sender filter on Michael's address |
| Fewer than 10 unique emails after dedup | Warn of incomplete pull, do not generate report |
| Anthropic API failure on classification | Default to ACTION_REQUIRED for any ambiguous external client email; default expected_owner to Michael; degrade extraction silently |
| OneDrive write lock or sync conflict | Retry once after 5s, then write to vault fallback path |
| Commitments ledger corrupt | Back up corrupt file to `_commitments-ledger.corrupt.YYYYMMDD.json`, initialize fresh |
| client-domains.csv missing | Treat all external as EXTERNAL_OTHER, log warning |
| ownership-rules.md missing | Default expected_owner to Michael for all external client items, log warning, abort if also missing client-domains.csv |
| Output folder missing | Create the missing folder before writing |
| Volume cap reached (max_batches × 50 = 1000 emails) | Truncate window to what was retrieved, label report scope as "partial single-day" or "partial multi-day", continue with classification on retrieved set rather than aborting |

---

## Tuning Notes

This skill is intentionally aggressive on flagging. Expect false positives in early runs. After 2 weeks of daily runs, review and tune:

1. Action-required classifier sensitivity
2. Silent handoff exclusion list (designated co-owners per account, added to ownership-rules.md)
3. Commitment confidence thresholds
4. Ownership matrix accuracy (item types miscategorized; legitimate Naji-first scenarios such as Michael OOO)
5. Pattern frequency week over week (does behavior shift after observation)

The persistent commitments ledger is the long-tail value. It survives the 7-day window and accumulates a defensible record of every promise made and whether it was kept.

The ownership analysis is the second-tier value. It surfaces structural role drift that response-time metrics alone cannot detect. Particular attention to the Naji-as-AM pattern: a Senior AE responding first to rate confirmations, bench inquiries, and routine client coordination indicates either misallocation of seniority (paying Senior AE comp for AM work) or Michael delegating his role downward. Both are operationally expensive. Track over time to confirm which interpretation is accurate and whether observed patterns shift after explicit role conversations.

For HR documentation use: every flag carries a direct email link. Any finding can be verified at the source. This is the difference between perception and evidence.

---

## File Locations

Skill folder: `<vault>\scripts\am-accountability-audit\` (Windows) or `<vault>/scripts/am-accountability-audit/` (Mac). Migrates to `/Users/ralph/Documents/GitHub/Ralph-Claude-Connector/skills/am-accountability-audit/` on Mac when stable.

Skill assets:
- `SKILL.md` (this file)
- `client-domains.csv` (active and former client domains)
- `ownership-rules.md` (role definitions, item-type matrix, mismatch severities)

Output (primary): OneDrive HR folder for Michael Ross. Daily and weekly Excel files plus `_commitments-ledger.json`.

Output (fallback): `<vault>\outputs\am-accountability-audit\`. Used when OneDrive write fails.
