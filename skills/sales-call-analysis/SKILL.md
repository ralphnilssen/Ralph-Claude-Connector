---
name: sales-call-analysis
description: Analyze DOXA sales call transcripts and generate a professional Word memo (.docx) scoring each rep using Mark Roberge's Sales Acceleration Formula framework. Use this skill whenever the user says things like "run the sales analysis," "run the sales coaching memo," "grade my reps," "Roberge analysis," "analyze the calls," "#salescoaching," "review my transcripts," "score my reps," or any request for sales coaching analysis, performance review, or "how are my salespeople doing." The skill has two ingestion modes. By default it pulls transcripts from Ralph's OneDrive Sales folder with zero uploads required. If the user has uploaded .txt transcript files to this chat, it reads those instead. Apply a date-range filter only when the user explicitly scopes the request (for example "just April calls," "last week only," "past 14 days"). Don't wait for the user to say "skill" — any sales coaching request on transcripts routes here.
---

# Sales Call Analysis

## What this skill does

Reads DOXA sales call transcripts, analyzes each representative using Mark Roberge's Sales Acceleration Formula (SAF) framework, and produces a professional Word memo (.docx). Two ingestion modes are supported:

- **OneDrive mode (default)**: Pulls from Ralph's SharePoint path `Sales/Zoom Transcripts/`. No uploads required. Used for recurring coaching runs.
- **Upload mode**: Reads .txt transcript files the user has uploaded to the chat. Used for ad hoc analysis of transcripts outside the OneDrive archive.

Output format is identical across modes: one page per rep, a team-level observations page, a recommended interventions table, and a leadership evaluation page for Ralph Nilssen.

Transcript structure in OneDrive:
```
Sales/Zoom Transcripts/
├── Biz Dev Officers/     ← BDRs (Phil Wolfe, Lara Forchuk)
├── Client Success/       ← Account Managers (Michael Ross)
├── Franchisees/          ← 1099 sellers (Crystal, Ivette, Mike, Montoya, Nicole, Vince)
└── Team Trainings/       ← Fuels the Leadership Evaluation only
```

Transcript file format (both modes):
- Filename: `RecordingTranscript - <title>.txt`
- Content: `[SpeakerName] {HH:MM:SS} utterance [NextSpeaker] {HH:MM:SS} utterance ...`

---

## Step 0: Detect Source Mode

Before loading any tools, check for uploaded .txt files:

```bash
ls /mnt/user-data/uploads/*.txt 2>/dev/null
```

- If uploads are present → **UPLOAD_MODE**. Microsoft 365 tools are not required for transcript ingestion. Proceed.
- If no uploads → **ONEDRIVE_MODE**. Continue to Step 1.

State which mode is active in one short line:
- ONEDRIVE_MODE: "Pulling transcripts from OneDrive."
- UPLOAD_MODE: "Analyzing the N .txt files you uploaded."

Do not narrate the detection itself.

---

## Step 1: Load Microsoft 365 Tools

The Microsoft 365 MCP tools are deferred. Call `tool_search` with query `"sharepoint onedrive folder search files"` to load:

- `microsoft-365:sharepoint_folder_search`
- `microsoft-365:sharepoint_search`
- `microsoft-365:read_resource`

Load silently. Do not narrate.

UPLOAD_MODE still loads these tools so Step 4 can enumerate OneDrive transcripts if needed. In UPLOAD_MODE the team structure is read locally (Step 2), so SharePoint being unreachable does not block that step.

---

## Step 2: Load Team Structure

The team structure file is the authoritative source regardless of mode. Read it from the local Obsidian reference folder using the Filesystem tool:

```
C:\Users\RalphNilssen\Obsidian\Claude\reference\project_team_structure.json
```

If the file is missing or unreadable, ask the user to paste the roster in chat. Do not invent a roster.

Parse and display a compact summary (name / role / group) and ask:
> "Is this team structure still accurate?"

Wait for confirmation or correction before proceeding.

