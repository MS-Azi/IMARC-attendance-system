import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isWorklogEnabled } from "@/lib/worklog/flags";
import { getRuleSetAt } from "@/lib/worklog/rules";
import { RuleSetConfig } from "@/lib/worklog/config";

// Staff-facing: the currently-effective rule set, plus whether THIS staff member has
// acknowledged it yet (drives the blocking banner). Never exposes deduction amounts
// beyond what staffCanSeeAmounts allows.
export async function GET() {
  if (!isWorklogEnabled()) return NextResponse.json({ error: "Worklog module is disabled." }, { status: 404 });
  const session = await getSession();
  if (!session || session.role !== "STAFF") {
    return NextResponse.json({ error: "Sign in as a staff member first." }, { status: 401 });
  }

  const ruleSet = await getRuleSetAt();
  if (!ruleSet) return NextResponse.json({ ruleSet: null, acknowledged: true });

  const ack = await prisma.ruleAcknowledgement.findUnique({
    where: { staffId_ruleSetId: { staffId: session.sub, ruleSetId: ruleSet.id } },
  });

  const config = ruleSet.config as unknown as RuleSetConfig;
  return NextResponse.json({
    ruleSet: {
      id: ruleSet.id,
      version: ruleSet.version,
      effectiveFrom: ruleSet.effectiveFrom,
      slots: config.slots,
      deductionsEnabled: config.deductionsEnabled,
      staffCanSeeAmounts: config.staffCanSeeAmounts,
      capPercent: config.capPercent,
    },
    acknowledged: !!ack,
  });
}
