---
name: sales-call-analysis
description: Analyze DOXA sales call data and generate a Word memo (.docx) scoring each rep using Mark Roberge's Sales Acceleration Formula framework. Use this skill whenever the user says things like "run the sales analysis," "run the sales coaching memo," "grade my reps," "Roberge analysis," "analyze the calls," "#salescoaching," "review my transcripts," "score my reps," or any request for sales coaching analysis, performance review, or "how are my salespeople doing." Pulls ZRA analytics and VTT transcripts directly from the Zoom API via Server-to-Server OAuth. Apply a date-range filter only when the user explicitly scopes the request (for example "just April calls," "last week only," "past 14 days"); defaults to the past 30 days. Do not wait for the user to say "skill"; any sales coaching request routes here.
---

# Sales Call Analysis

## What this skill does

Reads DOXA sales call data, analyzes each representative using Mark Roberge's Sales Acceleration Formula (SAF) framework, and produces a professional Word memo (.docx). Pulls conversations, ZRA analytics, summaries, and VTT transcripts directly from the Zoom API via a Server-to-Server OAuth app. Cross-rep admin access, no permission blockers, single source of truth.

Output: one page per rep, a team-level observations page, a recommended interventions table, and a leadership evaluation page for Ralph Nilssen.

Transcript record shape (canonical, all modes converge here before scoring):
```
RepSlug/<conversation-id>.txt        ← speaker-tagged transcript
RepSlug/<conversation-id>.meta.json  ← ZRA analytics + deal + topics + summary
```

Transcript line format (used by Step 8 ingest and Step 9 scoring):
```
[SpeakerName] {HH:MM:SS} utterance
```

---

## Step 0: Confirm Source Mode

This skill runs in ZOOM_API_MODE exclusively. State: "Pulling from the Zoom API." Then proceed to Step 1.

Do not narrate the mode detection.

---

## Step 1: Load API Credentials and Helpers

Read Zoom credentials via the Filesystem tool from:
```
C:\Users\RalphNilssen\Obsidian\Claude\reference\zoom_api.json
```

Expected shape:
```json
{
  "account_id":    "...",
  "client_id":     "...",
  "client_secret": "..."
}
```

If the file is missing or any of the three fields is empty, halt and tell the user:
> "Zoom API credentials not configured. Create `C:\Users\RalphNilssen\Obsidian\Claude\reference\zoom_api.json` with `account_id`, `client_id`, and `client_secret` from the Server-to-Server OAuth app."

After reading the credentials, write them to a session-scoped path the helper script can read:
```bash
mkdir -p /home/claude
cat > /home/claude/zoom_api.json <<'JSON'
{ ...credentials json... }
JSON
chmod 600 /home/claude/zoom_api.json
```

Copy the helper script into the working directory:
```bash
cp scripts/zoom_client.py /home/claude/zoom_client.py
```

The helper exposes a `ZoomClient` class and a CLI. The skill primarily uses it as a module via inline Python in `bash_tool`. Set `ZOOM_CONFIG_PATH=/home/claude/zoom_api.json` for any invocation.

---

## Step 2: Load Team Structure

The team structure file is the authoritative source regardless of mode. Read it via the Filesystem tool:

```
C:\Users\RalphNilssen\Obsidian\Claude\reference\project_team_structure.json
```

If the file is missing or unreadable, ask the user to paste the roster in chat. Do not invent a roster.

Parse and display a compact summary (name / role / group / email) and ask:
> "Is this team structure still accurate?"

Wait for confirmation or correction before proceeding.

