import { NextRequest, NextResponse } from "next/server";
import { getTransport } from "@/lib/mailer";

/**
 * One-off SMTP diagnostic — NOT part of the cron schedule, never called by
 * cron-job.org. Sends exactly one test email to a fixed internal address so the
 * real point of failure (DNS, TCP connect, TLS, auth, send) shows up in Render
 * logs instead of being swallowed like the cron's own notify() calls are.
 * Delete this route once SMTP is confirmed working.
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const to = "imarcprojects1@gmail.com";
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  console.log(`[worklog-test-email] starting: host=${host} port=${port} user=${process.env.SMTP_USER ? "set" : "MISSING"} pass=${process.env.SMTP_PASS ? "set" : "MISSING"}`);

  const transport = getTransport();
  const verifyStarted = Date.now();
  try {
    await transport.verify();
    console.log(`[worklog-test-email] verify() ok in ${Date.now() - verifyStarted}ms`);
  } catch (err) {
    console.error(`[worklog-test-email] verify() failed after ${Date.now() - verifyStarted}ms`, err);
    return NextResponse.json({ ok: false, stage: "verify", ms: Date.now() - verifyStarted, error: String(err) }, { status: 500 });
  }

  const sendStarted = Date.now();
  try {
    const info = await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: "Worklog SMTP diagnostic",
      html: "<p>This is a one-off SMTP diagnostic test from /api/cron/worklog-test-email.</p>",
    });
    console.log(`[worklog-test-email] sendMail ok in ${Date.now() - sendStarted}ms`, info.response);
    return NextResponse.json({ ok: true, stage: "send", ms: Date.now() - sendStarted });
  } catch (err) {
    console.error(`[worklog-test-email] sendMail failed after ${Date.now() - sendStarted}ms`, err);
    return NextResponse.json({ ok: false, stage: "send", ms: Date.now() - sendStarted, error: String(err) }, { status: 500 });
  }
}
