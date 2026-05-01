---
name: am-accountability-audit
description: >
  Daily accountability audit of Michael Ross's Outlook mailbox to detect dropped balls, slow responses, missed commitments, silent handoffs, and ownership mismatches between Michael and Naji Kubon. Triggered by /aaaudit or any natural language request to run the accountability audit, audit Michael's email, generate a Michael Ross daily report, track AM accountability, check Michael's follow-through, or analyze who is doing what work between Michael and Naji. Also triggers automatically on a daily schedule and produces a weekly scorecard every Sunday morning. Pulls a rolling 7-day window across Inbox, Sent Items, Deleted Items, and Archive. Classifies each email as NOISE, ROUTINE, or ACTIONABLE; for ACTIONABLE items, identifies the expected owner per the embedded ownership matrix, matches the actual DOXA responder, calculates time-to-first-response against aggressive SLAs, extracts explicit commitments with deadlines, persists open commitments across daily runs, flags silent handoffs where someone else replied to a client email Michael was on as primary recipient, and flags ownership mismatches where the wrong DOXA staff member responded (especially the Naji-as-AM pattern). Output is one Excel ledger per day plus a Sunday weekly scorecard, saved to /Users/ralph/Documents/Claude/Projects/am-accountability-audit/. This skill is for accountability and HR-grade documentation, not pattern analysis. It complements but does not replace account-manager-inbox-analysis.
---

# AM Accountability Audit Skill

Triggered by: `/aaaudit` or any natural language request to run the accountability audit on Michael Ross's mailbox. Also runs daily on schedule and produces a weekly scorecard every Sunday.

Produces an Excel ledger (.xlsx) saved to `/Users/ralph/Documents/Claude/Projects/am-accountability-audit/`.

Daily filename: `YYYY-MM-DD-AM-Accountability-Report-Michael-Ross.xlsx`
Weekly filename (Sundays): `YYYY-MM-DD-AM-Accountability-Weekly-Michael-Ross.xlsx`

Designed for HR-grade documentation. Aggressive flagging. Every flag carries a direct email link for source verification.

## Parameters (collect or use defaults)

| Parameter | Default | Notes |
|---|---|---|
| `mailbox` | michael.ross@doxatalent.com | Must have M365 delegate access |
| `audit_window_days` | 7 | Rolling window ending at run time |
| `internal_domain` | doxatalent.com | Sender from this domain is internal |
| `business_hours` | Mon-Fri 08:00-18:00 America/Chicago | SLA clock pauses outside this window |
| `max_batches` | 20 | 50 per batch, capped at 1,000 deduplicated emails |
| `output_folder` | `/Users/ralph/Documents/Claude/Projects/am-accountability-audit/` | Direct write |
| `commitments_ledger` | `_commitments-ledger.json` (in output folder) | Persists open commitments across runs |

## DOXA Role and Ownership Reference

This embedded reference defines who is expected to own each type of inbound communication. The audit compares actual responder against expected owner and flags mismatches.

### Role Definitions

| Role | Person | Scope |
|---|---|---|
| Co-Founder, Strategic Accounts | Michael Ross | Strategic relationships, executive escalations, pricing decisions, account commercial decisions, new business at the strategic level, client retention |
| Senior Account Executive | Naji Kubon | Hunting role: strategic prospecting, new client acquisition, deal structuring on accounts in his book, partnering with Michael on strategic accounts as a peer (not as a first-line AM) |
| Account Manager (operational) | Currently undefined; default expected owner is Michael | Day-to-day client coordination, rate confirmation sign-off, bench inquiry coordination, VIP placement updates, routine client status |
| Operations Manager | Vanessa Jamison | VIP HR/disciplinary, performance management, payroll alignment, internal coordination of placement issues |
| Team Leader / OM | TLs and OMs | First-line VIP performance, daily client check-ins, candidate readiness |
| Recruiters | Recruitment team | Candidate sourcing, screening, endorsement |

### Ownership Matrix by Item Type

