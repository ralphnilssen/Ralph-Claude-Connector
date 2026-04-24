/**
 * DOXA Sales Call Analysis — Word Memo Template
 *
 * Usage: Fill in the CONTENT_ARRAY below with the full memo body,
 * then run: node memo_output.js
 *
 * All helper functions are available:
 *   p(children, opts)         — Paragraph
 *   run(text, opts)           — TextRun
 *   spacer()                  — Empty spacing paragraph
 *   pageBreak()               — Hard page break (use before every sectionHead except the first)
 *   divider()                 — Horizontal rule paragraph
 *   groupLabel(text)          — Bold group header with thick bottom border (FRANCHISEE TEAM, etc.)
 *   sectionHead(text)         — Rep section header with thin bottom border
 *   subHead(text)             — Subsection label (Profile, Coaching Priority, etc.)
 *   body(text, opts)          — Body paragraph
 *   bullet(text)              — Bulleted list item
 *   skillTable(rows)          — 3-column skill table; rows = [[skill, rating, observation], ...]
 *   interventionTable(rows)   — 3-column intervention table; rows = [[num, topic, objective], ...]
 *   memoHeaderTable()         — TO / FROM / DATE / SUBJECT block (update values below)
 *
 * UNIVERSAL SKILL DIMENSIONS (same 8 rows for every rep — seller or AM):
 *   1. Rapport / Relationship
 *   2. Discovery
 *   3. Qualification
 *   4. Product Knowledge
 *   5. Value Articulation
 *   6. Call Control
 *   7. Objection / Friction Handling
 *   8. Closing / Forward Motion
 *
 * LEADERSHIP DIMENSIONS (Ralph Nilssen — same skillTable format, 5 rows):
 *   1. Coaching Quality
 *   2. Discovery Framework Adoption
 *   3. Call Inspection Habits
 *   4. Team Skill Development
 *   5. Accountability Mechanisms
 *
 * Color palette:
 *   BLACK   = "000000"
 *   GRAY_LT = "F2F2F2"  (table header fill)
 *   GRAY_BD = "AAAAAA"  (borders/dividers)
 *   WHITE   = "FFFFFF"
 *
 * Skill table column widths (DXA): [2520, 960, 5880]
 * Intervention table column widths (DXA): [720, 2340, 6300]
 * Page: US Letter 12240×15840 DXA, 1-inch margins (1080 DXA each side)
 */

const {
  Document, Packer, Paragraph, TextRun, PageBreak, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign,
  LevelFormat
} = require('./node_modules/docx');
const fs = require('fs');

// ── Color palette ─────────────────────────────────────────────────────────────
const BLACK   = "000000";
const GRAY_LT = "F2F2F2";
const GRAY_BD = "AAAAAA";
const WHITE   = "FFFFFF";

// ── Border helpers ─────────────────────────────────────────────────────────────
const border   = { style: BorderStyle.SINGLE, size: 1, color: GRAY_BD };
const borders  = { top: border, bottom: border, left: border, right: border };
const noBorder  = { style: BorderStyle.NONE, size: 0, color: WHITE };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

// ── Paragraph / run helpers ───────────────────────────────────────────────────
function p(children, opts = {}) {
  return new Paragraph({ children, ...opts });
}
function run(text, opts = {}) {
  return new TextRun({ text, font: "Arial", ...opts });
}
function spacer() {
  return new Paragraph({ children: [run("")], spacing: { before: 80, after: 80 } });
}
function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}
function divider() {
  return new Paragraph({
    children: [],
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: GRAY_BD, space: 1 } },
    spacing: { before: 160, after: 160 },
  });
}
function groupLabel(text) {
  return new Paragraph({
    children: [run(text, { bold: true, size: 24, allCaps: true, color: "333333" })],
    spacing: { before: 400, after: 80 },
    border: { bottom: { style: BorderStyle.THICK, size: 8, color: GRAY_BD, space: 1 } },
  });
}
function sectionHead(text) {
  return new Paragraph({
    children: [run(text, { bold: true, size: 22, allCaps: true })],
    spacing: { before: 280, after: 100 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: GRAY_BD, space: 1 } },
  });
}
function subHead(text) {
  return new Paragraph({
    children: [run(text, { bold: true, size: 20 })],
    spacing: { before: 180, after: 60 },
  });
}
function body(text, opts = {}) {
  return new Paragraph({
    children: [run(text, { size: 20 })],
    spacing: { before: 60, after: 60 },
    ...opts,
  });
}
function bullet(text) {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    children: [run(text, { size: 20 })],
    spacing: { before: 40, after: 40 },
  });
}