**Key fields used downstream:**
- `manager.name`, `manager.email` — used in internal-only filter (Ralph's emails/names are always treated as internal)
- `team_members[].name`, `.zoom_display_names[]` — used for speaker attribution (fuzzy match in transcript and participant list)
- `team_members[].email` — REQUIRED for user resolution. If missing, halt and ask.
- `team_members[].compliance_recording_required` — triggers red callout if recording gap
- `internal_meeting_patterns.topic_regex_exclude[]` — applied to `conversation_topic`
- `internal_meeting_patterns.min_duration_minutes` — derived from `duration_sec`

---

## Step 2b: Load Prior Scorecard

Check for existing scorecards in the persistent output folder using the Filesystem tool:

```
C:\Users\RalphNilssen\Obsidian\Claude\outputs\sales-analysis\
```

List all `.json` files in that folder. Sort by filename descending (filenames are date-prefixed: `YYYY-MM-DD-scorecard.json`). Read the most recent one.

If a prior scorecard is found, store it as `PRIOR_SCORECARD` for use in Step 10. Load silently — do not surface to the user.

If the folder is empty or does not exist, set `PRIOR_SCORECARD = null`. The delta section in Step 10 will be skipped for this run.

Scorecard schema (read and write format):
```json
{
  "run_date": "YYYY-MM-DD",
  "scope": "past 30 days | YYYY-MM-DD to YYYY-MM-DD",
  "mode": "ZOOM_API_MODE",
  "roster_filter": {
    "groups": ["Biz Dev Officers", "Franchisees"],
    "names":  ["Michael Ross"]
  },
  "buckets": [
    {"label": "Apr 2-8",   "from": "2026-04-02", "to": "2026-04-08"},
    {"label": "Apr 9-15",  "from": "2026-04-09", "to": "2026-04-15"},
    {"label": "Apr 16-22", "from": "2026-04-16", "to": "2026-04-22"},
    {"label": "Apr 23-29", "from": "2026-04-23", "to": "2026-04-29"}
  ],
  "reps": [
    {
      "name": "Rep Name",
      "role": "BDR | Account Manager | Seller",
      "group": "Biz Dev Officers | Client Success | Franchisees",
      "transcript_count": 4,
      "scores": {
        "Rapport / Relationship": "Strong",
        "Discovery": "Developing",
        "Qualification": "Good",
        "Product Knowledge": "Strong",
        "Value Articulation": "Adequate",
        "Call Control": "Good",
        "Objection / Friction Handling": "Weak",
        "Closing / Forward Motion": "Developing"
      },
      "bucket_scores": {
        "Apr 2-8":   {"Discovery": "Developing", "...": "..."},
        "Apr 9-15":  {"Discovery": "Adequate",   "...": "..."},
        "Apr 16-22": {"Discovery": "Good",       "...": "..."},
        "Apr 23-29": {"Discovery": "Good",       "...": "..."}
      },
      "trend": {
        "Discovery": 2,
        "Qualification": 0,
        "Closing / Forward Motion": -1
      },
      "weekly_volume": [
        {"num": 13, "label": "Mar 22-28",   "count": 0},
        {"num": 14, "label": "Mar 29-Apr 4","count": 3},
        {"num": 15, "label": "Apr 5-11",    "count": 5},
        {"num": 16, "label": "Apr 12-18",   "count": 4},
        {"num": 17, "label": "Apr 19-25",   "count": 0},
        {"num": 18, "label": "Apr 26-May 2","count": 2}
      ]
    }
  ]
}
```

For reps scored under the limited-data format (fewer than 2 transcripts), omit the `scores`, `bucket_scores`, and `trend` objects and set `"limited_data": true`. These reps are excluded from delta comparison.

A bucket entry inside `bucket_scores` may be `"insufficient": true` (less than 3 calls in that bucket); when present, that bucket is excluded from the trend computation.

---

## Step 3: Confirm Scope

Default scope is the **past 30 days** (rolling window from today). State: "Pulling the past 30 days of ZRA conversations across the team." Proceed to Step 4 unless the user scoped differently in their original request.

If the user scoped the request:
- Accept natural language and convert to a UTC date range
- Default timezone: `America/Chicago` (Maplewood, MN); only ask if ambiguous
- Store the range for use in Step 4 and downstream framing

### Roster scope (who gets scored)

Default scope (no override required):
```
ROSTER_GROUPS = ["Biz Dev Officers", "Franchisees"]
ROSTER_NAMES  = ["Michael Ross"]
```

A team member is in scope if their `group` is in `ROSTER_GROUPS` OR their `name` matches `ROSTER_NAMES`. Members not matching either filter are skipped silently.

Override patterns the user may invoke:
- "score everyone" → `ROSTER_GROUPS` = all groups in roster, `ROSTER_NAMES` = []
- "just BDOs" → `ROSTER_GROUPS` = ["Biz Dev Officers"], `ROSTER_NAMES` = []
- "include the AMs" → add "Client Success" to `ROSTER_GROUPS`
- "score [Name]" → append to `ROSTER_NAMES`

If `team_structure.json` does not carry a `group` field for members, fall back to matching `ROSTER_NAMES` only and surface a one-line note in Step 7 ("Roster file does not include groups; included by name only.").

### Time bucketing (intra-run trend)

For all scored runs, divide the scope window into **4 equal buckets** by `meeting_start_time`, ordered oldest to newest. Bucket labels use date ranges (e.g., "Apr 2-8", "Apr 9-15").

If the scope window is under 8 days, fall back to **2 buckets** (drop the trend table entirely and surface a one-line note: "Window too short for 4-bucket trend; showing single-period scoring only.").

Each bucket is scored independently in Step 9. A bucket needs at least **3 calls** to be scored. Buckets with fewer than 3 calls are marked "Insufficient" and excluded from the trend column.

### State scope summary

State one of:
- Unscoped: "Pulling the past 30 days of ZRA conversations for [N] reps in scope."
- Scoped: "Pulling ZRA conversations between [start] and [end] for [N] reps in scope."

---

## Step 4: Enumerate Conversations

### ZOOM_API_MODE

For each non-Ralph entry in `team_members[]` whose `email` is present **and which passes the ROSTER_GROUPS / ROSTER_NAMES filter from Step 3**, resolve to a Zoom user_id and pull conversations in the scope window.

Run as a single Python invocation:

```bash
ZOOM_CONFIG_PATH=/home/claude/zoom_api.json python3 - <<'PY'
import json, sys
sys.path.insert(0, '/home/claude')
from zoom_client import ZoomClient

z = ZoomClient.from_config()
roster = json.load(open('/home/claude/team_structure.json'))  # written in Step 2
FROM, TO = "<SCOPE_FROM>", "<SCOPE_TO>"   # YYYY-MM-DD
ROSTER_GROUPS = ["Biz Dev Officers", "Franchisees"]   # from Step 3
ROSTER_NAMES  = ["Michael Ross"]

def in_scope(m):
    if m.get("name") in ROSTER_NAMES: return True
    if m.get("group") in ROSTER_GROUPS: return True
    return False

manifest = {"reps": [], "skipped": []}
for m in roster["team_members"]:
    if not m.get("email"):
        manifest["skipped"].append({"name": m.get("name"), "reason": "no email"})
        continue
    if not in_scope(m):
        manifest["skipped"].append({"name": m.get("name"), "reason": "out of roster scope"})
        continue
    try:
        u = z.resolve_user(m["email"])
    except Exception as e:
        manifest["reps"].append({"name": m["name"], "error": str(e)}); continue
    convs = z.list_conversations(u["id"], FROM, TO)
    manifest["reps"].append({
        "name": m["name"], "email": m["email"], "group": m.get("group"),
        "zoom_user_id": u["id"], "conversations": convs,
    })

with open("/home/claude/manifest.json", "w") as f:
    json.dump(manifest, f, indent=2, default=str)

for r in manifest["reps"]:
    if "error" in r:
        print(f"  ! {r['name']}: {r['error']}")
    else:
        print(f"  {r['name']:<20s}  {len(r['conversations']):3d} conversations")
print(f"\nSkipped (out of scope): {len(manifest['skipped'])}")
PY
```

The list response already carries headline metrics (engagement_score, sentiment_score, engaging_questions_count, next_steps_count, filler_words_count, duration_sec, topic_mentioned, conversation_topic, meeting_start_time, meeting_uuid, host_email). No deep pull required at this stage.

### Volume cap

After classification (Step 5) and speaker filtering (Step 6), if the candidate prospect set exceeds 100, keep only the 100 most recent by start time (descending). Drop the rest silently from the analysis set but surface the cap in the Step 7 classification display and again in the memo preamble (e.g., "Capped at the 100 most recent prospect conversations out of N total"). Team Trainings / LEADERSHIP_EVAL files are not subject to the cap.

---

## Step 5: Classify Conversations

Apply classification in this order:

1. **Training content** → LEADERSHIP_EVAL (feeds Step 11 only, not rep scoring).
   - `conversation_topic` matches `team training`, `weekly call`, `coaching`, or similar training indicators (case-insensitive).
2. **Internal meeting** → INTERNAL, exclude.
   - `conversation_topic` matches any `internal_meeting_patterns.topic_regex_exclude` pattern (e.g., 1:1, sync, huddle, L10, MBR, "Personal Meeting Room").
3. **Sub-threshold** → SKIP.
   - `duration_sec < 300` (5 minutes) AND `engagement_score == 0` AND no summary text. These are no-shows or test calls. Surface count in Step 7 but exclude from analysis.
4. **Otherwise** → candidate PROSPECT call.
   - Rep attribution = `host_email` matched to roster `team_members[].email`.

After initial classification, apply the speaker-based filter in Step 6.

---

## Step 6: Speaker Filter — "Sole External Party" Rule

For each candidate PROSPECT conversation, extract the unique list of participants from the embedded `participants[]` field after the deep pull (Step 8). If the deep pull has not run yet, defer this rule until Step 8 completes. (To avoid the dependency, the deep pull can be issued before final classification — see Step 8.)

Match each participant or speaker to the team roster using fuzzy name matching (first name + last name, handle first-name-only aliases per `zoom_display_names`, handle "Last, First" variants, match `manager.name` for Ralph). Note transcript bot artifacts (e.g., `read.ai meeting notes`, `Fathom Notetaker`, `Otter.ai`) do not count as external participants — strip them before evaluating the rule.

Rule: if ALL non-bot participants match the team roster (including Ralph), classify as INTERNAL and exclude. If at least one participant is unmatched (prospect or external client), keep as PROSPECT.

This implements "exclude when I am the sole external party" — no prospect present means no coaching content worth scoring.

---

## Step 7: Present Classification for Confirmation

Display two tables to the user before pulling full content:

**Prospect Conversations** (N): rep, date, conversation_topic, duration, engagement_score, external participants
**Excluded** (M): topic/filename, reason (internal / training / sub-threshold / speaker-only-internal)

If the 100-conversation cap was applied in Step 4, state it explicitly above the Prospect Conversations table:
> "X prospect conversations matched. Capped at the 100 most recent. Y dropped."

Ask:
> "This is what I'll analyze and what I'll set aside. Reclassify anything before I pull the full content?"

Wait for confirmation or user reclassifications.

Also report:
> "Team Trainings found: K. These will inform the Leadership Evaluation."

---

## Step 8: Pull Full Content

For each confirmed PROSPECT and LEADERSHIP_EVAL conversation, do a single deep pull plus a VTT transcript fetch. Save both to disk for reuse.

```bash
ZOOM_CONFIG_PATH=/home/claude/zoom_api.json python3 - <<'PY'
import json, os, sys
sys.path.insert(0, '/home/claude')
from zoom_client import ZoomClient, vtt_to_transcript

z = ZoomClient.from_config()
manifest = json.load(open("/home/claude/manifest.json"))
keep_ids = set(json.load(open("/home/claude/keep_ids.json")))   # written after Step 7

os.makedirs("/home/claude/transcripts", exist_ok=True)
for rep in manifest.get("reps", []):
    slug = rep["name"].lower().replace(" ", "-")
    rep_dir = f"/home/claude/transcripts/{slug}"
    os.makedirs(rep_dir, exist_ok=True)
    for c in rep.get("conversations", []):
        cid = c["conversation_id"]
        if cid not in keep_ids: continue
        try:
            full = z.deep_pull(cid)
        except Exception as e:
            print(f"  ! deep_pull {cid}: {e}"); continue
        with open(f"{rep_dir}/{cid.replace('/','_').replace('+','_')}.meta.json", "w") as f:
            json.dump(full, f, indent=2, default=str)
        vtt = z.fetch_transcript(c["meeting_uuid"])
        if vtt:
            transcript = vtt_to_transcript(vtt)
            with open(f"{rep_dir}/{cid.replace('/','_').replace('+','_')}.txt", "w") as f:
                f.write(transcript)
        else:
            print(f"  - no VTT for {cid}")
PY
```

Each conversation produces two files: `<id>.meta.json` (ZRA analytics) and `<id>.txt` (transcript). Step 9 reads both. If a VTT is unavailable for a given conversation, score from the meta only and note the data limitation in the rep's profile narrative.

### Culture Index PDFs

If the user has uploaded any CI PDFs in this chat session or they exist in the Sales folder, read them and use for coaching framing only. Do not reference CI or the framework in output.

---

## Step 9: Score Each Rep — Universal Skill Dimensions

**Every rep is scored on the same 8 dimensions, regardless of role.** Seller interpretations apply to new-business execution; AM interpretations apply to retention/expansion.

| # | Dimension | Seller Interpretation | AM Interpretation |
|---|---|---|---|
| 1 | **Rapport / Relationship** | Opens warmly, genuine curiosity, prospect connects | Client recall depth, personal context, emotional equity |
| 2 | **Discovery** | Leads with diagnostic questions before pitching | Surfaces unmet needs and expansion signals organically |
| 3 | **Qualification** | Applies ICP filter, disengages from non-fits | Identifies account fit for expansion; scopes realistically |
| 4 | **Product Knowledge** | Answers technical questions without deferring | Knows DOXA capabilities well enough to match to account needs |
| 5 | **Value Articulation** | Ties pitch to buyer's specific pain, uses proof points | Connects DOXA's impact to client's business outcomes |
| 6 | **Call Control** | Owns agenda, prevents tangents, redirects | Structures check-ins with purpose; doesn't let inertia run the call |
| 7 | **Objection / Friction Handling** | Anticipates or reframes objections cleanly | Handles complaints and escalations without defensiveness |
| 8 | **Closing / Forward Motion** | Exits with committed next step and decision timeline | Creates urgency for expansion; does not leave calls open-ended |

**Rating vocabulary (8 terms only):**
Excellent / Very Strong / Strong / Good / Adequate / Developing / Weak / Gap

Use no other rating words. "Gap" means no evidence of the skill was found — cannot be scored without additional recordings.

**Ratings are diagnostic, not grades.** A "Weak" rating on Closing means that is the coaching target — not that the rep is failing. Write ratings the way a respected coach would: direct, evidence-grounded, always paired with a specific coaching priority.

### Use ZRA signals where they earn it

The meta.json carries pre-computed signal that maps cleanly onto several dimensions. Use it as quantitative grounding alongside transcript evidence — never as the sole basis for a rating.

| Dimension | Primary signal source | ZRA grounding (when available) |
|---|---|---|
| Rapport / Relationship | Transcript opening 5-10 minutes | sentiment_score, opening moments |
| Discovery | Transcript questions in first half | engaging_questions_count, topic_mentioned breadth |
| Qualification | Transcript fit-criteria and disqualification language | summary, deal.stage, deal.close_date if linked |
| Product Knowledge | Transcript answer specificity, technical depth | summary |
| Value Articulation | Transcript pain-tied claims and proof points | summary |
| Call Control | Transcript agenda setting, redirects, talk dynamics | engagement_score |
| Objection / Friction Handling | Transcript objection moments and rep response | summary moments |
| Closing / Forward Motion | Transcript closing 5-10 minutes | next_steps_count |

Filler_words_count is a secondary clarity signal, not a Roberge dimension. Note it in the rep narrative when materially elevated (>200 in a 30-minute call) but do not score it.

If the meta.json shows engagement_score == 0 and sentiment_score == 0, treat it as no ZRA signal (sub-threshold call) and lean entirely on transcript evidence.

### Bucketed scoring (intra-run trend)

After the aggregate scoring pass produces the rep's primary 8-dimension ratings, run a second pass:

1. Partition the rep's prospect calls into the time buckets defined in Step 3 (default 4 buckets across the scope window, by `meeting_start_time`).
2. For each bucket with at least 3 calls, score the same 8 dimensions using only the calls in that bucket. Use the same rating vocabulary.
3. For each dimension, compute the trend value as the difference (in rating-ladder steps) between the **earliest** scored bucket and the **latest** scored bucket. Ladder: Excellent=8, Very Strong=7, Strong=6, Good=5, Adequate=4, Developing=3, Weak=2, Gap=1.
4. Trend value rendering:
   - `+N` for improvement of N steps (e.g., Developing → Good = +2)
   - `−N` for regression of N steps
   - `0` for held
   - `—` if fewer than 2 buckets were scoreable

Skip the bucketed pass for any rep flagged as limited-data (fewer than 2 prospect calls overall). The intra-run trend block is omitted for that rep.

The aggregate (primary) rating remains the canonical "current state" view. Bucket ratings show the trajectory underneath it.

### Weekly volume per rep

After scoring is complete, compute each rep's call volume distributed across the **last 6 US business weeks (Sun-Sat)** ending the week containing today. Use the helpers in `zoom_client.py`:

```python
from datetime import date
from zoom_client import last_n_business_weeks

weeks = last_n_business_weeks(date.today(), 6)  # oldest first; each: {num, sun_start, sat_end, label}
for rep in reps:
    rep_weeks = [dict(w, count=0) for w in weeks]
    for call in rep["scored_prospect_calls"]:
        d = parse_iso_dt(call["meta"]["meeting_start_time"]).date()
        for w in rep_weeks:
            if w["sun_start"] <= d <= w["sat_end"]:
                w["count"] += 1
                break
    rep["weekly_volume"] = [
        {"num": w["num"], "label": w["label"], "count": w["count"]} for w in rep_weeks
    ]
```

The volume reflects **scored prospect calls only** (post all filters). Weeks that fall outside the scoring scope show 0 naturally; this is informative, not an error. If the user asks "why is Week 13 zero," the answer is "scope was 30 days; widen scope to populate."

The `weekly_volume` block lands directly under "Calls reviewed" in the memo (Step 10).

**Limited data reps:** If a rep has fewer than 2 prospect conversations, use a 3-row table with columns relabeled "Dimension | Status | Note":
- Row 1: "Sales Activity" | "Confirmed" or "Unknown" | what was submitted
- Row 2: "Full Assessment" | "Pending" | what's missing and why it matters
- Row 3: "Immediate Priority" | context-appropriate label | specific next action

The Immediate Priority row should reflect what the data actually suggests. If there is reason to believe the recording gap reflects low activity or engagement friction rather than logistics, the first priority is a direct conversation before a recording requirement.

---

## Step 10: Generate the Word Memo

Read `scripts/memo_template.js` in this skill's directory for the helper function library (skillTable, ratingsKeyTable, interventionTable, sectionHead, subHead, body, bullet, pageBreak, memoHeaderTable, etc.).

### Output filename

```
YYYY-MM-DD DOXA Sales Analysis.docx
```

Example: `2026-04-30 DOXA Sales Analysis.docx`. Use the current date.

### Memo structure

```
Title block
Divider
Memo header table (TO / FROM / DATE / SUBJECT)
Divider
Preamble paragraph (N conversations, source statement, scope statement, framework note)
  ← source statement: "from the Zoom API"
  ← scope statement: "past 30 days" (default) or date range (scoped run)
  ← if cap applied in Step 4, append: "Analysis covers the 100 most recent prospect conversations out of N total candidates."
spacer()
subHead("Ratings Key")
ratingsKeyTable()
spacer()

pageBreak() + sectionHead("Rep Name — Role")   ← every rep including the first
  body()  ← "Calls reviewed: N prospect calls" + scope suffix
           ← scope suffix: " in the past 30 days" (default) or " from [date range]" (scoped)
  weeklyVolumeTable(rep["weekly_volume"])   ← last 6 Sun-Sat weeks; counts of scored prospect calls
  spacer()
  [compliance callout paragraph if applicable]
  subHead("Profile")
  body()  ← 2-4 sentence narrative (direct, evidence-grounded)
  spacer()
  skillTable([8 rows])
  spacer()
  subHead("Skill Progression")
  body()  ← "4-bucket trend across [N] calls. Bucket size: [days] days each."
  trendTable([8 rows])
  spacer()
  subHead("Coaching Priority")
  bullet() x 2-3
  spacer()
  [delta section — see below]
  spacer()

pageBreak() + sectionHead("Team-Level Observations")
  subHead("What Is Working")    body()
  subHead("What Is Not Working") body()
  subHead("Structural Gaps")     body()
  spacer()
  sectionHead("Recommended Team Interventions")
  body()
  spacer()
  interventionTable([3-5 rows])
  spacer()
  divider()

pageBreak() + sectionHead("Leadership Evaluation — Ralph Nilssen")
  [see Step 11]

divider()
closing note (italic, gray, 9pt)
```

### Compliance callout (corporate W-2 employees)

For each team member with `compliance_recording_required: true`, compare conversation counts across that group over the same scope used for analysis. If there is a visible gap, place a red left-border paragraph immediately after the "Calls reviewed" line:

```js
body(
  "Note: [Rep] is a corporate employee. Call recording is a standing company requirement, " +
  "not a guideline. [Comparison — e.g., 'Lara has 75 conversations in the past 30 days; " +
  "[Rep] has 12.']. That gap is not a data limitation — it is a compliance issue and " +
  "is treated as such in this report.",
  { border: { left: { style: BorderStyle.THICK, size: 12, color: "CC0000", space: 8 } },
    indent: { left: 360 } }
)
```

Phrase the comparison to match the scope: "in the past 30 days" (default) or "over the same period" (date-scoped runs).

The final coaching bullet for that rep should be a compliance bullet — a company expectation to confirm and track in the next 1:1, not a coaching conversation.

### Coaching bullet style

Specific, evidence-grounded, implementable within 30 days. Guidance for the manager reading the memo — how to frame the conversation, what to focus on, what to watch for. When behavioral pattern knowledge is available (CI or repeated call observation), use it to inform framing without labeling it.

### Delta section — Progress Since Last Run

Appears at the bottom of each rep page, after Coaching Priority. Controlled by `PRIOR_SCORECARD`.

**If `PRIOR_SCORECARD = null`:** Omit the section entirely for all reps. No placeholder, no mention.

**If `PRIOR_SCORECARD` is present and contains a record for this rep:**

Compare each of the 8 dimensions by rating. Use this ordering to determine direction:
```
Excellent > Very Strong > Strong > Good > Adequate > Developing > Weak > Gap
```

Classify each dimension as:
- Improved: rating moved up one or more positions
- Regressed: rating moved down one or more positions
- Held: rating unchanged

Build two lists — improved dimensions and not improved or regressed dimensions. Write them as two `subHead` / `bullet` blocks:

```js
subHead("Progress Since Last Run")
body("Compared to run on [PRIOR_SCORECARD.run_date].")
subHead("Improved")
bullet() x N   // one per improved dimension, e.g., "Discovery: Developing → Good"
subHead("Not Improved or Regressed")
bullet() x N   // one per held or regressed dimension, with regression flagged explicitly
spacer()
```

If all 8 dimensions held, write a single `body()` under "Not Improved or Regressed": "No movement across any scored dimension since last run."

If a dimension is "Gap" in both runs, list it under "Not Improved or Regressed" without flagging it as a regression — insufficient data is not the same as decline.

**If `PRIOR_SCORECARD` is present but contains no record for this rep** (new hire, or rep was absent from the prior run): write a single `body()` under the `subHead`: "No prior run data for this rep — delta will appear on next run."

---

## Step 11: Leadership Evaluation Page

Evaluates Ralph Nilssen based on evidence from (a) Team Trainings transcripts captured in Step 5, (b) the gap between what the team is coached to do and what appears in field calls, and (c) call inspection cadence inferable from start times (how recent is the newest conversation per rep — proxy for review activity). Score on these 5 dimensions using the same 3-column skillTable format:

| Dimension | What to assess |
|---|---|
| **Coaching Quality** | Are frameworks taught specific, repeatable, and evidence-based? Do they address the right skill gaps? |
| **Discovery Framework Adoption** | Is the team actually using the discovery framework in field calls? What is the gap between training and execution? |
| **Call Inspection Habits** | Evidence of systematic review — freshness of conversations, coverage across reps, patterns in what Ralph flags |
| **Team Skill Development** | Are individual reps visibly improving on coached dimensions across the conversation set? Evidence of deliberate practice? |
| **Accountability Mechanisms** | Are there visible reinforcement loops when trained skills are applied — or not — in the field? |

After the skill table, write a "Leadership Coaching Priority" section with 2-3 specific, actionable recommendations for Ralph — framed as peer coaching. Each bullet 30-day implementable.

If LEADERSHIP_EVAL transcripts are absent, note the data boundary explicitly and score only dimensions that can be inferred from field-call evidence. Mark the others as "Gap — no training evidence in this set."

---

## Step 12: Script Generation and Execution

Write the filled script to `/home/claude/memo_output.js`.

Ensure `docx` is available:
```bash
cd /home/claude && (ls node_modules/docx 2>/dev/null || npm install docx)
```

Run:
```bash
node /home/claude/memo_output.js
```

Copy the generated `.docx` to `/mnt/user-data/outputs/` and present it via `present_files`.

Also copy the `.docx` to the persistent output folder using the Filesystem tool:
```
C:\Users\RalphNilssen\Obsidian\Claude\outputs\sales-analysis\YYYY-MM-DD DOXA Sales Analysis.docx
```

Then write the scorecard JSON to the same folder:
```
C:\Users\RalphNilssen\Obsidian\Claude\outputs\sales-analysis\YYYY-MM-DD-scorecard.json
```

Build the scorecard from the scores collected in Step 9. Use the schema defined in Step 2b. Set `run_date` to today's date, `scope` to the scope string from Step 3, `mode` to the active mode, and include one record per rep with their 8 dimension ratings, 4 bucket ratings, trend values, weekly volume across the last 6 US business weeks, and conversation count. Also write the `roster_filter` block (groups + names) and the `buckets` block (4 date ranges) at the top level. For limited-data reps, set `limited_data: true` and omit `scores`, `bucket_scores`, `trend`, and `weekly_volume`.

Create the folder if it does not exist. Write silently — do not narrate.

---

## Step 13: Deliver and Summarize

Present the file. Then give a 3-5 sentence summary: who is strongest, what the collective weakness is, and the single highest-leverage coaching action. Include total conversations analyzed and the scope used.

---

## Memo Style Rules

**Colors:** BLACK `000000`, GRAY_LT `F2F2F2` (table header shading), GRAY_BD `AAAAAA` (borders/dividers), WHITE `FFFFFF`.

**Typography:** All text Arial. Body 10pt (size 20 in DXA). Section heads 11pt allCaps bold with bottom border. Sub-heads 10pt bold.

**Table dimensions (DXA — full usable page width = 10080):**

| Table | Column widths | Notes |
|---|---|---|
| skillTable | [2520, 1620, 5940] | Skill / Rating / Key Observation |
| trendTable | [2400, 1320, 1320, 1320, 1320, 1680] | Skill / W1 / W2 / W3 / W4 / Trend (total 9360 DXA) |
| weeklyVolumeTable | 6 equal columns of 1560 each | 3 rows: Week N (bold), date range (smaller, gray), count (large, bold). Total 9360 DXA. Rendered under "Calls reviewed" in each rep section. |
| ratingsKeyTable | [1620, 8460] | Rating / Definition |
| interventionTable | [720, 2340, 7020] | # / Topic / Objective |
| memoHeaderTable | [1440, 8640] | Label / Value |

**trendTable specifics:** Header row uses bucket date ranges as column labels (e.g., "Apr 2-8", "Apr 9-15", "Apr 16-22", "Apr 23-29"). Trend column shows `+N`, `−N`, `0`, or `—`. Insufficient-data buckets show "—" with no rating. All rating cells center-aligned. Skill column left-aligned. If only 2 buckets were used (window under 8 days), omit the trendTable entirely for that run.

**Rating column (1620 DXA):** center-aligned. Wide enough that "Very Strong" does not wrap at body font size. **Skill column:** left-aligned. All cells: vertical align center, cell margins top/bottom 60, left/right 120.

**Page:** US Letter 12240x15840 DXA, 1-inch margins all sides (1080 DXA each).

**Spacing:** spacer() = before/after 50. subHead() = before 140, after 40. body() = before 40, after 40. sectionHead() = before 280, after 100.

---

## Team Observations Section

Three sub-sections, 3-5 sentences each, citing rep names and specific call examples:

1. **What Is Working** — shared strengths across the team
2. **What Is Not Working** — patterns that cut across all reps. Identify root cause separately from downstream symptom. Discovery depth is typically the root cause; closing failure is the downstream consequence. These are different problems and should not be framed as the same gap.
3. **Structural Gaps** — organizational/process gaps: no shared ICP criteria, no recording cadence, no standardized close framework, etc.

---

## Recommended Interventions Table

3-5 rows: (# | Topic | Objective). Each objective concrete enough to implement in 30 days without external resources. Prioritize structural gaps and the team's shared skill weaknesses.

---

## Failure Modes and Recovery

| Symptom | Likely Cause | Recovery |
|---|---|---|
| `zoom_api.json` missing or empty fields | First run, file deleted, or rotated and not updated | Halt; ask user to populate the credentials file. |
| Token request returns 4xx | Client Secret rotated and `zoom_api.json` not updated; or app deactivated | Halt; tell user to confirm app is active in Zoom Marketplace and update credentials file. |
| `resolve_user` raises `User not found` | Roster email does not match a Zoom account email | Skip the rep; report missing reps in Step 7 confirmation; ask user to correct roster email. |
| Roster file does not include `group` field | Older team_structure.json schema | Match by `ROSTER_NAMES` only; surface a one-line note in Step 7. |
| All reps marked "out of roster scope" | Filter set incorrectly or roster groups renamed | Surface the included groups + names; suggest "score everyone" override. |
| Bucket has fewer than 3 calls | Sparse rep activity in that period | Mark bucket "Insufficient" in trendTable, exclude from trend math. |
| Window under 8 days | Narrow scope | Drop trendTable; surface "Window too short for 4-bucket trend" note. |
| 75+ conversations per rep, run takes too long | Wide scope, cap not yet applied | Cap kicks in at Step 4. If still slow, propose narrowing scope. |
| `processing_analysis: true` on a recent call | ZRA hasn't finished processing | Skip those calls; surface count in Step 7 ("X conversations still processing — re-run later"). |
| `engagement_score == 0` and `sentiment_score == 0` and no summary | Sub-threshold call (no-show, very short) | Already handled in Step 5 classification rule 3. Drop and surface count. |
| VTT transcript fetch returns None | Recording not yet processed, or transcript not enabled for that meeting | Score from meta.json only; note data limitation in rep narrative. |
| Speaker name in transcript unmatched | Prospect or unknown participant | Treat as external (not internal), keep the call as prospect. |
| Zero prospect conversations after filter | All conversations were internal/training, or scope too tight | Show the exclusion list and ask whether to reclassify or widen scope. |
| Team structure file missing from Obsidian | File was deleted or path changed | Ask user to paste the roster in chat; note path is `C:\Users\RalphNilssen\Obsidian\Claude\reference\project_team_structure.json`. |

---

## What this skill does NOT do

- Modify Zoom recordings or settings
- Modify team structure (user edits `project_team_structure.json` directly)
- Score calls flagged as still-processing in ZRA (skipped, surfaced for re-run)
- Pull comments, scorecards, or CRM associations beyond what is exposed in the deep pull (additional scopes would be required)
