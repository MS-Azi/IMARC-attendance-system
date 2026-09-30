import nodemailer from "nodemailer";
import { withTimeout } from "./worklog/timeout";

/**
 * SMTP transport for the monthly report email.
 * Configure SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS in the environment.
 * (A Gmail account needs an "app password", not the normal login password.)
 */
export function getTransport() {
  const port = Number(process.env.SMTP_PORT || 587);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465, // 465 = implicit TLS; 587 = STARTTLS (secure: false, upgraded automatically)
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    // Without these, a slow/unreachable SMTP host hangs the caller indefinitely —
    // this is what was hanging the worklog cron.
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 8000,
  });
}

/** Plain notification email, no attachment — for worklog reminders/warnings. */
export async function sendEmail(opts: { to: string; subject: string; html: string }) {
  const transport = getTransport();
  await withTimeout(
    transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    }),
    10000,
    "sendEmail"
  );
}

export async function sendReportEmail(opts: {
  to: string;
  subject: string;
  html: string;
  attachmentBuffer: Buffer;
  attachmentName: string;
}) {
  const transport = getTransport();
  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    attachments: [
      {
        filename: opts.attachmentName,
        content: opts.attachmentBuffer,
      },
    ],
  });
}