// ── Skill table ───────────────────────────────────────────────────────────────
// rows: array of [skill, rating, observation] strings
function skillTable(rows) {
  const COL = [2520, 960, 5880];
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      new TableCell({
        borders, width: { size: COL[0], type: WidthType.DXA },
        shading: { fill: GRAY_LT, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [p([run("Skill", { bold: true, size: 18 })])]
      }),
      new TableCell({
        borders, width: { size: COL[1], type: WidthType.DXA },
        shading: { fill: GRAY_LT, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [p([run("Rating", { bold: true, size: 18 })], { alignment: AlignmentType.CENTER })]
      }),
      new TableCell({
        borders, width: { size: COL[2], type: WidthType.DXA },
        shading: { fill: GRAY_LT, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [p([run("Key Observation", { bold: true, size: 18 })])]
      }),
    ]
  });
  const dataRows = rows.map(([skill, rating, comment]) =>
    new TableRow({
      children: [
        new TableCell({
          borders, width: { size: COL[0], type: WidthType.DXA },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [p([run(skill, { size: 18 })])]
        }),
        new TableCell({
          borders, width: { size: COL[1], type: WidthType.DXA },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [p([run(rating, { bold: true, size: 18 })], { alignment: AlignmentType.CENTER })]
        }),
        new TableCell({
          borders, width: { size: COL[2], type: WidthType.DXA },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [p([run(comment, { size: 18 })])]
        }),
      ]
    })
  );
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: COL,
    rows: [headerRow, ...dataRows],
  });
}

