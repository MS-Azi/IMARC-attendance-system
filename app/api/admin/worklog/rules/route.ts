import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isWorklogEnabled } from "@/lib/worklog/flags";
import { getRuleSetAt, listRuleSetVersions, createRuleSetVersion } from "@/lib/worklog/rules";
import { writeAuditLog } from "@/lib/audit";

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;
  return session;
}

export async function GET() {
  if (!isWorklogEnabled()) return NextResponse.json({ error: "Worklog module is disabled." }, { status: 404 });
  if (!(await requireAdmin())) return NextResponse.json({ error: "Admin only." }, { status: 401 });

  const [current, history] = await Promise.all([getRuleSetAt(), listRuleSetVersions()]);
  return NextResponse.json({ current, history });
}

export async function POST(req: NextRequest) {
  if (!isWorklogEnabled()) return NextResponse.json({ error: "Worklog module is disabled." }, { status: 404 });
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Admin only." }, { status: 401 });

  const body = await req.json();
  try {
    const ruleSet = await createRuleSetVersion({
      config: body.config,
      effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : undefined,
      appliedImmediately: !!body.appliedImmediately,
      overrideReason: body.overrideReason,
      createdById: session.sub,
    });
    await writeAuditLog({
      actorType: "ADMIN",
      actorId: session.sub,
      action: "worklog_rules.create_version",
      entityType: "WorklogRuleSet",
      entityId: ruleSet.id,
      after: { version: ruleSet.version, effectiveFrom: ruleSet.effectiveFrom, appliedImmediately: ruleSet.appliedImmediately },
      reason: body.overrideReason,
    });
    return NextResponse.json({ ruleSet });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not save rules." }, { status: 400 });
  }
}