**Key fields used downstream:**
- `manager.name`, `manager.email` — used in internal-only filter (Ralph's emails/names are always treated as internal)
- `team_members[].name`, `.zoom_display_names[]` — used for speaker attribution (fuzzy match)
- `team_members[].email` — used for internal-only classification
- `team_members[].compliance_recording_required` — triggers red callout if recording gap
- `internal_meeting_patterns.topic_regex_exclude[]` — applied to filename matching
- `internal_meeting_patterns.min_duration_minutes` — derived from timestamp span

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
  "scope": "full archive | YYYY-MM-DD to YYYY-MM-DD | uploaded set",
  "reps": [
    {
      "name": "Rep Name",
      "role": "BDR | Account Manager | Seller",
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
      }
    }
  ]
}
```

For reps scored under the limited-data format (fewer than 2 transcripts), omit the `scores` object and set `"limited_data": true`. These reps are excluded from delta comparison.

---

## Step 3: Confirm Scope

**UPLOAD_MODE**: Skip scope confirmation. The uploaded files ARE the scope. State: "Analyzing the N uploaded transcripts." Proceed to Step 4.

**ONEDRIVE_MODE**: Default behavior reads every transcript in the Zoom Transcripts tree. No date filter applied.

Do not ask about date range by default. Proceed to full-archive scan unless the user's original request explicitly scoped the analysis (examples: "just April calls," "last week only," "past 14 days," "April 1 to April 15," "this month").

If the user scoped the request:
- Accept natural language and convert to a UTC date range
- Default timezone: `America/Chicago` (Maplewood, MN); only ask if ambiguous
- Store the range for use in Step 4 and downstream framing

State one of:
- Unscoped: "Scanning the full OneDrive Zoom Transcripts archive."
- Scoped: "Scanning OneDrive for transcripts modified between [start] and [end]."

---

## Step 4: Enumerate Transcripts

**UPLOAD_MODE**:
```bash
ls /mnt/user-data/uploads/*.txt | sort
```
Count the files. Rep attribution runs in this order:
1. Filename pattern, e.g., `RecordingTranscript - <Rep Name> - <topic>.txt`
2. Opening transcript lines (first 30-50 speaker tags) if filename is ambiguous

Fuzzy-match candidate rep names to the team roster using `team_members[].name` and `.zoom_display_names[]`. Handle name variants (e.g., "Vince Azanza" ↔ "Vincent Azanza", "Crystal" ↔ "Crystal Ware"). If no confident match after both methods, flag the file as "Unattributed" and ask the user before assigning.

**ONEDRIVE_MODE**: Find the root folder:
```
sharepoint_folder_search(name: "Zoom Transcripts", limit: 5)
```
Use the folder whose `webUrl` contains `ralph_nilssen_doxatalent.com/Documents/Sales/Zoom Transcripts`.

Read it to get the category subfolders (Biz Dev Officers, Client Success, Franchisees, Team Trainings). For each category, read its contents to get rep subfolders. For each rep subfolder, list files.

**Efficient alternative** (preferred when the Zoom Transcripts root is stable):

Unscoped (default, reads everything):
```
sharepoint_search(query: "RecordingTranscript", fileType: "txt", limit: 50)
```

Scoped (only when user specified a date range in Step 3):
```
sharepoint_search(query: "RecordingTranscript", fileType: "txt",
                  afterDateTime: <range-start-UTC>,
                  beforeDateTime: <range-end-UTC>,
                  limit: 50)
```

Paginate with `offset` until exhausted. Filter results to only those whose `webUrl` is under `Sales/Zoom Transcripts/`. Extract the rep name from the `webUrl` path segment immediately before the filename.

**Volume cap (ONEDRIVE_MODE only):** After classification (Step 5) and speaker filtering (Step 6), if the candidate prospect set exceeds 100 files, keep only the 100 most recent by `lastModifiedDateTime` (descending). Drop the rest silently from the analysis set but surface the cap in the Step 7 classification display and again in the memo preamble (e.g., "Capped at the 100 most recent prospect transcripts out of N total"). The cap applies in both unscoped and scoped runs. Team Trainings / LEADERSHIP_EVAL files are not subject to the cap. UPLOAD_MODE has no cap; the user has already curated the set.

---

## Step 5: Classify Files

Apply classification in this order:

1. **Training content** → LEADERSHIP_EVAL (feeds Step 11 only, not rep scoring).
   - ONEDRIVE_MODE: path contains `/Team Trainings/`.
   - UPLOAD_MODE: filename contains "training," "team training," "weekly call," or similar training indicators. If ambiguous, ask the user.
2. **Internal meeting** → INTERNAL, exclude.
   - Filename matches any `internal_meeting_patterns.topic_regex_exclude` pattern (e.g., 1:1, sync, huddle, L10, MBR). Applies in both modes.
3. **Otherwise** → candidate PROSPECT call.
   - ONEDRIVE_MODE: rep attribution = parent folder name, fuzzy-matched to team roster.
   - UPLOAD_MODE: rep attribution already resolved in Step 4.

After initial classification, apply the speaker-based filter in Step 6.

---

## Step 6: Speaker Filter — "Sole External Party" Rule

For each candidate PROSPECT file, briefly inspect the transcript to extract the unique list of speakers (all unique `[SpeakerName]` tags). Match each speaker to the team roster using fuzzy name matching (first name + last name, handle first-name-only aliases per `zoom_display_names`, handle "Last, First" variants, match `manager.name` for Ralph).

Rule: if ALL speakers match the team roster (including Ralph), classify as INTERNAL and exclude. If at least one speaker is unmatched (prospect or external client), keep as PROSPECT.

This implements "exclude when I am the sole external party" — no prospect present means no coaching content worth scoring.

Applies in both modes.

---

## Step 7: Present Classification for Confirmation

Display two tables to the user before pulling full transcripts:

**Prospect Calls** (N): file name, rep, date, duration estimate, external speakers
**Excluded** (M): file name, reason (internal / training / speaker-only-internal)

If the 100-transcript cap was applied in Step 4 (ONEDRIVE_MODE), state it explicitly above the Prospect Calls table:
> "X prospect transcripts matched. Capped at the 100 most recent by modification date. Y dropped."

Ask:
> "This is what I'll analyze and what I'll set aside. Reclassify anything before I pull the full content?"

Wait for confirmation or user reclassifications.

Also report:
> "Team Trainings found: K files. These will inform the Leadership Evaluation."

---

## Step 8: Pull Full Transcripts and Ingest CI Reports

**ONEDRIVE_MODE**: For each confirmed PROSPECT file and LEADERSHIP_EVAL file, call `read_resource` with its URI to get full content (SharePoint search only returns partial snippets — always re-read for full content). Save full transcripts locally to `/home/claude/transcripts/<rep-slug>/<filename>` so the analyzer can iterate without re-fetching.

**UPLOAD_MODE**: Files are already local in `/mnt/user-data/uploads/`. No fetching needed. Copy them to `/home/claude/transcripts/<rep-slug>/<filename>` for consistency with downstream steps.

Culture Index PDFs: if the user has uploaded any CI PDFs in this chat session or they exist in the Sales folder, read them and use for coaching framing only. Do not reference CI or the framework in output. Insight shapes the writing; it does not appear in it.

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

**Limited data reps:** If a rep has fewer than 2 prospect transcripts, use a 3-row table with columns relabeled "Dimension | Status | Note":
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

Example: `2026-04-20 DOXA Sales Analysis.docx`. Use the current date.

### Memo structure

```
Title block
Divider
Memo header table (TO / FROM / DATE / SUBJECT)
Divider
Preamble paragraph (N transcripts, source statement, scope statement, framework note)
  ← source statement: "from OneDrive" or "from uploaded files"
  ← scope statement: "full archive" (unscoped OneDrive), date range (scoped OneDrive), or "uploaded set" (upload mode)
  ← if cap applied in Step 4, append: "Analysis covers the 100 most recent prospect transcripts out of N total candidates."
spacer()
subHead("Ratings Key")
ratingsKeyTable()
spacer()

pageBreak() + sectionHead("Rep Name — Role")   ← every rep including the first
  body()  ← "Calls reviewed: N prospect calls" + scope suffix
           ← scope suffix: "" (empty) if unscoped or upload, or " from [date range]" if scoped
  [compliance callout paragraph if applicable]
  subHead("Profile")
  body()  ← 2-4 sentence narrative (direct, evidence-grounded)
  spacer()
  skillTable([8 rows])
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

For each team member with `compliance_recording_required: true`, compare recording counts across that group over the same scope used for analysis (full archive by default, or the date range if scoped, or the uploaded set in upload mode). If there is a visible gap, place a red left-border paragraph immediately after the "Calls reviewed" line:

```js
body(
  "Note: [Rep] is a corporate employee. Call recording is a standing company requirement, " +
  "not a guideline. [Comparison — e.g., 'Lara has submitted 132 recordings in the archive; " +
  "[Rep] has submitted 41.']. That gap is not a data limitation — it is a compliance issue and " +
  "is treated as such in this report.",
  { border: { left: { style: BorderStyle.THICK, size: 12, color: "CC0000", space: 8 } },
    indent: { left: 360 } }
)
```

Phrase the comparison to match the scope: "in the archive" for full-archive OneDrive runs, "over the same period" for date-scoped runs, "in the uploaded set" for upload mode.

The final coaching bullet for that rep should be a compliance bullet — a company expectation to confirm and track in the next 1:1, not a coaching conversation.

In upload mode, the compliance comparison base is narrower (only the uploaded files), so phrase the observation cautiously and note the data boundary.

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

Evaluates Ralph Nilssen based on evidence from (a) Team Trainings transcripts captured in Step 5, (b) the gap between what the team is coached to do and what appears in field calls, and (c) call inspection cadence inferable from file modification dates (how recent is the newest transcript per rep — proxy for review activity). Score on these 5 dimensions using the same 3-column skillTable format:

| Dimension | What to assess |
|---|---|
| **Coaching Quality** | Are frameworks taught specific, repeatable, and evidence-based? Do they address the right skill gaps? |
| **Discovery Framework Adoption** | Is the team actually using the discovery framework in field calls? What is the gap between training and execution? |
| **Call Inspection Habits** | Evidence of systematic review — freshness of transcripts, coverage across reps, patterns in what Ralph flags |
| **Team Skill Development** | Are individual reps visibly improving on coached dimensions across the transcript set? Evidence of deliberate practice? |
| **Accountability Mechanisms** | Are there visible reinforcement loops when trained skills are applied — or not — in the field? |

After the skill table, write a "Leadership Coaching Priority" section with 2-3 specific, actionable recommendations for Ralph — framed as peer coaching. Each bullet 30-day implementable.

If LEADERSHIP_EVAL transcripts are absent (common in upload mode where the user did not include training files), note the data boundary explicitly and score only dimensions that can be inferred from field-call evidence. Mark the others as "Gap — no training evidence in this set."

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

Build the scorecard from the scores collected in Step 9. Use the schema defined in Step 2b. Set `run_date` to today's date, `scope` to the scope string from Step 3, and include one record per rep with their 8 dimension ratings and transcript count. For limited-data reps, set `limited_data: true` and omit `scores`.

Create the folder if it does not exist. Write silently — do not narrate.

---

## Step 13: Deliver and Summarize

Present the file. Then give a 3-5 sentence summary: who is strongest, what the collective weakness is, and the single highest-leverage coaching action. Include total transcripts analyzed and the scope used.

- **ONEDRIVE_MODE**: close with a reminder to drag the output file into the OneDrive Sales folder (no OneDrive write tool available in this environment).
- **UPLOAD_MODE**: no OneDrive reminder; the file is ready as delivered.

---

## Memo Style Rules

**Colors:** BLACK `000000`, GRAY_LT `F2F2F2` (table header shading), GRAY_BD `AAAAAA` (borders/dividers), WHITE `FFFFFF`.

**Typography:** All text Arial. Body 10pt (size 20 in DXA). Section heads 11pt allCaps bold with bottom border. Sub-heads 10pt bold.

**Table dimensions (DXA — full usable page width = 10080):**

| Table | Column widths | Notes |
|---|---|---|
| skillTable | [2520, 1620, 5940] | Skill / Rating / Key Observation |
| ratingsKeyTable | [1620, 8460] | Rating / Definition |
| interventionTable | [720, 2340, 7020] | # / Topic / Objective |
| memoHeaderTable | [1440, 8640] | Label / Value |

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
| `sharepoint_search` returns no transcripts in range | No calls recorded or date range too tight | Show user the date range used, confirm, suggest widening. |
| No files in `/mnt/user-data/uploads/` in upload mode | User referred to uploads but none are present | Tell user no uploads detected; ask whether to switch to OneDrive mode instead. |
| Rep folder name doesn't match any roster entry | Folder rename or new hire not in roster | Flag to user, ask whether to add to roster or treat as unknown. |
| Speaker name in transcript unmatched | Prospect or unknown participant | Treat as external (not internal), keep the call as prospect. |
| Zero prospect files after filter | All files were internal/training, or date range too tight | Show the exclusion list and ask whether to reclassify. |
| Transcript has timestamps but no speaker tags | Different export format | Read it anyway; skip speaker filter for that file; note in output. |
| `read_resource` fails on a URI | Auth or permissions issue | Skip the file, note in output, continue. |
| Team structure file missing from Obsidian | File was deleted or path changed | Ask user to paste the roster in chat; note the correct path is `C:\Users\RalphNilssen\Obsidian\Claude\reference\project_team_structure.json` |
| SharePoint unreachable when loading team structure in upload mode | No longer applicable — team structure is read locally | N/A |

---

## What this skill does NOT do

- Pull from Zoom API directly (not reliable in this org — transcripts land in OneDrive via automated export; this skill reads the resulting files)
- Write files back to OneDrive (no write tool available; user drags manually)
- Modify team structure (user edits `project_team_structure.json` in OneDrive)