// ── Intervention table ────────────────────────────────────────────────────────
// rows: array of [number, topic, objective] strings
function interventionTable(rows) {
  const COL = [720, 2340, 6300];
  const hdr = new TableRow({
    tableHeader: true,
    children: [
      new TableCell({
        borders, width: { size: COL[0], type: WidthType.DXA },
        shading: { fill: GRAY_LT, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [p([run("#", { bold: true, size: 18 })], { alignment: AlignmentType.CENTER })]
      }),
      new TableCell({
        borders, width: { size: COL[1], type: WidthType.DXA },
        shading: { fill: GRAY_LT, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [p([run("Topic", { bold: true, size: 18 })])]
      }),
      new TableCell({
        borders, width: { size: COL[2], type: WidthType.DXA },
        shading: { fill: GRAY_LT, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [p([run("Objective", { bold: true, size: 18 })])]
      }),
    ]
  });
  const dataRows = rows.map(([num, topic, objective]) =>
    new TableRow({
      children: [
        new TableCell({
          borders, width: { size: COL[0], type: WidthType.DXA },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [p([run(num, { size: 18 })], { alignment: AlignmentType.CENTER })]
        }),
        new TableCell({
          borders, width: { size: COL[1], type: WidthType.DXA },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [p([run(topic, { bold: true, size: 18 })])]
        }),
        new TableCell({
          borders, width: { size: COL[2], type: WidthType.DXA },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [p([run(objective, { size: 18 })])]
        }),
      ]
    })
  );
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: COL,
    rows: [hdr, ...dataRows],
  });
}

// ── Memo header ───────────────────────────────────────────────────────────────
// UPDATE these values before running:
const MEMO_TO      = "DOXA Talent Sales Leadership";
const MEMO_FROM    = "Mark Roberge (Analysis)";
const MEMO_DATE    = "April 8, 2026";   // ← update to current date
const MEMO_SUBJECT = "Sales Team Call Analysis — Skill Assessment & Coaching Priorities";

function memoHeaderTable() {
  const labelCell = (txt) => new TableCell({
    borders: noBorders,
    width: { size: 1440, type: WidthType.DXA },
    margins: { top: 40, bottom: 40, left: 0, right: 120 },
    children: [p([run(txt, { bold: true, size: 20 })])]
  });
  const valueCell = (txt) => new TableCell({
    borders: noBorders,
    width: { size: 7920, type: WidthType.DXA },
    margins: { top: 40, bottom: 40, left: 0, right: 0 },
    children: [p([run(txt, { size: 20 })])]
  });
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [1440, 7920],
    borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder,
               insideH: noBorder, insideV: noBorder },
    rows: [
      new TableRow({ children: [labelCell("TO:"),      valueCell(MEMO_TO)] }),
      new TableRow({ children: [labelCell("FROM:"),    valueCell(MEMO_FROM)] }),
      new TableRow({ children: [labelCell("DATE:"),    valueCell(MEMO_DATE)] }),
      new TableRow({ children: [labelCell("SUBJECT:"), valueCell(MEMO_SUBJECT)] }),
    ]
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// CONTENT_ARRAY — fill this in with the full memo body
// ══════════════════════════════════════════════════════════════════════════════
const CONTENT_ARRAY = [

  // ── Title ──────────────────────────────────────────────────────────────────
  p([run("MEMORANDUM", { bold: true, size: 36, allCaps: true })],
    { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 60 } }),
  p([run("DOXA Talent \u2014 Sales Team Analysis", { size: 22, color: "444444" })],
    { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 240 } }),

  divider(),
  memoHeaderTable(),
  divider(),

  // ── Preamble ───────────────────────────────────────────────────────────────
  // TODO: Update transcript count and any context-specific notes
  body(
    "The following assessment is drawn from review of N recorded call transcripts across " +
    "X team members. Analysis applies the Sales Acceleration Formula framework, evaluating " +
    "each representative against buyer-process skill dimensions: rapport, discovery, " +
    "qualification, product knowledge, value articulation, call control, objection handling, " +
    "and closing. Representatives with limited transcript coverage are noted accordingly."
  ),
  spacer(),

  // ── ROLE GROUP LABEL (no page break before group labels) ──────────────────
  // groupLabel("FRANCHISEE TEAM"),
  //
  // ── REP SECTION — each rep gets their own page ────────────────────────────
  // pageBreak(),   ← before every sectionHead EXCEPT the very first rep
  // sectionHead("Rep Name \u2014 Role"),
  // body("Calls reviewed: ..."),
  // subHead("Profile"),
  // body("2-4 sentence narrative profile..."),
  // spacer(),
  // skillTable([
  //   // ALWAYS 8 rows in this order:
  //   ["Rapport / Relationship",       "Rating", "Observation tied to specific call."],
  //   ["Discovery",                    "Rating", "Observation."],
  //   ["Qualification",                "Rating", "Observation."],
  //   ["Product Knowledge",            "Rating", "Observation."],
  //   ["Value Articulation",           "Rating", "Observation."],
  //   ["Call Control",                 "Rating", "Observation."],
  //   ["Objection / Friction Handling","Rating", "Observation."],
  //   ["Closing / Forward Motion",     "Rating", "Observation."],
  // ]),
  // spacer(),
  // subHead("Coaching Priority"),
  // bullet("Specific, actionable coaching point 1."),
  // bullet("Specific, actionable coaching point 2."),
  // spacer(),
  //
  // (Repeat pageBreak + sectionHead block for each rep)
  //
  // ── TEAM-LEVEL OBSERVATIONS — own page ────────────────────────────────────
  // pageBreak(),
  // sectionHead("Team-Level Observations"),
  // subHead("What Is Working"),
  // body("..."),
  // subHead("What Is Not Working"),
  // body("..."),
  // subHead("Structural Gaps"),
  // body("..."),
  // spacer(),
  // sectionHead("Recommended Team Interventions"),
  // body("Context sentence..."),
  // spacer(),
  // interventionTable([
  //   ["1", "Topic", "Objective description."],
  //   ...
  // ]),
  // spacer(),
  // divider(),
  //
  // ── LEADERSHIP EVALUATION — own page ──────────────────────────────────────
  // pageBreak(),
  // sectionHead("Leadership Evaluation \u2014 Ralph Nilssen"),
  // body("Framing sentence about what this section evaluates and its data basis..."),
  // spacer(),
  // skillTable([
  //   // ALWAYS 5 rows in this order:
  //   ["Coaching Quality",               "Rating", "Observation from training transcripts."],
  //   ["Discovery Framework Adoption",   "Rating", "Gap between what is taught and field execution."],
  //   ["Call Inspection Habits",         "Rating", "Evidence of systematic vs. reactive call review."],
  //   ["Team Skill Development",         "Rating", "Are reps improving on coached dimensions?"],
  //   ["Accountability Mechanisms",      "Rating", "Reinforcement loops between training sessions."],
  // ]),
  // spacer(),
  // subHead("Leadership Coaching Priority"),
  // bullet("Specific, actionable recommendation 1."),
  // bullet("Specific, actionable recommendation 2."),
  // bullet("Specific, actionable recommendation 3."),
  // spacer(),
  // divider(),
  //
  // ── CLOSING NOTE ──────────────────────────────────────────────────────────
  // p([run("Closing note...", { size: 18, italics: true, color: "555555" })],
  //   { spacing: { before: 120, after: 0 } }),

];

// ══════════════════════════════════════════════════════════════════════════════
// Document assembly — do not modify below this line
// ══════════════════════════════════════════════════════════════════════════════
const doc = new Document({
  numbering: {
    config: [{
      reference: "bullets",
      levels: [{
        level: 0,
        format: LevelFormat.BULLET,
        text: "\u2022",
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 540, hanging: 360 } } }
      }]
    }]
  },
  styles: {
    default: {
      document: { run: { font: "Arial", size: 20, color: BLACK } }
    },
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 }
      }
    },
    children: CONTENT_ARRAY,
  }]
});

const OUTPUT_PATH = '/sessions/wonderful-funny-babbage/DOXA_Sales_Analysis.docx';

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(OUTPUT_PATH, buf);
  console.log('Done. Output: ' + OUTPUT_PATH);
}).catch(err => { console.error(err); process.exit(1); });
