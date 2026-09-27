import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isWorklogEnabled } from "@/lib/worklog/flags";
import { RuleSetConfig } from "@/lib/worklog/config";
import { computeSlotWindows } from "@/lib/worklog/validate";
import { lagosTimeOnDay } from "@/lib/worklog/slots";

// Submission timing is decided purely by server time — the client never gets to say
// when "now" is. One submission per slot; no edits after.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isWorklogEnabled()) return NextResponse.json({ error: "Worklog module is disabled." }, { status: 404 });
  const session = await getSession();
  if (!session || session.role !== "STAFF") {
    return NextResponse.json({ error: "Sign in as a staff member first." }, { status: 401 });
  }

  const record = await prisma.slotRecord.findUnique({ where: { id: params.id }, include: { ruleSet: true } });
  if (!record) return NextResponse.json({ error: "Slot not found." }, { status: 404 });
  if (record.staffId !== session.sub) return NextResponse.json({ error: "Not your slot." }, { status: 403 });
  if (record.tickedAt) return NextResponse.json({ error: "Already submitted." }, { status: 409 });

  const body = await req.json();
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (note.length < 10 || note.length > 280) {
    return NextResponse.json({ error: "Note must be 10-280 characters." }, { status: 400 });
  }

  let link: string | null = null;
  if (body.link) {
    try {
      const url = new URL(body.link);
      if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("bad protocol");
      link = body.link;
    } catch {
      return NextResponse.json({ error: "Link must be a valid URL." }, { status: 400 });
    }
  }

  const config = record.ruleSet.config as unknown as RuleSetConfig;
  const windows = computeSlotWindows(config);
  const w = windows[record.slotIndex] ?? windows[windows.length - 1];
  const now = new Date();
  const opensAt = lagosTimeOnDay(record.date, w.opens);
  const onTimeClosesAt = lagosTimeOnDay(record.date, w.onTimeCloses);
  const lateClosesAt = lagosTimeOnDay(record.date, w.lateCloses);

  if (now < opensAt || now >= lateClosesAt) {
    return NextResponse.json({ error: "This slot isn't open for submission right now." }, { status: 400 });
  }

  const outcome = now < onTimeClosesAt ? "ON_TIME" : "LATE";
  const updated = await prisma.slotRecord.update({
    where: { id: record.id },
    data: { tickedAt: now, note, link, outcome },
  });

  return NextResponse.json({ record: updated, slotLabel: record.slotLabel });
}