| Item type | Detection signals | Expected owner |
|---|---|---|
| client_rate_confirmation | "Confirmation of Client Rate", "maintain the X% markup" | Michael |
| client_issue | Complaint, escalation, "not working", "concerned", "unhappy", "failed", "error", VIP performance complaint from client | Michael |
| client_referral_request | "Can you refer", "introduction to", "looking for someone who", "do you know" | Michael |
| client_question | Substantive question or request from active client that is not an issue | Michael |
| client_commitment_due | Inbound referencing a prior promise or asking for a deliverable | Michael |
| bench_inquiry | "Available bench", "can we redeploy", "fit for X account" | Michael |
| jo_administration | "Why was this JO closed", JO process, scope clarifications | Operations or recruiter |
| vip_performance | Performance concerns, PIP, termination | Operations Manager (Vanessa) with Michael loop-in |
| internal_leader_request | Sender is David Nilssen, Lauren Hoover, Stephen Hosemann, Steve Gire, Christina Chambers, or Ralph Nilssen | Michael |
| cold_outreach_strategic | New logo prospecting on strategic account in Michael's book | Michael |
| cold_outreach_book | New logo prospecting on Naji's book | Naji |
| internal_other | Other internal action-required | Whoever workflow assigns; typically Operations |

### Naji-as-AM Pattern (primary detection target)

Inbound is to "Michael and Naji" addressed (Michael in TO, Naji in TO or CC) where the item type is AM-level work. Naji responds first, often with placeholder language ("I will circle back"). Michael responds substantively later or not at all.

Why it matters: Naji's title (Senior Account Executive) implies hunting and peer-level partnering on strategic accounts, not first-line AM execution. When Naji functions as Michael's executive assistant on operational AM work, two costs emerge: Senior AE comp paying for AM-level execution, and Michael's role drift away from strategic engagement on accounts he should own.

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

Pull from all relevant folders, not just Inbox.

Folders to query for `mailbox` = michael.ross@doxatalent.com:
- Inbox and all subfolders
- Sent Items
- Deleted Items
- Archive

For each folder, pull all messages where `receivedDateTime` (Inbox/Deleted/Archive) or `sentDateTime` (Sent Items) falls in the rolling 7-day window. Batch size 50 with offset pagination. Continue until results return fewer than 50 (end of folder) or `max_batches` reached.

Deduplicate strictly by `internetMessageId` across all folders. Same email appears 4-8x per batch due to threading. Keep first occurrence and preserve folder name in metadata.

Per unique email, capture: `internetMessageId`, `conversationId`, `from` (email + display name), `to`, `cc`, `subject`, `bodyPreview`, `summary`, `receivedDateTime`, `sentDateTime`, `importance`, `hasAttachments`, `folderName`, `webLink`.

If `webLink` is unavailable, construct a deep link manually using `internetMessageId`.

---

## Step 2: Classify Emails

Three-bucket classification consistent with `account-manager-inbox-analysis` skill conventions.

### Bucket A: NOISE (exclude entirely)

Sender domain or subject pattern matches any of:
- Domains: ninety.io, ess.barracudanetworks.com, calendly.com, circle.so, mindvalley.com, alert.refer.io, chorus.ai, zoominfo.com, mandrillapp.com
- Senders: postmaster@doxatalent.com
- Subject patterns (case-insensitive): "unsubscribe", "quarantine notification", "held messages", "new held messages", "your daily briefs"

### Bucket B: ROUTINE (count toward volume but skip ownership and SLA analysis)

Subject contains any of (case-insensitive): "weekly recruitment report", "weekly update", "daily update", "weekly report"

Same rationale as account-manager-inbox-analysis: when these threads escalate to require Michael's action, the subject changes ("Urgent", "Action Required", "Alignment Needed"); those escalations land in Bucket C with their updated subjects.

### Bucket C: ACTIONABLE (full analysis)

All emails not matching A or B. For each ACTIONABLE inbound email, assign two additional tags.

#### Tag 1: Sender Bucket

| Bucket | Rule |
|---|---|
| INTERNAL | Sender domain is doxatalent.com |
| CLIENT | Sender domain matches a known active client (extract domain as account name) |
| FORMER_CLIENT | Sender domain matches a known former client |
| EXTERNAL_OTHER | Sender is external but no domain match (covers gmail.com, vendors, prospects) |

#### Tag 2: Action Requirement (inbound only; Michael in `to` or `cc`)

| Classification | Logic |
|---|---|
| ACTION_REQUIRED | Direct question, escalation, request, "can you", "please", "?", deadline, complaint signals, or Michael in `to` and external sender |
| FYI | Newsletter, broadcast, Michael in `cc` only with no direct ask, automated notification, or routine status update |

Use Anthropic API (`claude-sonnet-4-20250514`) for ambiguous cases. Bias toward ACTION_REQUIRED. False positives are recoverable, false negatives hide accountability gaps.

#### Tag 3: Item Type and Expected Owner (ACTION_REQUIRED only)

Apply the Ownership Matrix above. For each ACTION_REQUIRED inbound, assign one item_type and derive expected_owner.

Use Anthropic API for ambiguous cases. Default expected_owner is Michael for any external client item that does not clearly fall into another category.

