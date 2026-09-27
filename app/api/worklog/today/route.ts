import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isWorklogEnabled } from "@/lib/worklog/flags";
import { getTodaySlotsForStaff } from "@/lib/worklog/slots";
import { getRuleSetAt } from "@/lib/worklog/rules";
import { RuleSetConfig } from "@/lib/worklog/config";

export async function GET() {
  if (!isWorklogEnabled()) return NextResponse.json({ error: "Worklog module is disabled." }, { status: 404 });
  const session = await getSession();
  if (!session || session.role !== "STAFF") {
    return NextResponse.json({ error: "Sign in as a staff member first." }, { status: 401 });
  }

  const slots = await getTodaySlotsForStaff(session.sub);
  if (!slots) {
    return NextResponse.json({ slots: null, whatsapp: null, staffFirstName: session.name.split(" ")[0] });
  }

  const ruleSet = await getRuleSetAt();
  const config = ruleSet?.config as unknown as RuleSetConfig | undefined;

  return NextResponse.json({
    slots,
    whatsapp: config ? { whatsappMode: config.whatsappMode, adminWhatsappNumber: config.adminWhatsappNumber } : null,
    staffFirstName: session.name.split(" ")[0],
  });
}
