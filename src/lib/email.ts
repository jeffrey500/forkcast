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
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
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

/** Public URL of the app, for links in emails. */
export function appUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}
