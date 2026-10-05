import { prisma } from "@/lib/db";
import { RuleSetConfig } from "./config";
import { validateRuleSetConfig } from "./validate";
import { lagosDateKey, firstOfNextMonthLagos } from "./lagos";

/** The rule-set version in force at the given instant (Lagos calendar day).
 * Excludes superseded versions so an old scheduled change can never resurface. */
export async function getRuleSetAt(atDate: Date = new Date()) {
  const dayKey = lagosDateKey(atDate);
  return prisma.worklogRuleSet.findFirst({
    where: { effectiveFrom: { lte: dayKey }, supersededAt: null },
    orderBy: [{ effectiveFrom: "desc" }, { version: "desc" }],
  });
}

export async function listRuleSetVersions() {
  return prisma.worklogRuleSet.findMany({
    orderBy: { version: "desc" },
    include: { createdBy: { select: { email: true } } },
  });
}

export async function createRuleSetVersion(input: {
  config: RuleSetConfig;
  effectiveFrom?: Date;
  appliedImmediately?: boolean;
  overrideReason?: string;
  createdById: string;
}) {
  const validation = validateRuleSetConfig(input.config);
  if (!validation.ok) {
    throw new Error(validation.error);
  }
  if (input.appliedImmediately && !input.overrideReason?.trim()) {
    throw new Error("A reason is required to apply rule changes immediately.");
  }

  const latest = await prisma.worklogRuleSet.findFirst({ orderBy: { version: "desc" } });
  const nextVersion = (latest?.version ?? 0) + 1;
  const now = new Date();
  const effectiveFrom = input.appliedImmediately ? lagosDateKey(now) : input.effectiveFrom ?? firstOfNextMonthLagos();

  const created = await prisma.worklogRuleSet.create({
    data: {
      version: nextVersion,
      effectiveFrom,
      appliedImmediately: !!input.appliedImmediately,
      overrideReason: input.appliedImmediately ? input.overrideReason : null,
      config: input.config as any,
      createdById: input.createdById,
    },
  });

  // Publishing a version supersedes any other version that hasn't taken effect yet
  // (scheduled for a later date than today) — otherwise an older pending change
  // could resurface and override this one once its own date arrives.
  await prisma.worklogRuleSet.updateMany({
    where: { id: { not: created.id }, effectiveFrom: { gt: lagosDateKey(now) }, supersededAt: null },
    data: { supersededAt: now },
  });

  return created;
}
