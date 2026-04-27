---
name: jd-rating
description: Score and validate job descriptions using the DOXA JD Validation Checklist. Use this skill whenever someone uploads a job description file and asks for it to be rated, reviewed, scored, validated, or checked against the checklist. Also trigger when someone says "rate this JD", "score this job description", "check this JD", "validate this job posting", "run the JD checklist", or uploads a .docx/.pdf/.txt file and asks if it's ready to publish. Supports up to 10 JDs per run and produces one scored Excel file per JD.
---

# JD Rating Skill

Score job description files against the DOXA 21-item Validation Checklist. For each uploaded JD, produce a completed `JD-Rating-Template.xlsx` with every checklist item rated and fix notes for anything that needs attention.

## Accepted input formats

`.docx`, `.doc`, `.pdf`, `.txt` — up to 10 files per run.

For `.docx`: use `python-docx`.
For `.pdf`: use `pdfplumber` (preferred) or `PyPDF2`.
For `.doc`: convert to text using LibreOffice: `libreoffice --headless --convert-to txt <file>`.
For `.txt`: plain `open()`.

If a file can't be parsed, skip it and tell the user which file failed and why.

## Workflow

For each uploaded JD file:

1. **Extract text** from the file.
2. **Extract metadata**: client name and role title. Look for these in the document content first (e.g., "Doxa Client", "Job Title" fields in a table). Fall back to parsing the filename if the content doesn't yield them clearly.
3. **Score all 21 checklist items** using the criteria below.
4. **Write a JSON scores file** to `/tmp/jd_scores_<slug>.json`.
5. **Run the script** to generate the xlsx:
   ```bash
   python <skill_dir>/scripts/rate_jd.py /tmp/jd_scores_<slug>.json <output_path>
   ```
6. **Save the output** to the user's Claude workspace outputs folder using the naming convention:
   `YYYY-MM-DD-[ClientName]-[RoleTitle]-JD-Rating.xlsx`
   - Spaces in client name or role title → replace with hyphens.
   - Example: `2026-04-25-Absco-Solutions-Accounting-Specialist-JD-Rating.xlsx`

After all JDs are processed, summarize results in a table: JD filename, overall rating, Completed/Pending/Rework counts.

---

## Scoring rules

Each item gets one of three statuses. Use these exact strings (no trailing spaces):
- `Completed` — criterion is met
- `Pending` — criterion is conditionally exempt (see Conditional items below) or genuinely ambiguous
- `Rework` — criterion is not met and must be addressed

**Conditional items** — if absent, mark `Pending` (not `Rework`); do NOT count them against the score:
- D36: "Equity or other perks mentioned (if applicable)"

**D33 (Salary range)** is a required item, not conditional. If no specific salary range or band is stated, mark `Rework`.

**Overall rating (E37)**:
- `Approved` — zero Rework items
- `Not Approved - Reworked` — one or more Rework items

---

## Checklist criteria

### 1. Job Title

