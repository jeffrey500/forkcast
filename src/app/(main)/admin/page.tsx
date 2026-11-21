"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { DAY_NAMES } from "@/lib/dates";
import { APP_VERSION } from "@/lib/version";
import type { AgreementRule, PublicUser } from "@/lib/types";

export default function AdminPage() {
  const { state } = useApp();
  if (state.me.role !== "admin") {
    return <p className="text-sm text-ink/60">Only admins can see this page.</p>;
  }
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold">Admin</h1>
        <p className="text-sm text-ink/60">
          Approve roommates and set how planning works. Running version <b>v{APP_VERSION}</b>.
        </p>
      </div>
      <Users />
      <SettingsForm />
    </div>
  );
}

function Users() {
  const { state, api, toast, refresh } = useApp();
  const [users, setUsers] = useState<PublicUser[] | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/users", { cache: "no-store" });
    if (res.ok) setUsers((await res.json()).users);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load
    load();
  }, [load]);

  async function act(u: PublicUser, method: string, body?: object, msg?: string) {
    if (await api(method, `/api/admin/users/${u.id}`, body)) {
      if (msg) toast(msg);
      await load();
      await refresh();
    }
  }

  if (!users) return <p className="text-sm text-ink/50">Loading accounts…</p>;
  const pending = users.filter((u) => u.status === "pending");
  const others = users.filter((u) => u.status !== "pending");

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold">Accounts</h2>
      {pending.length > 0 && (
        <div className="card border-amber-200 bg-amber-50/60 p-4">
          <h3 className="mb-2 text-sm font-bold text-amber-900">Waiting for approval</h3>
          <ul className="divide-y divide-amber-200/60">
            {pending.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <div className="flex-1">
                  <b>{u.name}</b> <span className="text-ink/60">{u.email}</span>
                  <p className="text-xs text-ink/50">asked {new Date(u.createdAt).toLocaleString()}</p>
                </div>
                <button className="btn-primary btn-sm" onClick={() => act(u, "PUT", { status: "approved" }, `${u.name} can now access the household.`)}>
                  Approve
                </button>
                <button className="btn-danger btn-sm" onClick={() => act(u, "PUT", { status: "rejected" }, `${u.name} was rejected.`)}>Reject</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="card divide-y divide-black/5">
        {others.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
            <div className="min-w-0 flex-1">
              <b>{u.name}</b> {u.id === state.me.id && <span className="text-xs text-ink/50">(you)</span>}
              <p className="text-xs text-ink/50">{u.email}</p>
            </div>
            <span className={`chip ${u.status === "approved" ? "bg-leaf-100 text-leaf-700" : "bg-red-50 text-red-700"}`}>{u.status}</span>
            <span className={`chip ${u.role === "admin" ? "bg-ink text-white" : "bg-black/5 text-ink/60"}`}>{u.role}</span>
            {u.status === "approved" ? (
              <>
                <button className="btn-outline btn-sm" onClick={() => act(u, "PUT", { role: u.role === "admin" ? "member" : "admin" })}>
                  {u.role === "admin" ? "Make member" : "Make admin"}
                </button>
                {u.id !== state.me.id && (
                  <button className="btn-ghost btn-sm" onClick={() => act(u, "PUT", { status: "rejected" }, `${u.name} no longer has access.`)}>
                    Revoke
                  </button>
                )}
              </>
            ) : (
              <button className="btn-outline btn-sm" onClick={() => act(u, "PUT", { status: "approved" })}>Approve</button>
            )}
            {u.id !== state.me.id && (
              <button
                className="btn-danger btn-sm"
                onClick={() => confirm(`Delete ${u.name}'s account?`) && act(u, "DELETE", undefined, "Account deleted.")}
              >
                Delete
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function SettingsForm() {
  const { state, api, toast } = useApp();
  const s = state.settings;
  const [householdName, setHouseholdName] = useState(s.householdName);
  const [planningDay, setPlanningDay] = useState(s.planningDay);
  const [weekStartDay, setWeekStartDay] = useState(s.weekStartDay);
  const [slots, setSlots] = useState(s.mealSlots.join(", "));
  const [agreementRule, setAgreementRule] = useState<AgreementRule>(s.agreementRule);
  const [staples, setStaples] = useState(s.staples.join(", "));
  const [claudeModel, setClaudeModel] = useState(s.claudeModel);
  const [reminderEmails, setReminderEmails] = useState(s.reminderEmails);
  const [reminderDiscord, setReminderDiscord] = useState(s.reminderDiscord);
  const [discordUrl, setDiscordUrl] = useState("");
  const [timezone, setTimezone] = useState(s.timezone);
  const [reminderResult, setReminderResult] = useState("");
  const zones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [s.timezone];
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const ok = await api("PUT", "/api/admin/settings", {
      householdName,
      planningDay,
      weekStartDay,
      mealSlots: slots.split(",").map((x) => x.trim()).filter(Boolean),
      agreementRule,
      staples: staples.split(",").map((x) => x.trim()).filter(Boolean),
      claudeModel,
      reminderEmails,
      reminderDiscord,
      ...(discordUrl ? { discordWebhookUrl: discordUrl } : {}),
      timezone,
      ...(apiKey ? { anthropicApiKey: apiKey } : {}),
    });
    setBusy(false);
    if (ok) {
      setApiKey("");
      setDiscordUrl("");
      toast("Settings saved.");
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold">Settings</h2>
      <form onSubmit={save} className="card grid gap-5 p-5 md:grid-cols-2">
        <div>
          <label className="label">Household name</label>
          <input className="input" value={householdName} onChange={(e) => setHouseholdName(e.target.value)} />
        </div>
        <div>
          <label className="label">Meal slots (comma separated, in order)</label>
          <input className="input" value={slots} onChange={(e) => setSlots(e.target.value)} placeholder="Breakfast, Lunch, Dinner" />
        </div>
        <div>
          <label className="label">Planning day</label>
          <select className="input" value={planningDay} onChange={(e) => setPlanningDay(parseInt(e.target.value))}>
            {DAY_NAMES.map((d, i) => (
              <option key={d} value={i}>{d}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-ink/50">On this day everyone gets a banner to plan next week&apos;s meals.</p>
        </div>
        <div>
          <label className="label">Week starts on</label>
          <select className="input" value={weekStartDay} onChange={(e) => setWeekStartDay(parseInt(e.target.value))}>
            {DAY_NAMES.map((d, i) => (
              <option key={d} value={i}>{d}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-ink/50">
            Planning on {DAY_NAMES[planningDay]} covers the week starting the next {DAY_NAMES[weekStartDay]}.
          </p>
        </div>
        <div>
          <label className="label">A meal counts as agreed when</label>
          <select className="input" value={agreementRule} onChange={(e) => setAgreementRule(e.target.value as AgreementRule)}>
            <option value="any">Anyone proposes it</option>
            <option value="majority">Most roommates agree</option>
            <option value="all">Everyone agrees</option>
          </select>
        </div>
        <div>
          <label className="label">Staples (always on hand)</label>
          <input className="input" value={staples} onChange={(e) => setStaples(e.target.value)} />
          <p className="mt-1 text-xs text-ink/50">Never counted against the fridge.</p>
        </div>
        <div>
          <label className="label">Claude model for ideas</label>
          <select className="input" value={claudeModel} onChange={(e) => setClaudeModel(e.target.value)}>
            <option value="claude-opus-5-5">Claude Opus 5.5 (best ideas)</option>
            <option value="claude-sonnet-5-5">Claude Sonnet 5.5 (cheaper)</option>
            <option value="claude-haiku-5-5">Claude Haiku 5.5 (cheapest)</option>
          </select>
        </div>
        <div>
          <label className="label">Claude API key</label>
          <input
            className="input font-mono"
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={s.claudeKeySource === "settings" ? "•••••• saved — type to replace" : "sk-ant-…"}
            disabled={s.claudeKeySource === "env"}
          />
          <p className="mt-1 text-xs text-ink/50">
            {s.claudeKeySource === "env"
              ? "Using ANTHROPIC_API_KEY from the Vercel environment."
              : s.claudeKeySource === "settings"
                ? "A key is saved. It stays on the server and is never shown to anyone."
                : "Get one at console.anthropic.com. Stored server-side only."}
          </p>
          {s.claudeKeySource === "settings" && (
            <button
              type="button"
              className="btn-danger btn-sm mt-1"
              onClick={async () => (await api("PUT", "/api/admin/settings", { anthropicApiKey: "" })) && toast("API key removed.")}
            >
              Remove saved key
            </button>
          )}
        </div>
        <div className="rounded-xl border border-black/10 p-4 md:col-span-2">
          <h3 className="font-bold">Evening reminders</h3>
          <p className="mt-1 text-xs text-ink/60">
            Every evening the household is reminded when tomorrow has no agreed meal, when next week is still unplanned after
            planning day, and about upcoming meals (next 14 days) people haven&apos;t agreed to yet. Nothing is sent when
            there&apos;s nothing to remind anyone about. Choose where reminders go:
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg bg-black/[0.03] p-3">
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" className="h-4 w-4 accent-leaf-600" checked={reminderEmails} onChange={(e) => setReminderEmails(e.target.checked)} />
                📧 Email
              </label>
              <p className="mt-1 text-xs text-ink/60">One email per person, only about what concerns them. Anyone can opt out under Your profile.</p>
              <p className={`mt-2 text-xs ${s.emailConfigured ? "text-leaf-700" : "text-amber-800"}`}>
                {s.emailConfigured ? "✓ Email (SMTP) is set up." : "⚠ Not set up: add SMTP_HOST, SMTP_USER and SMTP_PASS in Vercel (see README)."}
              </p>
            </div>
            <div className="rounded-lg bg-black/[0.03] p-3">
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" className="h-4 w-4 accent-leaf-600" checked={reminderDiscord} onChange={(e) => setReminderDiscord(e.target.checked)} />
                💬 Discord
              </label>
              <p className="mt-1 text-xs text-ink/60">
                One message in a channel, @mentioning whoever still needs to vote (if they&apos;ve added their Discord ID).
              </p>
              <label className="label mt-2">Channel webhook URL</label>
              <input
                className="input font-mono text-xs"
                type="password"
                autoComplete="off"
                value={discordUrl}
                onChange={(e) => setDiscordUrl(e.target.value)}
                disabled={s.discordSource === "env"}
                placeholder={s.discordSource === "settings" ? "•••••• saved, paste to replace" : "https://discord.com/api/webhooks/…"}
              />
              <p className="mt-1 text-xs text-ink/50">
                {s.discordSource === "env"
                  ? "Using DISCORD_WEBHOOK_URL from Vercel."
                  : "In Discord: Server Settings → Integrations → Webhooks → New Webhook → pick the channel → Copy Webhook URL."}
              </p>
              {s.discordSource === "settings" && (
                <button
                  type="button"
                  className="btn-danger btn-sm mt-1"
                  onClick={async () => (await api("PUT", "/api/admin/settings", { discordWebhookUrl: "" })) && toast("Discord webhook removed.")}
                >
                  Remove webhook
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Household time zone</label>
              <select className="input" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                {zones.map((z) => (
                  <option key={z}>{z}</option>
                ))}
              </select>
            </div>
            <p className={`self-end text-xs ${s.cronConfigured ? "text-leaf-700" : "text-amber-800"}`}>
              {s.cronConfigured ? "✓ Daily job is set up (runs around 8–9 pm US Eastern)." : "⚠ Add CRON_SECRET in Vercel so the daily job can run."}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-outline btn-sm"
              disabled={!s.emailConfigured}
              onClick={async () => {
                setReminderResult("Checking the email login and sending you a test…");
                const r = await api<{ message: string }>("POST", "/api/admin/reminders", { test: "email" });
                setReminderResult(r ? r.message : "");
              }}
            >
              Send test email to me
            </button>
            <button
              type="button"
              className="btn-outline btn-sm"
              disabled={s.discordSource === "none"}
              title={s.discordSource === "none" ? "Save a webhook URL first" : undefined}
              onClick={async () => {
                setReminderResult("Posting a test message to Discord…");
                const r = await api<{ message: string }>("POST", "/api/admin/reminders", { test: "discord" });
                setReminderResult(r ? r.message : "");
              }}
            >
              Send test to Discord
            </button>
            <button
              type="button"
              className="btn-outline btn-sm"
              disabled={!s.emailConfigured && s.discordSource === "none"}
              onClick={async () => {
                setReminderResult("Sending…");
                const r = await api<{
                  skipped?: string;
                  sent: { name: string; meals: number }[];
                  failed: { name: string; error: string }[];
                  discord?: { posted: boolean; note: string };
                }>("POST", "/api/admin/reminders", {});
                if (!r) return setReminderResult("");
                if (r.skipped) return setReminderResult(r.skipped);
                const parts = [
                  r.sent.length ? `Emailed ${r.sent.map((x) => x.name).join(", ")}.` : "",
                  r.failed.length ? `Email failed for ${r.failed.map((x) => x.name).join(", ")}: ${r.failed[0].error}` : "",
                  r.discord ? r.discord.note : "",
                ].filter(Boolean);
                setReminderResult(parts.join(" ") || "Nothing needs a reminder right now, so nothing was sent.");
              }}
            >
              Send reminders now
            </button>
            {reminderResult && <span className="text-xs text-ink/70">{reminderResult}</span>}
          </div>
        </div>
        <div className="flex justify-end md:col-span-2">
          <button className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Save settings"}</button>
        </div>
      </form>
    </section>
  );
}
