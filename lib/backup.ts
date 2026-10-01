import { prisma } from "./db";
import ExcelJS from "exceljs";
import JSZip from "jszip";

/** Every table in the backup, each with its own field selection so password hashes,
 * session material, and push subscription keys are never included — everything else
 * is exported as-is. Read-only: these are all plain `findMany` reads. */
const TABLES: { name: string; fetch: () => Promise<Record<string, unknown>[]> }[] = [
  { name: "Admin", fetch: () => prisma.admin.findMany({ select: { id: true, email: true, createdAt: true } }) },
  {
    name: "Staff",
    fetch: () =>
      prisma.staff.findMany({
        select: {
          id: true,
          fullName: true,
          loginId: true,
          position: true,
          staffCode: true,
          department: true,
          dateJoined: true,
          active: true,
          createdAt: true,
          boundDeviceId: true,
          deviceBoundAt: true,
        },
      }),
  },
  { name: "Attendance", fetch: () => prisma.attendance.findMany() },
  { name: "Settings", fetch: () => prisma.settings.findMany() },
  { name: "MonthlyReport", fetch: () => prisma.monthlyReport.findMany() },
  { name: "WorklogRuleSet", fetch: () => prisma.worklogRuleSet.findMany() },
  { name: "NonWorkingDay", fetch: () => prisma.nonWorkingDay.findMany() },
  { name: "SlotRecord", fetch: () => prisma.slotRecord.findMany() },
  { name: "AttendanceOffenceReview", fetch: () => prisma.attendanceOffenceReview.findMany() },
  { name: "StaffCompensation", fetch: () => prisma.staffCompensation.findMany() },
  { name: "PayrollMonth", fetch: () => prisma.payrollMonth.findMany() },
  { name: "PayrollLine", fetch: () => prisma.payrollLine.findMany() },
  {
    name: "PushSubscription",
    fetch: () =>
      prisma.pushSubscription.findMany({
        select: { id: true, staffId: true, endpoint: true, userAgent: true, createdAt: true, lastSuccessAt: true },
      }),
  },
  { name: "NotificationLog", fetch: () => prisma.notificationLog.findMany() },
  { name: "RuleAcknowledgement", fetch: () => prisma.ruleAcknowledgement.findMany() },
  { name: "WorklogSettings", fetch: () => prisma.worklogSettings.findMany() },
  { name: "AuditLog", fetch: () => prisma.auditLog.findMany() },
];

function addSheet(wb: ExcelJS.Workbook, name: string, rows: Record<string, unknown>[]) {
  const sheet = wb.addWorksheet(name.slice(0, 31));
  if (rows.length === 0) {
    sheet.addRow(["(no rows)"]);
    return;
  }
  const keys = Object.keys(rows[0]);
  sheet.columns = keys.map((k) => ({ header: k, key: k, width: 20 }));
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1B2A41" } };
  for (const row of rows) {
    const flat: Record<string, unknown> = {};
    for (const k of keys) {
      const v = row[k];
      flat[k] = v instanceof Date || v === null || typeof v !== "object" ? v : JSON.stringify(v);
    }
    sheet.addRow(flat);
  }
}

/** Builds the full backup .zip: one Excel workbook (one sheet per table) plus one
 * JSON file per table under json/. Nothing here writes to any table. */
export async function buildBackupZip(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "iMarc Attendance System";
  const zip = new JSZip();

  for (const t of TABLES) {
    const rows = await t.fetch();
    addSheet(wb, t.name, rows);
    zip.file(`json/${t.name}.json`, JSON.stringify(rows, null, 2));
  }

  zip.file("backup.xlsx", Buffer.from(await wb.xlsx.writeBuffer()));

  return zip.generateAsync({ type: "nodebuffer" });
}
