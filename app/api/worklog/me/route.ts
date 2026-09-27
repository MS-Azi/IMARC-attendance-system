import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isWorklogEnabled } from "@/lib/worklog/flags";
import { getMonthRecordsForStaff } from "@/lib/worklog/slots";
import { lagosMonthStr } from "@/lib/worklog/lagos";

export async function GET(req: NextRequest) {
  if (!isWorklogEnabled()) return NextResponse.json({ error: "Worklog module is disabled." }, { status: 404 });
  const session = await getSession();
  if (!session || session.role !== "STAFF") {
    return NextResponse.json({ error: "Sign in as a staff member first." }, { status: 401 });
  }

  const month = req.nextUrl.searchParams.get("month") || lagosMonthStr(new Date());
  const data = await getMonthRecordsForStaff(session.sub, month);
  return NextResponse.json(data);
}
