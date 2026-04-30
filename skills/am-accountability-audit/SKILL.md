---
name: am-accountability-audit
description: >
  Daily accountability audit of Michael Ross's Outlook mailbox to detect dropped balls, slow responses, missed commitments, and silent handoffs. Trigger this skill whenever Ralph says "run the accountability audit", "audit Michael's email", "Michael Ross daily report", "AM accountability", "check Michael's follow-through", "/aaaudit", or any request to track an account manager's response times, missed deadlines, unresolved client issues, or commitments. Also trigger automatically on a daily schedule and produce a weekly scorecard every Sunday morning. Pulls a rolling 7-day window across Inbox, Sent Items, Deleted Items, Archive, and all subfolders. Classifies each external client email as action-required vs FYI, matches Michael's outbound responses, calculates time-to-first-response against aggressive SLAs, extracts explicit commitments with deadlines, persists open commitments across daily runs, and flags silent handoffs where someone else replied to a client email Michael ignored. Output is one Excel ledger per day plus a Sunday weekly scorecard, saved to the OneDrive Sales Team folder. This skill is for accountability and HR documentation, not pattern analysis. It complements but does not replace account-manager-inbox-analysis.
---

# AM Accountability Audit

Daily accountability audit of Michael Ross's mailbox. Outputs an Excel ledger documenting response times, missed SLAs, silent handoffs, open commitments, and unresolved client issues. Designed for HR-grade documentation. Aggressive flagging.

## Trigger

| Trigger | Behavior |
|---|---|
| `/aaaudit` slash command | Run daily audit |
| Natural language requests for accountability audit, daily Michael Ross report, response time tracking | Run daily audit |
| Day of week is Sunday | Run daily audit AND generate weekly scorecard |
| Explicit "weekly scorecard" request | Generate weekly scorecard only |

## Parameters

| Parameter | Default | Notes |
|---|---|---|
| `mailbox` | michael.ross@doxatalent.com | Requires M365 delegate access |
| `audit_window_days` | 7 | Rolling window, ending at run time |
| `internal_domain` | doxatalent.com | Sender from this domain is internal |
| `output_folder` | C:\Users\RalphNilssen\OneDrive - DOXA Talent\HR\Sales Team\Michael Ross\Daily Report | Direct write |
| `client_domains_file` | client-domains.csv (in skill folder) | Maps domain to account name and status |
| `business_hours` | Mon-Fri 08:00-18:00 America/Chicago | SLA clock pauses outside this window |
| `commitments_ledger` | _commitments-ledger.json (in output folder) | Persists open commitments across runs |

## SLA Matrix

All clocks measured in business hours only.

| Item type | First response SLA | Resolution SLA | Severity if breached |
|---|---|---|---|
| External client issue | 4 business hours | 2 business days | Critical at 24+ hours unresponded, Major otherwise |
| External client referral request | 2 business hours | Same business day | Critical at 4+ hours unresponded, Major otherwise |
| External client question (non-issue) | Same business day | 2 business days | Major |
| External client commitment with stated date | n/a | Stated deadline | Critical at deadline + 1 day, Major at deadline |
| Internal commitment to DOXA leader (David, Lauren, Stephen, Steve, Christina, Ralph) | Next business day | Stated deadline | Major |
| Internal commitment to TL/OM or other DOXA staff | 2 business days | Stated deadline | Minor |
| Silent handoff (someone else replied to client email Michael was on as primary recipient) | n/a | n/a | Critical, every instance |

---

## Step 1: Pull 7-Day Email Set

Use Microsoft 365 MCP. Pull from all folders, not just Inbox.

Folders to query for `mailbox` = michael.ross@doxatalent.com:
- Inbox and all subfolders
- Sent Items
- Deleted Items
- Archive
- Any custom folders (enumerate first via folder list, then query each)

For each folder, pull all messages where `receivedDateTime` (or `sentDateTime` for Sent) falls in the rolling 7-day window. Batch size 50 with offset pagination. Continue until results return fewer than 50 or 50 batches reached per folder.

Deduplicate by `internetMessageId` across all folders. Keep first occurrence with folder name preserved.

Per email, capture: `internetMessageId`, `conversationId`, `from` (email + display name), `to` (full list), `cc` (full list), `subject`, `bodyPreview`, `summary`, `receivedDateTime`, `sentDateTime`, `importance`, `hasAttachments`, `folderName`, `webLink`.

If `webLink` is unavailable, construct a deep link manually using `internetMessageId`.

---

## Step 2: Classify Each Email

For each unique email, assign two tags.

### Tag A: Sender bucket

