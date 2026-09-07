import ExcelJS from "exceljs";

export type AttendanceRow = {
  staffName: string;
  position: string;
  department: string | null;
  date: string;
  clockIn: string;
  clockOut: string;
  status: string;
};

export async function buildAttendanceWorkbook(rows: AttendanceRow[], title: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "iMarc Attendance System";
  const sheet = wb.addWorksheet(title.slice(0, 31));

  sheet.columns = [
    { header: "Staff Name", key: "staffName", width: 26 },
    { header: "Position", key: "position", width: 20 },
    { header: "Department", key: "department", width: 18 },
    { header: "Date", key: "date", width: 14 },
    { header: "Clock In", key: "clockIn", width: 12 },
    { header: "Clock Out", key: "clockOut", width: 12 },
    { header: "Status", key: "status", width: 12 },
  ];

  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1B2A41" },
  };

  rows.forEach((r) => sheet.addRow(r));

  const statusColors: Record<string, string> = {
    LATE: "FFF4E3C8",
    ABSENT: "FFF6D6D3",
    ANOMALY: "FFF6D6D3",
    ON_TIME: "FFE4EFE7",
  };
  sheet.eachRow((row, i) => {
    if (i === 1) return;
    const status = String(row.getCell(7).value || "");
    const color = statusColors[status];
    if (color) {
      row.getCell(7).fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
    }
  });

  return wb.xlsx.writeBuffer();
}