| Cell | Item | Completed if... | Rework if... |
|------|------|-----------------|--------------|
| D10 | Clear, specific job title included | Title is present and specific (e.g., "Accounting Specialist", not "Staff") | Missing or too vague |
| D11 | Title reflects actual scope and seniority level | Title matches the responsibilities described (e.g., a "Specialist" role isn't doing Director-level work) | Clear mismatch between title and duties |

### 2. Job Summary / Overview

| Cell | Item | Completed if... | Pending if... | Rework if... |
|------|------|-----------------|---------------|--------------|
| D13 | Short paragraph present (3–5 sentences) | 3–5 sentences in the overview/role summary section | 1–2 sentences (thin but present) | No summary at all |
| D14 | Describes purpose and impact of the role | Explains why the role exists and what it contributes | — | Purely lists tasks with no context |
| D15 | Mentions team or reporting structure | Mentions who the role reports to, or which team it works within | — | No reporting line or team context |
| D16 | Location | Location is specified | — | Not mentioned |
| D17 | Working Hours | Hours or schedule are specified | — | Not mentioned |

### 3. Key Responsibilities / Duties

| Cell | Item | Completed if... | Pending if... | Rework if... |
|------|------|-----------------|---------------|--------------|
| D19 | 6–10 bullet points listed | 6–10 bullets | 11–13 bullets (slightly over) or 4–5 bullets (slightly under) | Fewer than 4 or more than 13 |
| D20 | Focused on outcomes, not just activities | Bullets lead with outcomes or impact (e.g., "Ensure accuracy of A/R by...") | Mix of outcome-led and task-led bullets | All bullets are pure task lists with no outcome language |

### 4. Required Qualifications (Must-Haves)

| Cell | Item | Completed if... | Pending if... | Rework if... |
|------|------|-----------------|---------------|--------------|
| D22 | Education requirement included only if truly necessary | Education is listed and is proportionate to the role; or explicitly waived ("or equivalent experience") | No education listed — may be intentional for the role | Education requirement appears inflated for the scope |
| D23 | Years of experience specified | A specific range or minimum is stated (e.g., "3+ years") | — | Not mentioned at all |
| D24 | Core technical skills or certifications listed | Specific tools, platforms, or certs are named | — | Vague or absent |

### 5. Preferred Qualifications (Nice-to-Haves)

| Cell | Item | Completed if... | Rework if... |
|------|------|-----------------|--------------|
| D26 | Clearly separated from required qualifications | A distinct "Preferred" or "Nice-to-Have" section exists | No preferred section at all — everything is mixed into required |
| D27 | Relevant industry experience noted | Preferred industry context is mentioned (e.g., "experience in construction or services") | Absent from preferred section |
| D28 | Bonus certifications mentioned | At least one preferred cert or credential is named | None mentioned |

### 6. Skills & Competencies

| Cell | Item | Completed if... | Rework if... |
|------|------|-----------------|--------------|
| D30 | Technical skills included (tools, platforms, languages) | Specific tools or platforms are named | Absent or too generic |
| D31 | Soft skills included (communication, leadership, etc.) | At least two soft skills are mentioned | Absent |

### 7. Compensation & Benefits

| Cell | Item | Completed if... | Pending if... | Rework if... |
|------|------|-----------------|---------------|--------------|
| D33 | Salary range included | A salary range or band is stated | Unclear or vague — note what is present and flag for revision | No salary range or band stated — mark `Rework` |
| D34 | Bonus or commission structure described | Bonus/commission terms are described, or explicitly noted as not applicable | Unclear whether bonus applies | Role clearly involves commissions or bonuses but none are described |
| D35 | Key benefits highlighted | At least two benefits are described (health, PTO, etc.) | — | No benefits mentioned at all |
| D36 | Equity or other perks mentioned *(if applicable)* | Equity or notable perks are described | Not applicable for role type, or not mentioned — conditional item, does not count against score | — |

---

## Notes column (E)

For every `Rework` or `Pending` item, write a short, specific note in the corresponding E cell explaining what needs to be added or changed. Keep notes to one sentence. Examples:

- E15: `No reporting line identified — add manager or supervisor title`
- E19: `11 bullets listed; guideline is 6–10 — consolidate or trim one item`
- E20: `Rewrite bullets to lead with outcomes rather than tasks`
- E26: `Add a distinct Preferred Qualifications section separate from Required`
- E33: `No salary range stated — replace with a defined band before publishing`

---

## JSON scores format

Write this file before running the script:

```json
{
  "client_name": "Absco Solutions",
  "role_title": "Accounting Specialist",
  "date": "2026-04-25",
  "scores": {
    "D10": "Completed",
    "D11": "Completed",
    "D13": "Completed",
    "D14": "Completed",
    "D15": "Rework",
    "D16": "Completed",
    "D17": "Completed",
    "D19": "Pending",
    "D20": "Rework",
    "D22": "Completed",
    "D23": "Completed",
    "D24": "Completed",
    "D26": "Rework",
    "D27": "Rework",
    "D28": "Rework",
    "D30": "Completed",
    "D31": "Completed",
    "D33": "Rework",
    "D34": "Rework",
    "D35": "Rework",
    "D36": "Pending"
  },
  "notes": {
    "E15": "No reporting line identified — add manager or supervisor title",
    "E20": "Rewrite bullets to lead with outcomes rather than tasks",
    "E26": "Add a distinct Preferred Qualifications section separate from Required",
    "E27": "Note preferred industry experience (e.g., construction, services)",
    "E28": "Consider listing preferred certifications",
    "E33": "No salary range stated — replace with a defined band before publishing",
    "E34": "Confirm and document whether a bonus or commission applies",
    "E35": "Describe key benefits (health, PTO, etc.) to improve candidate appeal"
  },
  "overall_rating": "Not Approved - Reworked"
}
```

Status strings use no trailing spaces. The template's COUNTIF formula and checkbox formulas in column B match these exact values.

---

## Output summary

After processing all files, produce a summary table in the conversation:

| File | Client | Role | Rating | Completed | Pending | Rework |
|------|--------|------|--------|-----------|---------|--------|
| Absco - Accounting Specialist.docx | Absco Solutions | Accounting Specialist | Not Approved — Reworked | 11 | 3 | 7 |
