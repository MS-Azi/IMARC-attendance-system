import ExcelJS from "exceljs";
import {
  AlignmentType, Document, HeadingLevel, Packer, PageOrientation, Paragraph, ShadingType,
  Table, TableCell, TableRow, TextRun, WidthType,
} from "docx";
import { FullReport, MonthWorklog, StaffWorklog } from "./fullReport";
import { fmtDate, fmtTime, fmtDateTime } from "./worklog/format";

/** Word + Excel renderers for buildFullReport(). Pure formatting — no DB access. */

const HEADER_BG = "1B2A41"; // same navy as the existing attendance workbook header

const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString("en-NG")}`;
const pct = (v: number | null | undefined) => (v == null ? "—" : `${v}%`);
const OUTCOME: Record<string, string> = { ON_TIME: "On time", LATE: "Late", MISSED: "Missed", PENDING: "Pending" };
const REVIEW: Record<string, string> = { VALID: "Valid", FALSE: "False", EXCUSED: "Excused" };

/** "Deducted" normally; "Would have been deducted" in warning-only months. */
function deductedLabel(w: MonthWorklog) {
  return w.deductionsEnabled ? "Deducted" : "Would have been deducted";
}

function deductionCell(s: StaffWorklog) {
  if (!s.deduction) return "No salary on file";
  return naira(s.deduction.breakdown.totalDeductionKobo);
}

// ---------- shared table data (one source for both formats) ----------

type Grid = { headers: string[]; rows: (string | number)[][] };

function attendanceGrid(r: FullReport): Grid {
  return {
    headers: ["Staff", "Department", "Expected days", "On time", "Late", "Absent", "Anomalies", "Attendance"],
    rows: r.attendance.perStaff.map((p) => [p.name, p.department ?? "—", p.expectedDays, p.onTime, p.late, p.absent, p.anomalies, pct(p.attendancePct)]),
  };
}

function worklogGrid(w: MonthWorklog): Grid {
  return {
    headers: ["Staff", "Slots", "On time", "Late", "Missed", "False", "Excused", "Compliance", "Most-missed slot", "Most-missed day"],
    rows: w.staff.map((s) => [
      s.name, s.counts.total, s.counts.onTime, s.counts.late, s.counts.missed, s.counts.falseCount, s.counts.excused,
      pct(s.counts.compliancePct), s.mostMissedSlot ?? "—", s.mostMissedWeekday ?? "—",
    ]),
  };
}

function deductionsGrid(w: MonthWorklog): Grid {
  return {
    headers: ["Staff", "Late clock-ins", "Offences", "Warnings used", "Before cap", "Cap", deductedLabel(w), "Status"],
    rows: w.staff.map((s) => {
      const b = s.deduction?.breakdown;
      return [
        s.name, s.lateClockIns, s.offences, s.warnings,
        b ? naira(b.totalBeforeCapKobo) : "—",
        b ? naira(b.capKobo) : "—",
        deductionCell(s),
        s.deduction ? (s.deduction.source === "finalized" ? "Finalized" : "Provisional") : "—",
      ];
    }),
  };
}

function momGrid(w: MonthWorklog, prev: MonthWorklog | null): Grid {
  return {
    headers: ["Staff", "Compliance (last)", "Compliance (this)", "Change", "Missed (last)", "Missed (this)", "Deduction (last)", "Deduction (this)"],
    rows: w.staff.map((s) => {
      const p = prev?.staff.find((x) => x.staffId === s.staffId);
      const a = p?.counts.compliancePct;
      const b = s.counts.compliancePct;
      const change = a != null && b != null ? `${b - a > 0 ? "+" : ""}${b - a} pts` : "—";
      return [
        s.name, pct(a), pct(b), change, p ? p.counts.missed : "—", s.counts.missed,
        p?.deduction ? naira(p.deduction.breakdown.totalDeductionKobo) : "—",
        s.deduction ? naira(s.deduction.breakdown.totalDeductionKobo) : "—",
      ];
    }),
  };
}

function flagsGrid(w: MonthWorklog): Grid {
  const rows: string[][] = [];
  for (const s of w.staff) for (const f of s.flags) rows.push([s.name, f]);
  return { headers: ["Staff", "Flag"], rows };
}

function updatesGrid(w: MonthWorklog): Grid {
  return {
    headers: ["Date", "Staff", "Slot", "Outcome", "Tick time", "Note", "Link", "Review status", "Review reason"],
    rows: w.rows.map((r) => [
      fmtDate(r.date.toISOString()), r.staff, r.slot, OUTCOME[r.outcome] ?? r.outcome,
      r.tickedAt ? fmtTime(r.tickedAt.toISOString()) : "—", r.note ?? "", r.link ?? "",
      REVIEW[r.reviewStatus] ?? r.reviewStatus, r.reviewReason ?? "",
    ]),
  };
}

const ATTENDANCE_NOTE =
  "Attendance % = days clocked in ÷ expected working days. Expected days have already happened, are on or after the staff member's own start date, and exclude non-working days and excused leave.";

function modeNote(w: MonthWorklog) {
  return w.deductionsEnabled
    ? `Deductions were active this month (cap ${w.capPercent}% of salary).`
    : `Warning-only month: deductions were switched off, so amounts show what WOULD HAVE BEEN DEDUCTED. Nothing was taken from pay.`;
}

// ---------- Excel ----------

function addGridSheet(wb: ExcelJS.Workbook, name: string, grid: Grid, note?: string) {
  const sheet = wb.addWorksheet(name);
  let headerRow = 1;
  if (note) {
    sheet.addRow([note]).font = { italic: true };
    sheet.addRow([]);
    headerRow = 3;
  }
  sheet.addRow(grid.headers);
  const hr = sheet.getRow(headerRow);
  hr.font = { bold: true, color: { argb: "FFFFFFFF" } };
  hr.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${HEADER_BG}` } };
  grid.rows.forEach((r) => sheet.addRow(r));
  if (!grid.rows.length) sheet.addRow(["(none)"]);
  grid.headers.forEach((h, i) => {
    const longest = Math.max(h.length, ...grid.rows.map((r) => String(r[i] ?? "").length));
    sheet.getColumn(i + 1).width = Math.min(Math.max(longest + 2, 10), 60);
  });
  sheet.views = [{ state: "frozen", ySplit: headerRow }];
  return sheet;
}