---

## Step 3: Match Responses, Detect Handoffs and Mismatches

For each ACTION_REQUIRED inbound, locate the first DOXA response in the same conversation.

Match by `conversationId`. Within the conversation, find the earliest message in Sent Items (any DOXA staff) where `sentDateTime` is after the inbound `receivedDateTime`.

Compute per ACTION_REQUIRED item:
- `time_to_first_response_business_hours`: business hours between inbound receipt and first DOXA reply
- `actual_responder`: email of the first DOXA staff member to reply
- `michael_responded`: whether Michael ever replied in the thread
- `michael_response_dt`: timestamp of Michael's reply if any
- `michael_substantive`: whether Michael's reply was substantive (true) or absent/perfunctory (false)
- `latest_thread_state`: who sent the most recent message in the thread

Reset SLA clock on each new client reply requiring action.

CC vs TO distinction: if Michael is only in `cc` and the body contains no direct ask to him, classify as FYI in Step 2 and skip response matching.

### Silent Handoff Detection

For every CLIENT inbound where Michael was in `to` (not just cc):
1. Find earliest reply after the inbound
2. If reply is from a non-Michael DOXA address, flag as silent_handoff (Critical)
3. Capture: original inbound, who replied, time gap, current thread state

Exclusions:
- Michael's calendar shows OOO during the handoff period AND coverage was an explicit arrangement
- The DOXA replier is on the original `to` line as a designated co-owner

### Ownership Mismatch Detection

Separate detection layer. Silent handoff measures whether Michael was bypassed; ownership mismatch measures whether the right DOXA person responded regardless.

For each ACTION_REQUIRED item, compare expected_owner (from Step 2) to actual_responder.

| Mismatch flag | Trigger condition | Severity |
|---|---|---|
| naji_as_am | actual_responder = naji.kubon AND expected_owner = michael.ross AND item_type in (client_rate_confirmation, client_question, client_referral_request, bench_inquiry, client_issue) | Critical |
| michael_doing_ops_work | actual_responder = michael.ross AND expected_owner in (operations, recruiter, tl_om) | Major |
| wrong_doxa_person | actual_responder is DOXA but neither expected_owner nor a recognized escalation path | Minor |
| correct_owner | actual_responder = expected_owner | (no flag, log as correct) |

Per detection capture: item_type, account, inbound subject and timestamp, expected_owner, actual_responder, michael_substantive in thread (yes/no, with time delta), email link.

---

## Step 4: Extract Commitments and Update Persistent Ledger

### Extract from Sent Items

For Michael's outbound emails (current 7-day window), extract explicit promises via Anthropic API.

System prompt: "Extract every explicit commitment from this email where the sender promises a specific deliverable with a stated or implied deadline. Return a JSON array. Each item has: commitment_text (verbatim quote), deliverable (what was promised), deadline (ISO date if stated, or 'unspecified'), recipient (email of person owed the deliverable), confidence (high if explicit promise with date, medium if explicit promise no date, low if soft commitment like 'I'll check'). Exclude soft commitments unless they include a date. Return [] if no commitments. JSON only, no preamble."

Confidence tiers:
- HIGH: explicit promise with date ("I'll send the proposal by Friday")
- MEDIUM: explicit promise no date ("I'll send the proposal")
- LOW: hedged language ("Let me check on that")

Track HIGH and MEDIUM in the daily ledger. LOW logged separately for trend visibility but generates no flags.

### Update Persistent Ledger

Read `_commitments-ledger.json` from `output_folder`. If missing, initialize as empty array.

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
  "confidence": "high | medium | low",
  "first_seen_run_date": "ISO date",
  "last_seen_run_date": "ISO date",
  "source_message_id": "internetMessageId",
  "source_web_link": "...",
  "fulfillment_evidence": null,
  "notes": "optional context like 'escalated to Ralph'"
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

## Step 5: AI Analysis via Anthropic API

Use `claude-sonnet-4-20250514`, max_tokens 4000. Three calls.

### Call A: Ownership Pattern Analysis

System prompt: "You are analyzing accountability detections for Michael Ross, a DOXA Talent co-founder responsible for strategic accounts. The data below shows ACTION_REQUIRED items where actual_responder did not match expected_owner. For each Naji-as-AM detection, identify (1) item type, (2) account, (3) whether Michael followed up substantively or whether Naji's response was treated as final, (4) timing pattern (was the inbound during business hours; did Naji respond within minutes vs hours). Then summarize (a) which item types Naji systematically owns instead of Michael, (b) which accounts show the heaviest pattern, (c) whether the pattern looks like Michael delegating downward or Naji overstepping (cite evidence). Return JSON only."