| Bucket | Rule |
|---|---|
| INTERNAL | Sender domain is `doxatalent.com` |
| CLIENT | Sender domain matches `client-domains.csv` with status=active |
| FORMER_CLIENT | Sender domain matches `client-domains.csv` with status=former |
| EXTERNAL_OTHER | Sender is external but no domain match (covers gmail.com, google.com, vendors, prospects) |
| NOISE | Sender or subject matches noise patterns (see below) |

Noise patterns (exclude from analysis entirely):
- Domains: ninety.io, ess.barracudanetworks.com, calendly.com, circle.so, mindvalley.com, alert.refer.io, chorus.ai, zoominfo.com, mandrillapp.com
- Senders: postmaster@doxatalent.com
- Subject patterns (case-insensitive): "unsubscribe", "quarantine notification", "held messages", "your daily briefs"

### Tag B: Action requirement (inbound only)

For inbound emails (Michael in `to` or `cc`), classify whether a response was needed:

| Classification | Logic |
|---|---|
| ACTION_REQUIRED | Direct question, escalation language, request, "can you", "please", "?", deadline mention, complaint signals, missed-payment language, or Michael in `to` and external sender |
| FYI | Newsletter, weekly report, broadcast, Michael in `cc` only with no direct ask, automated notification, or routine status update |

Use Anthropic API (`claude-sonnet-4-20250514`) for ambiguous cases. Bias toward ACTION_REQUIRED in ambiguity. False positives are recoverable, false negatives hide accountability gaps.

### Tag C: Item type (action-required emails only)

| Item type | Detection signals |
|---|---|
| client_issue | Complaint, escalation, problem, "not working", "concerned", "unhappy", "failed", "error", VIP performance complaint |
| referral_request | "Can you refer", "introduction to", "looking for someone who", "do you know" |
| client_question | Question or request that is not an issue |
| client_commitment_due | Inbound email referencing a prior promise or asking for a deliverable |
| internal_leader_request | Sender is David Nilssen, Lauren Hoover, Stephen Hosemann, Steve Gire, Christina Chambers, or Ralph Nilssen |
| internal_other | Other internal action-required |

---

## Step 3: Match Responses

For each ACTION_REQUIRED inbound email, search for Michael's response.

Match by `conversationId`. Within the same conversation, find the earliest message in Sent Items where `from` is michael.ross@doxatalent.com and `sentDateTime` is after the inbound `receivedDateTime`.

Compute:
- `time_to_first_response_business_hours`: business hours between inbound receipt and Michael's reply
- `responded`: true/false
- `latest_thread_state`: who sent the most recent message in the thread (Michael, original sender, or another DOXA person)
- `silent_handoff`: true if a non-Michael DOXA staff member replied to the client before Michael did

Reset clock on each new client reply requiring action. If a thread has Michael's reply followed by a new client question, that new question starts a fresh SLA clock.

CC versus To distinction: if Michael is only in `cc` and the body contains no direct ask to him, classify as FYI in Step 2 and skip response matching.

---

## Step 4: Extract Commitments

For Michael's outbound emails (Sent Items, current 7-day window plus prior runs' open commitments), extract explicit promises.

Use Anthropic API to extract commitments. System prompt:

"Extract every explicit commitment from this email where the sender promises a specific deliverable with a stated or implied deadline. Return a JSON array. Each item has: commitment_text (verbatim quote), deliverable (what was promised), deadline (ISO date if stated, or 'unspecified'), recipient (email of person owed the deliverable), confidence (high if explicit promise with date, medium if explicit promise no date, low if soft commitment like 'I'll check'). Exclude soft commitments unless they include a date. Return [] if no commitments. JSON only, no preamble."

Confidence tiers:
- HIGH: explicit promise with date ("I'll send the proposal by Friday")
- MEDIUM: explicit promise no date ("I'll send the proposal")
- LOW: hedged language ("Let me check on that")

Track only HIGH and MEDIUM in the daily ledger. LOW is logged in a separate "soft commitments" tab for trend visibility but does not generate flags.

---

## Step 5: Detect Silent Handoffs

For every CLIENT inbound email where Michael was in `to` (not just cc), examine the conversation thread:

1. Find the earliest reply after the inbound
2. If that reply is from a non-Michael DOXA person (any `@doxatalent.com` address other than michael.ross), flag as silent handoff
3. Capture: original inbound, who replied, time gap, current thread status

Silent handoff is a Critical severity flag every time. This is the single most damning pattern and the primary indicator that Michael is letting things slide.