export async function buildFullReportXlsx(r: FullReport) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "iMarc Attendance System";

  const summary = wb.addWorksheet("Summary");
  summary.addRow([`Monthly report — ${r.monthLabel}`]).font = { bold: true, size: 14 };
  summary.addRow([`Generated ${fmtDateTime(r.generatedAt.toISOString())} (Lagos time)`]).font = { italic: true };
  summary.addRow([]);
  r.summary.forEach((line) => summary.addRow([line]));
  summary.getColumn(1).width = 120;

  addGridSheet(wb, "Attendance", attendanceGrid(r), ATTENDANCE_NOTE);
  const w = r.worklog;
  if (w) {
    addGridSheet(wb, "Work Log", worklogGrid(w), "Compliance = on-time submissions ÷ non-excused slots (excused slots, and slots not yet marked by the system, are left out).");
    addGridSheet(wb, "Warnings & Deductions", deductionsGrid(w), modeNote(w));
    addGridSheet(wb, "Month on Month", momGrid(w, r.previous));
    addGridSheet(wb, "Flags", flagsGrid(w));
    addGridSheet(wb, "Work Updates", updatesGrid(w));
  }
  return wb.xlsx.writeBuffer();
}

// ---------- Word ----------

function docTable(grid: Grid): Table {
  const cell = (text: string | number, header = false) =>
    new TableCell({
      shading: header ? { type: ShadingType.CLEAR, color: "auto", fill: HEADER_BG } : undefined,
      margins: { top: 40, bottom: 40, left: 80, right: 80 },
      children: [new Paragraph({ children: [new TextRun({ text: String(text), bold: header, color: header ? "FFFFFF" : undefined, size: 18 })] })],
    });
  const rows = [new TableRow({ tableHeader: true, children: grid.headers.map((h) => cell(h, true)) })];
  if (!grid.rows.length) rows.push(new TableRow({ children: [cell("(none)"), ...grid.headers.slice(1).map(() => cell(""))] }));
  grid.rows.forEach((r) => rows.push(new TableRow({ children: r.map((v) => cell(v)) })));
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows });
}

const h1 = (text: string) => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 120 }, children: [new TextRun(text)] });
const para = (text: string, opts: { italic?: boolean; bold?: boolean } = {}) =>
  new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text, ...opts })] });

export async function buildFullReportDocx(r: FullReport) {
  const w = r.worklog;
  const children: (Paragraph | Table)[] = [
    new Paragraph({ heading: HeadingLevel.TITLE, alignment: AlignmentType.LEFT, children: [new TextRun(`Monthly Report — ${r.monthLabel}`)] }),
    para(`Generated ${fmtDateTime(r.generatedAt.toISOString())} (Lagos time)`, { italic: true }),
    h1("Summary"),
    ...r.summary.map((line) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: [new TextRun(line)] })),
    h1("Attendance"),
    para(ATTENDANCE_NOTE, { italic: true }),
    docTable(attendanceGrid(r)),
  ];
  if (w) {
    children.push(
      h1("Work Updates by Staff"),
      para("Compliance = on-time submissions ÷ non-excused slots (excused slots, and slots not yet marked by the system, are left out).", { italic: true }),
      docTable(worklogGrid(w)),
      h1("Patterns"),
      para(`Most-missed slot: ${w.mostMissedSlot ?? "none"}.`),
      para(`Most-missed weekday: ${w.mostMissedWeekday ?? "none"}.`),
      h1("Warnings & Deductions"),
      para(modeNote(w), { bold: !w.deductionsEnabled }),
      docTable(deductionsGrid(w)),
      h1("Month-on-Month"),
      docTable(momGrid(w, r.previous)),
      h1("Flags"),
      para("3+ missed updates, any false submission, at or near the deduction cap (80%+), or a clean record.", { italic: true }),
      docTable(flagsGrid(w)),
      para("The slot-by-slot list of every work update is in the Excel file (Work Updates sheet).", { italic: true })
    );
  }
  const doc = new Document({
    creator: "iMarc Attendance System",
    title: `Monthly Report ${r.monthStr}`,
    styles: { default: { document: { run: { font: "Calibri", size: 21 } } } },
    sections: [{ properties: { page: { size: { orientation: PageOrientation.LANDSCAPE } } }, children }],
  });
  return Packer.toBuffer(doc);
}