Input: all ownership mismatch detections from Step 3.

### Call B: Account Health Signals

System prompt: "You are analyzing email summaries for a DOXA account manager. Identify (1) accounts showing friction or dissatisfaction (complaints, escalations, missed deliverables, tone signals), (2) accounts with very low contact volume that may indicate disengagement or churn risk, (3) accounts with escalating thread complexity (same problem in multiple threads). Return JSON with three arrays: friction_accounts (name, evidence, risk_level: high/medium/low), silent_accounts (name, last_contact_estimate), escalation_accounts (name, pattern_description). No preamble or markdown."

Input: ACTIONABLE CLIENT emails grouped by domain.

### Call C: Open Commitment Risk

System prompt: "You are reviewing open commitments from a DOXA account manager's outbound email. For each open commitment, assess (1) likelihood the commitment will be missed based on the recipient and time elapsed, (2) blast radius if missed (low/medium/high based on recipient type and deliverable significance). Return JSON array. No preamble."

Input: open commitments from the persistent ledger.

---

## Step 6: Build Excel Workbook

Use `xlsx` skill conventions (openpyxl). Follow the standard skill formatting: navy `#052538` header fill, white text, Aptos size 11, freeze panes, alternating row shading.

DOXA brand color references for severity highlighting: Critical `#D41A69` (Crimson), Major `#F1AF21` (Gold), Minor `#00ADEF` (Blue), correct_owner `#05AF72` (Green).

### Workbook Sheets (daily report)

**Sheet 1: Summary** — two-column metric/value table with run date, audit window, total emails pulled (raw and dedup), noise/routine/actionable counts, action-required inbound count, responded within SLA (count and %), responded but breached SLA, unresponded, silent handoffs, ownership mismatches by type (naji_as_am, michael_doing_ops, other), ownership integrity score, open commitments tracked, commitments fulfilled and missed this period, and Critical/Major/Minor flag counts.

**Sheet 2: Critical Flags** — per Critical item: flag type (silent_handoff / naji_as_am / client_issue_24h+ / referral_4h+ / missed_commitment_overdue_1d+), detected at, account, sender, subject, inbound received, hours elapsed (business), status, email link, notes.

**Sheet 3: Major Flags** — same structure as Critical.

**Sheet 4: Minor Flags** — same structure.

**Sheet 5: Response Time Log** — every ACTION_REQUIRED inbound: inbound received, account, item type, sender, subject, michael_responded (yes/no), time to first response (business hours), within SLA, severity if breached, latest thread state, email link.

**Sheet 6: Ownership Analysis** — one row per ACTION_REQUIRED inbound. Columns: inbound time, account, sender, subject, item type, expected owner, actual responder, michael_substantive in thread, time gap, mismatch flag, severity, email link, notes. Sort: severity desc, then mismatch flag, then inbound time desc. Aggregate panel below table: total action-required items classified, correctly owned (count and %), naji_as_am detections (and breakdown by item type), michael_doing_ops_work detections, other mismatches, ownership integrity score.

**Sheet 7: Silent Handoffs** — detail view of detections from Step 3. One row per handoff with full context including DOXA staff member who covered.

**Sheet 8: Open Commitments** — active entries from `_commitments-ledger.json` where status = open. Columns: first seen, recipient, recipient type, deliverable, deadline, days since commitment, days until/past deadline, confidence, source email link.

**Sheet 9: Resolved This Period** — commitments where status changed to fulfilled or missed during this run.

