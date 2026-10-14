import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { buildFullReport } from "@/lib/fullReport";
import { buildFullReportDocx, buildFullReportXlsx } from "@/lib/fullReportFiles";
import { withTimeout } from "@/lib/worklog/timeout";

/** On-demand Word or Excel monthly report (attendance + work log). Read-only — builds
 * from live data on every request and stores nothing (unlike /api/reports/generate). */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return NextResponse.json({ error: "Admin only." }, { status: 401 });

  const month = req.nextUrl.searchParams.get("month") ?? "";
  const format = req.nextUrl.searchParams.get("format");
  const m = month.match(/^(\d{4})-(\d{2})$/);
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12 || new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1)) > new Date()) {
    return NextResponse.json({ error: "Invalid or future month." }, { status: 400 });
  }
  if (format !== "docx" && format !== "xlsx") {
    return NextResponse.json({ error: "Format must be docx or xlsx." }, { status: 400 });
  }

  try {
    const report = await withTimeout(buildFullReport(month), 45000, "report");
    const buffer = format === "docx" ? await buildFullReportDocx(report) : await buildFullReportXlsx(report);
    return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
      headers: {
        "Content-Type":
          format === "docx"
            ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="monthly-report-${month}.${format}"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Report failed." }, { status: 500 });
  }
}
