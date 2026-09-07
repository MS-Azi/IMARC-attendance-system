import nodemailer from "nodemailer";

/**
 * SMTP transport for the monthly report email.
 * Configure SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS in the environment.
 * (A Gmail account needs an "app password", not the normal login password.)
 */
export function getTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
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