**Sheet 10: Account Health Signals** — output from Step 5 Call B as a readable table.

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
wb.save(output_path)
```

---

## Step 7: Save Output

Date prefix = today's date (YYYY-MM-DD).

Daily target: `/Users/ralph/Documents/Claude/Projects/am-accountability-audit/YYYY-MM-DD-AM-Accountability-Report-Michael-Ross.xlsx`

Steps:
1. Generate at `/home/claude/YYYY-MM-DD-AM-Accountability-Report-Michael-Ross.xlsx`
2. Validate workbook opens cleanly via openpyxl reload check
3. Use `Filesystem:write_file` to write to the target path
4. Update `_commitments-ledger.json` in same folder
5. Confirm save path in chat
6. Call `present_files` for in-chat preview

If output folder is missing, create with `Filesystem:create_directory` first.

If today is Sunday OR an explicit weekly scorecard was requested, also generate the weekly scorecard (Step 8).

---

## Step 8: Sunday Weekly Scorecard

Filename: `YYYY-MM-DD-AM-Accountability-Weekly-Michael-Ross.xlsx` (date is the Sunday of the week being reported)

This file is in addition to the daily report, not a replacement.

Aggregates the past 7 daily runs. Read prior daily files in the output folder if they exist; otherwise run a fresh 7-day audit.

### Sheet 1: Scorecard Summary

Metrics with This week / Last week / 4-week avg / Trend columns: action-required inbound, responded within SLA (count and %), avg/median/p90 response time (business hours), silent handoffs, naji_as_am detections, michael_doing_ops_work detections, ownership integrity score, Critical flags, commitments made/fulfilled/missed/still open. Trend column: arrow indicator and percent change vs 4-week average.

### Sheet 2: Account-Level Performance

One row per account contacted this week. Columns: account, inbound action-required count, responded within SLA count, breached SLA count, unresponded count, silent handoffs, naji_as_am count, average response time, open commitments to this account, health flag.

Health flag logic:
- Red: any silent handoff OR any naji_as_am detection OR any unresponded action-required older than 24 business hours OR any missed commitment
- Yellow: SLA breach but eventually responded OR open commitment past deadline by less than 1 day
- Green: all action items addressed within SLA by correct owner

### Sheet 3: Ownership Pattern Analysis

Render output from Step 5 Call A (run for the full week's data).

### Sheet 4: Recommendation Summary

Week of, performance vs SLA (X% within SLA vs Y% last week), ownership integrity (X% vs Y% last week), top concern, trend assessment (Improving / Stable / Deteriorating based on 4-week comparison).

---

## Recurring Report Mode

Daily runs accumulate as date-prefixed files. Weekly scorecard runs every Sunday and references prior daily files for trend computation. Each run produces a new file; prior runs are not modified.

Schedule via Cowork once Phase 1 (manual tuning) is complete. Recommended schedule: daily 06:00 America/Chicago, weekly trigger inherently fires when day = Sunday.

---

## Error Handling

| Failure | Behavior |
|---|---|
| M365 auth error | Surface clearly, instruct Ralph to verify Mail.Read.Shared and delegate access on Michael's mailbox |
| Folder enumeration fails | Log, fall back to Inbox + Sent + Deleted only |
| Fewer than 10 unique emails after dedup | Warn of incomplete pull, do not generate report |
| Anthropic API failure on classification | Default to ACTION_REQUIRED for any ambiguous external client email; default expected_owner to Michael; degrade extraction silently |
| Filesystem write lock | Retry once after 5s, then surface error |
| Commitments ledger corrupt | Back up corrupt file to `_commitments-ledger.corrupt.YYYYMMDD.json`, initialize fresh |
| Output folder missing | Create with `Filesystem:create_directory` before writing |
| Volume cap reached (max_batches × 50 = 1000 emails) | Truncate window to what was retrieved, label report scope as "partial single-day" or "partial multi-day", continue with classification on retrieved set rather than aborting |

---

## Tuning Notes

This skill is intentionally aggressive on flagging. Expect false positives in early runs. After 2 weeks of daily runs, review and tune:

1. Action-required classifier sensitivity
2. Silent handoff exclusion list (designated co-owners per account)
3. Commitment confidence thresholds
4. Ownership matrix accuracy (item types miscategorized; legitimate Naji-first scenarios such as Michael OOO)
5. Pattern frequency week over week (does behavior shift after observation)

The persistent commitments ledger is the long-tail value. It survives the 7-day window and accumulates a defensible record of every promise made and whether it was kept.

The ownership analysis is the second-tier value. It surfaces structural role drift that response-time metrics alone cannot detect. Particular attention to the Naji-as-AM pattern: a Senior AE responding first to rate confirmations, bench inquiries, and routine client coordination indicates either misallocation of seniority (paying Senior AE comp for AM work) or Michael delegating his role downward. Both are operationally expensive. Track over time to confirm which interpretation is accurate and whether observed patterns shift after explicit role conversations.

For HR documentation use: every flag carries a direct email link. Any finding can be verified at the source. This is the difference between perception and evidence.

---

## File Locations

- Output folder: `/Users/ralph/Documents/Claude/Projects/am-accountability-audit/`
- Persistent ledger: `/Users/ralph/Documents/Claude/Projects/am-accountability-audit/_commitments-ledger.json`
- GitHub skill: `/Users/ralph/Documents/GitHub/Ralph-Claude-Connector/plugins/ralph-claude-connector/skills/am-accountability-audit/SKILL.md`
- Obsidian vault root: `/Users/ralph/Documents/Claude/`
- Companion skill: `account-manager-inbox-analysis` (different purpose: pattern analysis vs accountability documentation)
