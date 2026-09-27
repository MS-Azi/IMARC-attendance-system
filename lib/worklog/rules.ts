import { prisma } from "@/lib/db";
import { RuleSetConfig } from "./config";
import { validateRuleSetConfig } from "./validate";
import { lagosDateKey, firstOfNextMonthLagos } from "./lagos";

/** The rule-set version in force at the given instant (Lagos calendar day). */
export async function getRuleSetAt(atDate: Date = new Date()) {
  const dayKey = lagosDateKey(atDate);
  return prisma.worklogRuleSet.findFirst({
    where: { effectiveFrom: { lte: dayKey } },
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
  const effectiveFrom = input.appliedImmediately
    ? lagosDateKey(new Date())
    : input.effectiveFrom ?? firstOfNextMonthLagos();

  return prisma.worklogRuleSet.create({
    data: {
      version: nextVersion,
      effectiveFrom,
      appliedImmediately: !!input.appliedImmediately,
      overrideReason: input.appliedImmediately ? input.overrideReason : null,
      config: input.config as any,
      createdById: input.createdById,
    },
  });
}