Exclusions:
- Out-of-office period (Michael's calendar shows OOO and the handoff was an explicit coverage arrangement)
- The DOXA replier is on the original `to` line as a designated co-owner

---

## Step 6: Update Persistent Commitments Ledger

Read `_commitments-ledger.json` from the output folder. If missing, initialize as empty array.

Schema per entry:
```
{
  "id": "sha256 hash of commitment_text + recipient + sentDateTime",
  "commitment_text": "...",
  "deliverable": "...",
  "deadline": "ISO date or null",
  "recipient": "email",
  "recipient_type": "client|internal_leader|internal_other",
  "source_message_id": "internetMessageId",
  "source_web_link": "...",
  "first_seen_run_date": "ISO date",
  "last_seen_run_date": "ISO date",
  "status": "open|fulfilled|missed|stale",
  "fulfillment_evidence": null
}
```

Process:
1. Add new commitments extracted in Step 4 (skip duplicates by id)
2. For each open commitment, check if Michael has sent a follow-up email to the recipient referencing the deliverable since the commitment was made. If yes, mark `status = fulfilled` and capture the message id as `fulfillment_evidence`.
3. For each open commitment where `deadline` is past and no fulfillment evidence: mark `status = missed`
4. For commitments older than 21 days with no deadline and no fulfillment: mark `status = stale`
5. Save updated ledger back to `_commitments-ledger.json`

Fulfillment detection uses Anthropic API on the candidate follow-up email plus the original commitment text. System prompt: "Did this email fulfill the stated commitment? Return JSON {fulfilled: true|false, evidence: short quote}. Be strict. Acknowledgment without delivery is not fulfillment."

---

## Step 7: Build Daily Excel Output

Use `xlsx` skill conventions. One workbook with the following sheets.

Filename: `Michael Ross Daily Report YYYY-MM-DD.xlsx` (today's date)

### Sheet 1: Summary

Top section, two columns:

| Metric | Value |
|---|---|
| Run date | today |
| Audit window | start to end |
| Total emails pulled | N |
| Deduplicated | N |
| Action-required inbound | N |
| Responded within SLA | N (X%) |
| Responded but breached SLA | N (X%) |
| Unresponded | N (X%) |
| Silent handoffs detected | N |
| Open commitments tracked | N |
| Commitments fulfilled this period | N |
| Commitments missed this period | N |
| Critical flags this run | N |
| Major flags this run | N |
| Minor flags this run | N |

### Sheet 2: Critical Flags

One row per Critical severity item. Columns:

| Column | Source |
|---|---|
| Flag type | "silent_handoff" / "client_issue_24h+" / "referral_4h+" / "missed_commitment_overdue_1d+" |
| Detected at | timestamp |
| Account | from client-domains.csv |
| Sender | display name and email |
| Subject | original |
| Inbound received | timestamp |
| Hours elapsed (business) | computed |
| Status | unresponded / handoff_by_X / missed |
| Email link | webLink |
| Notes | short |

### Sheet 3: Major Flags

Same structure as Critical, for Major severity items.

### Sheet 4: Minor Flags

Same structure, for Minor severity items.

### Sheet 5: Response Time Log

Every action-required inbound this period. Columns:

| Column |
|---|
| Inbound received |
| Account |
| Item type |
| Sender |
| Subject |
| Michael responded? |
| Time to first response (business hours) |
| Within SLA? |
| Severity if breached |
| Latest thread state |
| Email link |

### Sheet 6: Open Commitments

Active entries from `_commitments-ledger.json` where `status = open`. Columns:

| Column |
|---|
| First seen |
| Recipient |
| Recipient type |
| Deliverable |
| Deadline |
| Days since commitment |
| Days until/past deadline |
| Confidence |
| Source email link |

### Sheet 7: Resolved This Period

Commitments where status changed to fulfilled or missed during this run.

### Sheet 8: Silent Handoffs

Detail view of Step 5 detections. One row per handoff with full context including DOXA staff member who covered.

### Sheet 9: FYI Snapshot

Top 10 accounts by inbound action-required volume this period, plus any account with zero contact in 14+ days flagged as silent.

### Formatting

- Header row: white text on navy `#052538`, bold
- Critical flags sheet: red accent in flag type column (`#D41A69` text)
- Major flags: gold accent (`#F1AF21`)
- Minor flags: blue accent (`#00ADEF`)
- Body font: Aptos, size 11
- Auto-fit column widths
- Freeze top row

---

## Step 8: Sunday Weekly Scorecard

Trigger: run day is Sunday OR explicit weekly scorecard request.

Filename: `Michael Ross Weekly Scorecard YYYY-WW.xlsx` (ISO week number)

This is in addition to the daily file, not a replacement.

Aggregates the past 7 daily runs. If prior daily files exist in the output folder, read them. If not, run a fresh 7-day audit and treat that as the week.

### Sheet 1: Scorecard Summary

| Metric | This week | Last week | 4-week avg | Trend |
|---|---|---|---|---|
| Action-required inbound | | | | |
| Responded within SLA (count and %) | | | | |
| Average response time, business hours | | | | |
| Median response time, business hours | | | | |
| 90th percentile response time | | | | |
| Silent handoffs | | | | |
| Critical flags | | | | |
| Commitments made | | | | |
| Commitments fulfilled | | | | |
| Commitments missed | | | | |
| Commitments still open | | | | |

Trend column: arrow indicator and percent change vs 4-week average.

### Sheet 2: Account-Level Performance

One row per account contacted this week. Columns:

| Column |
|---|
| Account |
| Inbound action-required count |
| Responded within SLA count |
| Breached SLA count |
| Unresponded count |
| Silent handoffs |
| Average response time |
| Open commitments to this account |
| Health flag (Green/Yellow/Red) |

Health flag logic:
- Red: any silent handoff OR any unresponded action-required older than 24 business hours OR any missed commitment
- Yellow: SLA breach but eventually responded OR open commitment past deadline by less than 1 day
- Green: all action items addressed within SLA

### Sheet 3: Pattern Analysis

Use Anthropic API to analyze the week's flagged items. System prompt:

"Given this week's flagged emails and missed commitments for an account manager, identify (1) patterns in what types of items get dropped or delayed, (2) accounts that consistently see slow response, (3) any time-of-day or day-of-week pattern in breaches. Return JSON with three arrays: dropped_patterns, slow_accounts, temporal_patterns. Each entry includes evidence_count and short_description. JSON only."

Render as a readable table.

### Sheet 4: Recommendation Summary

Brief plain-language summary at the top of the workbook for the leadership view:

| Field | Content |
|---|---|
| Week of | start to end |
| Performance vs SLA | X% within SLA (vs Y% last week) |
| Top concern | highest severity unresolved item |
| Trend assessment | "Improving / Stable / Deteriorating" based on 4-week comparison |

---

## Step 9: Save and Present

1. Write daily Excel directly to `output_folder` using `Filesystem:write_file`
2. If Sunday or weekly requested, also write weekly scorecard to same folder
3. Update `_commitments-ledger.json` in same folder
4. Call `present_files` with the daily report (and weekly if generated) for in-chat preview
5. Confirm save paths in chat

If OneDrive write fails due to file lock or sync conflict, retry once after 5 seconds. If still fails, save to fallback path and report it.

---

## Anthropic API Calls

Use `claude-sonnet-4-20250514`, max_tokens 2000, batch where possible. Estimated calls per daily run:

| Purpose | Volume |
|---|---|
| Action-required classification (ambiguous cases only) | 10-30 |
| Commitment extraction from Michael's outbound | 1 batch per 20 emails |
| Fulfillment detection | 1 per open commitment with candidate follow-up |
| Sunday pattern analysis | 1 |

---

## Error Handling

| Failure | Behavior |
|---|---|
| M365 auth error | Surface clearly, instruct Ralph to verify delegate access on Michael's mailbox |
| Folder enumeration fails | Log, fall back to Inbox + Sent + Deleted only |
| Fewer than 10 unique emails after dedup | Warn of likely incomplete pull, do not generate report |
| Anthropic API failure on classification | Default to ACTION_REQUIRED for any ambiguous external client email; degrade extraction silently |
| OneDrive write lock | Retry once after 5s, then fall back to local path |
| Commitments ledger corrupt | Back up corrupt file to `_commitments-ledger.corrupt.YYYYMMDD.json`, initialize fresh |
| client-domains.csv missing | Treat all external as EXTERNAL_OTHER, log warning |

---

## File Locations

- Skill folder: `C:\Users\RalphNilssen\GitHub\Ralph-Claude-Connector\skills\am-accountability-audit\`
- Daily output: `C:\Users\RalphNilssen\OneDrive - DOXA Talent\HR\Sales Team\Michael Ross\Daily Report\Michael Ross Daily Report YYYY-MM-DD.xlsx`
- Weekly output: same folder, `Michael Ross Weekly Scorecard YYYY-WW.xlsx`
- Persistent ledger: same folder, `_commitments-ledger.json`
- Fallback output: `C:\Users\RalphNilssen\Obsidian\Claude\outputs\am-accountability-audit\`
- Client domains reference: `client-domains.csv` in the skill folder

---

## Design Notes for Future Iteration

This skill is intentionally aggressive on flagging. Expect false positives in early runs. After 2 weeks of daily runs, review false positive rate and tune:

- Action-required classifier sensitivity
- Silent handoff exclusion list (designated co-owners per account)
- Commitment confidence thresholds

The persistent commitments ledger is the long-tail value. It survives the 7-day window and accumulates a defensible record of every promise made and whether it was kept.

For HR documentation use: every flag carries a direct email link. Any finding can be verified at the source. This is the difference between perception and evidence.
