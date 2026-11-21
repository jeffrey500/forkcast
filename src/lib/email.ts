import "server-only";
import nodemailer from "nodemailer";
import { SetupError } from "./errors";

/**
 * Sends mail over SMTP. Works with a Gmail account (smtp.gmail.com + an app
 * password), so a household needs no domain of its own, or with any provider
 * that offers SMTP (Resend, Postmark, SendGrid, Fastmail, ...).
 */
export function emailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransport() {
  if (!emailConfigured()) {
    throw new SetupError("set SMTP_HOST, SMTP_USER and SMTP_PASS in Vercel to send reminder emails, then redeploy.");
  }
  if (!transport) {
    const port = parseInt(process.env.SMTP_PORT ?? "465", 10);
    const host = (process.env.SMTP_HOST ?? "").trim();
    // Google shows app passwords as "abcd efgh ijkl mnop"; the spaces aren't part of it.
    const pass = /gmail\.com$/i.test(host) ? (process.env.SMTP_PASS ?? "").replace(/\s+/g, "") : process.env.SMTP_PASS;
    transport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user: (process.env.SMTP_USER ?? "").trim(), pass },
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
    });
  }
  return transport;
}

export async function sendEmail(msg: { to: string; subject: string; text: string; html: string }) {
  const user = process.env.SMTP_USER ?? "";
  // Gmail-style logins are an address; Resend/SendGrid logins aren't, so they need EMAIL_FROM.
  if (!process.env.EMAIL_FROM && !user.includes("@")) {
    throw new SetupError("set EMAIL_FROM (e.g. Forkcast <hello@yourdomain.com>) in Vercel, then redeploy.");
  }
  const from = process.env.EMAIL_FROM || `Forkcast <${user}>`;
  await getTransport().sendMail({ from, ...msg });
}

/** Check the SMTP login works, without sending anything. */
export async function verifyEmail() {
  await getTransport().verify();
}

/** Explain an SMTP failure in words an admin can act on (no secrets included). */
export function smtpProblem(err: unknown): string {
  const e = err as { code?: string; responseCode?: number; message?: string };
  const host = process.env.SMTP_HOST ?? "the SMTP server";
  const gmail = /gmail\.com$/i.test(host);
  if (e?.code === "EAUTH" || e?.responseCode === 535 || e?.responseCode === 534) {
    return gmail
      ? "Gmail rejected the login. Check SMTP_USER is the full Gmail address and SMTP_PASS is a 16-letter app password (not your normal password), then redeploy."
      : "The SMTP server rejected the login. Check SMTP_USER and SMTP_PASS, then redeploy.";
  }
  if (["ECONNECTION", "ESOCKET", "ETIMEDOUT", "ENOTFOUND", "ECONNREFUSED", "EDNS"].includes(e?.code ?? "")) {
    return `Couldn't connect to ${host} on port ${process.env.SMTP_PORT ?? "465"}. ${gmail ? "For Gmail use SMTP_HOST=smtp.gmail.com and SMTP_PORT=465." : "Check SMTP_HOST and SMTP_PORT."}`;
  }
  if (e?.code === "EENVELOPE") return "An email address was rejected. Check EMAIL_FROM and the roommate's sign-up email.";
  return `Email failed: ${(e?.message ?? "unknown error").slice(0, 200)}`;
}

/** Public URL of the app, for links in emails. */
export function appUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}
