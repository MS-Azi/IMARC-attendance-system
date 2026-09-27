import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isWorklogEnabled } from "@/lib/worklog/flags";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isWorklogEnabled()) return NextResponse.json({ error: "Worklog module is disabled." }, { status: 404 });
  const session = await getSession();
  if (!session || session.role !== "STAFF") {
    return NextResponse.json({ error: "Sign in as a staff member first." }, { status: 401 });
  }

  const ruleSet = await prisma.worklogRuleSet.findUnique({ where: { id: params.id } });
  if (!ruleSet) return NextResponse.json({ error: "Rule set not found." }, { status: 404 });

  const ack = await prisma.ruleAcknowledgement.upsert({
    where: { staffId_ruleSetId: { staffId: session.sub, ruleSetId: ruleSet.id } },
    update: {},
    create: { staffId: session.sub, ruleSetId: ruleSet.id },
  });

  return NextResponse.json({ acknowledgement: ack });
}
