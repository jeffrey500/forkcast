import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { handle, SetupError } from "@/lib/server";
import { sendReminders } from "@/lib/reminders";

export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new SetupError("set CRON_SECRET in Vercel so the daily reminder job can run, then redeploy.");
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

/** Called once a day by Vercel Cron (see vercel.json). */
export const GET = handle(async (req: Request) => {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await sendReminders();
  console.log("Reminder run:", JSON.stringify({ skipped: result.skipped, sent: result.sent.length, failed: result.failed.length }));
  return result;
});
