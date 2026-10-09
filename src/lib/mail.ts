import nodemailer from "nodemailer";

/**
 * Sending email, if the site has anywhere to send it from.
 *
 * The owner supplies SMTP details in the server's environment. Until he does,
 * `mailReady()` is false and every screen that would have sent something says
 * so plainly instead of pretending it was sent - a password reset that
 * silently goes nowhere is worse than one that says it could not go.
 */

export const mailReady = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

export const mailFrom = () =>
  process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@thedocument.net";

export async function sendMail({
  to,
  subject,
  text,
}: {
  to: string;
  subject: string;
  text: string;
}) {
  if (!mailReady()) throw new Error("No mail server is configured");

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    // 465 is implicit TLS; everything else starts in the clear and upgrades.
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  await transport.sendMail({ from: mailFrom(), to, subject, text });
}
