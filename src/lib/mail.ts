import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { open, seal } from "@/lib/secret-box";

/**
 * Sending email, if the site has a mailbox to send from.
 *
 * The owner sets the mailbox in Settings (Email sending); its password is
 * stored sealed. Server environment variables still work as a fallback. Until
 * one of the two is set, `mailReady()` is false and every screen that would
 * have sent something says so plainly instead of pretending it was sent - a
 * password reset that silently goes nowhere is worse than one that says it
 * could not go.
 */

type Mailbox = { host: string; port: number; user: string; pass: string; from: string };

async function mailbox(): Promise<Mailbox | null> {
  const row = await prisma.siteSettings.findUnique({
    where: { id: 1 },
    select: { smtpHost: true, smtpPort: true, smtpUser: true, smtpPassCipher: true, smtpFromName: true },
  });
  if (row?.smtpHost && row.smtpUser && row.smtpPassCipher) {
    const pass = open(row.smtpPassCipher);
    if (pass) {
      return {
        host: row.smtpHost,
        port: row.smtpPort,
        user: row.smtpUser,
        pass,
        from: `"${(row.smtpFromName || "The Document").replace(/"/g, "")}" <${row.smtpUser}>`,
      };
    }
  }
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return {
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
    };
  }
  return null;
}

const transportFor = (m: Pick<Mailbox, "host" | "port" | "user" | "pass">) =>
  nodemailer.createTransport({
    host: m.host,
    port: m.port,
    // 465 is encrypted from the first byte; 587 (what IONOS uses) must upgrade
    // to encryption before the password is sent, and refuses to go on if the
    // server will not. 25 and 2525 are plain relays and upgrade if offered.
    secure: m.port === 465,
    requireTLS: m.port === 587,
    auth: { user: m.user, pass: m.pass },
    connectionTimeout: 15000,
  });

export const mailReady = async () => Boolean(await mailbox());

export async function sendMail({ to, subject, text }: { to: string; subject: string; text: string }) {
  const m = await mailbox();
  if (!m) throw new Error("No mailbox is set up for sending");
  await transportFor(m).sendMail({ from: m.from, to, subject, text });
}

/**
 * Logs in to the mail server with these details and logs out again, sending
 * nothing. Catches a wrong password in Settings rather than at the moment a
 * contributor is locked out and waiting for a link.
 */
export async function mailboxWorks(m: Pick<Mailbox, "host" | "port" | "user" | "pass">) {
  try {
    await transportFor(m).verify();
    return { ok: true as const };
  } catch (err) {
    const code = (err as { code?: string; responseCode?: number }).code;
    const response = (err as { responseCode?: number }).responseCode;
    if (code === "EAUTH" || response === 535) {
      return { ok: false as const, reason: "The mail server says the address or password is wrong." };
    }
    if (code === "ETIMEDOUT" || code === "ECONNECTION" || code === "ESOCKET") {
      return { ok: false as const, reason: "Could not reach the mail server. Check the server name and port." };
    }
    return { ok: false as const, reason: err instanceof Error ? err.message : "The mail server refused." };
  }
}

export async function saveMailbox(input: { host: string; port: number; user: string; pass: string; fromName: string }) {
  await prisma.siteSettings.update({
    where: { id: 1 },
    data: {
      smtpHost: input.host,
      smtpPort: input.port,
      smtpUser: input.user,
      smtpPassCipher: seal(input.pass),
      smtpFromName: input.fromName,
    },
  });
}

export async function clearMailbox() {
  await prisma.siteSettings.update({ where: { id: 1 }, data: { smtpUser: "", smtpPassCipher: "" } });
}

/** What Settings may show: never the password. */
export async function mailboxSummary() {
  const row = await prisma.siteSettings.findUnique({
    where: { id: 1 },
    select: { smtpHost: true, smtpPort: true, smtpUser: true, smtpPassCipher: true, smtpFromName: true },
  });
  return {
    host: row?.smtpHost ?? "smtp.ionos.com",
    port: row?.smtpPort ?? 587,
    user: row?.smtpUser ?? "",
    fromName: row?.smtpFromName ?? "The Document",
    saved: Boolean(row?.smtpUser && row?.smtpPassCipher),
    readable: row?.smtpPassCipher ? open(row.smtpPassCipher) !== null : false,
    onServer: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
  };
}
