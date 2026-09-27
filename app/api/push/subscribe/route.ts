import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isWorklogEnabled } from "@/lib/worklog/flags";

export async function POST(req: NextRequest) {
  if (!isWorklogEnabled()) return NextResponse.json({ error: "Worklog module is disabled." }, { status: 404 });
  const session = await getSession();
  if (!session || session.role !== "STAFF") {
    return NextResponse.json({ error: "Sign in as a staff member first." }, { status: 401 });
  }

  const { endpoint, keys, userAgent } = await req.json();
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "Invalid subscription." }, { status: 400 });
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { staffId: session.sub, p256dh: keys.p256dh, auth: keys.auth, userAgent },
    create: { staffId: session.sub, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!isWorklogEnabled()) return NextResponse.json({ error: "Worklog module is disabled." }, { status: 404 });
  const session = await getSession();
  if (!session || session.role !== "STAFF") {
    return NextResponse.json({ error: "Sign in as a staff member first." }, { status: 401 });
  }
  const { endpoint } = await req.json();
  if (endpoint) await prisma.pushSubscription.deleteMany({ where: { endpoint, staffId: session.sub } });
  return NextResponse.json({ ok: true });
}
