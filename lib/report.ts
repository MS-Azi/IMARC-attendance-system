import { prisma } from "./db";

export type MonthlySummary = {
  periodLabel: string;
  totalStaff: number;
  overallAttendancePct: number;
  totalLate: number;
  totalAbsent: number;
  totalAnomalies: number;
  perStaff: {
    name: string;
    department: string | null;
    onTime: number;
    late: number;
    absent: number;
    anomalies: number;
    attendancePct: number;
  }[];
};

/** Builds the comprehensive monthly summary for the given year/month (1-12). */
export async function buildMonthlySummary(year: number, month: number): Promise<MonthlySummary> {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  const workingDays = countWeekdays(start, end);

  const staff = await prisma.staff.findMany({ where: { active: true } });
  const records = await prisma.attendance.findMany({
    where: { date: { gte: start, lt: end } },
    include: { staff: true },
  });

  const perStaff = staff.map((s) => {
    const mine = records.filter((r) => r.staffId === s.id);
    const onTime = mine.filter((r) => r.status === "ON_TIME").length;
    const late = mine.filter((r) => r.status === "LATE").length;
    const anomalies = mine.filter((r) => r.status === "ANOMALY").length;
    const present = onTime + late + anomalies;
    const absent = Math.max(workingDays - present, 0);
    return {
      name: s.fullName,
      department: s.department,
      onTime,
      late,
      absent,
      anomalies,
      attendancePct: workingDays ? Math.round((present / workingDays) * 100) : 0,
    };
  });

  const totalLate = perStaff.reduce((a, s) => a + s.late, 0);
  const totalAbsent = perStaff.reduce((a, s) => a + s.absent, 0);
  const totalAnomalies = perStaff.reduce((a, s) => a + s.anomalies, 0);
  const overallAttendancePct = perStaff.length
    ? Math.round(perStaff.reduce((a, s) => a + s.attendancePct, 0) / perStaff.length)
    : 0;

  return {
    periodLabel: `${year}-${String(month).padStart(2, "0")}`,
    totalStaff: staff.length,
    overallAttendancePct,
    totalLate,
    totalAbsent,
    totalAnomalies,
    perStaff,
  };
}

function countWeekdays(start: Date, end: Date): number {
  let count = 0;
  const d = new Date(start);
  while (d < end) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) count++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count;
}

export function summaryToHtml(s: MonthlySummary): string {
  const rows = s.perStaff
    .map(
      (p) =>
        `<tr><td>${p.name}</td><td>${p.department ?? "-"}</td><td>${p.onTime}</td><td>${p.late}</td><td>${p.absent}</td><td>${p.anomalies}</td><td>${p.attendancePct}%</td></tr>`
    )
    .join("");
  return `
    <h2>iMarc Attendance — Monthly Report: ${s.periodLabel}</h2>
    <p>Overall attendance: <b>${s.overallAttendancePct}%</b> across ${s.totalStaff} staff.</p>
    <p>Total late arrivals: ${s.totalLate} · Total absences: ${s.totalAbsent} · Flagged anomalies: ${s.totalAnomalies}</p>
    <table border="1" cellpadding="6" cellspacing="0">
      <tr><th>Staff</th><th>Department</th><th>On time</th><th>Late</th><th>Absent</th><th>Anomalies</th><th>Attendance %</th></tr>
      ${rows}
    </table>
    <p>Full detail is attached as an Excel workbook.</p>
  `;
}
