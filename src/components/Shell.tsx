"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Modal } from "./ui";
import { logout, useApp } from "./AppProvider";
import { APP_NAME } from "@/lib/types";
import { APP_VERSION } from "@/lib/version";
import { resetDemo, setDemoAs } from "@/lib/demo-client";

type NavItem = { href: string; label: string; short: string; icon: React.ReactNode };

/** 24×24 line icons; they take the link's text colour so the active tab is tinted. */
function NavIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

const NAV: NavItem[] = [
  {
    href: "/",
    label: "Week",
    short: "Week",
    icon: (
      <NavIcon>
        <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
        <path d="M3.5 10h17M8 3v4M16 3v4" />
      </NavIcon>
    ),
  },
  {
    href: "/fridge",
    label: "Fridge & shopping",
    short: "Fridge",
    icon: (
      <NavIcon>
        <rect x="5.5" y="2.5" width="13" height="19" rx="2.5" />
        <path d="M5.5 10h13M9 6v1.5M9 13v3" />
      </NavIcon>
    ),
  },
  {
    href: "/recipes",
    label: "Recipes",
    short: "Recipes",
    icon: (
      <NavIcon>
        <path d="M12 6.5C10 5 7 4.5 3.5 5v13.5c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5z" />
        <path d="M12 6.5V20" />
      </NavIcon>
    ),
  },
  {
    href: "/ideas",
    label: "Ask Claude",
    short: "Ask",
    icon: (
      <NavIcon>
        <path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z" />
        <path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
      </NavIcon>
    ),
  },
];

const ADMIN: NavItem = {
  href: "/admin",
  label: "Admin",
  short: "Admin",
  icon: (
    <NavIcon>
      <circle cx="8" cy="15" r="4.5" />
      <path d="M11.2 11.8L20 3M16.5 6.5l2.5 2.5M14 9l2 2" />
    </NavIcon>
  ),
};

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`));

export default function Shell({ children }: { children: React.ReactNode }) {
  const { state } = useApp();
  const [profileOpen, setProfileOpen] = useState(false);
  const path = usePathname();
  const nav = state.me.role === "admin" ? [...NAV, ADMIN] : NAV;

  return (
    <div className="min-h-screen">
      <header className="pt-safe sticky top-0 z-30 border-b border-black/5 bg-paper/90 backdrop-blur">
        <div className="px-safe mx-auto flex max-w-7xl items-center gap-2 py-2 sm:gap-3 sm:py-3">
          <Link href="/" className="flex min-w-0 items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- tiny static SVG */}
            <img src="/logo.svg" alt="" width={34} height={34} className="h-[30px] w-[30px] shrink-0 drop-shadow-sm sm:h-[34px] sm:w-[34px]" />
            <span className="min-w-0 leading-tight">
              <span className="block text-sm font-extrabold">{APP_NAME}</span>
              <span className="block truncate text-[11px] text-ink/50">{state.settings.householdName}</span>
            </span>
          </Link>
          <nav className="ml-4 hidden gap-1 md:flex" aria-label="Main">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={isActive(path, n.href) ? "page" : undefined}
                className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                  isActive(path, n.href) ? "bg-white text-leaf-700 shadow-sm" : "text-ink/70 hover:bg-black/5"
                }`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
            <button
              className="btn-ghost btn-sm max-w-40 min-w-9 truncate"
              onClick={() => setProfileOpen(true)}
              title="Your profile"
              aria-label={`Your profile (${state.me.name})`}
            >
              <span aria-hidden>👤</span> <span className="hidden truncate sm:inline">{state.me.name}</span>
            </button>
            <button className="btn-ghost btn-sm whitespace-nowrap" onClick={logout}>{state.demo ? "Exit demo" : "Sign out"}</button>
          </div>
        </div>
        {state.demo && <DemoBanner />}
      </header>
      <main className="px-safe mx-auto max-w-7xl pt-4 pb-6 sm:pt-6">{children}</main>
      <footer className="px-safe pb-nav mx-auto max-w-7xl text-xs text-ink/40 md:pb-8">
        {APP_NAME} v{APP_VERSION}
      </footer>
      {profileOpen && <ProfileDialog onClose={() => setProfileOpen(false)} />}
      <nav
        className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-black/10 bg-white/95 backdrop-blur md:hidden"
        aria-label="Main"
      >
        <div className="px-safe flex">
          {nav.map((n) => {
            const active = isActive(path, n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                aria-label={n.label}
                className={`relative flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 pt-1 text-[11px] font-semibold transition-colors ${
                  active ? "text-leaf-700" : "text-ink/55 active:text-ink"
                }`}
              >
                <span
                  aria-hidden
                  className={`absolute top-0 h-[3px] w-8 rounded-b-full bg-leaf-600 transition-opacity ${active ? "opacity-100" : "opacity-0"}`}
                />
                {n.icon}
                <span className="max-w-full truncate">{n.short}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

/** Shown across the top of the public demo: what it is, whose eyes you're seeing it through, and a reset. */
function DemoBanner() {
  const { state, refresh, toast } = useApp();
  return (
    <div className="border-t border-amber-200/70 bg-amber-50 text-amber-950">
      <div className="px-safe mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-1.5 py-1.5 text-xs sm:text-sm">
        <p className="min-w-0 flex-1 basis-full sm:basis-auto">
          <b>Demo household.</b> Click around freely: nothing you do is saved.
        </p>
        <label className="flex items-center gap-1.5">
          <span className="text-amber-900/70">Viewing as</span>
          <select
            className="rounded-md border border-amber-300 bg-white py-0.5 pr-6 pl-1.5 font-semibold"
            value={state.me.id}
            onChange={async (e) => {
              setDemoAs(e.target.value);
              await refresh();
            }}
          >
            {state.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
                {u.role === "admin" ? " (admin)" : ""}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-950"
          onClick={async () => {
            resetDemo();
            await refresh();
            toast("The demo household is back to how it started.");
          }}
        >
          Start over
        </button>
      </div>
    </div>
  );
}

function ProfileDialog({ onClose }: { onClose: () => void }) {
  const { state, api, toast } = useApp();
  const [name, setName] = useState(state.me.name);
  const [emailReminders, setEmailReminders] = useState(state.me.emailReminders !== false);
  const [discordId, setDiscordId] = useState(state.me.discordId ?? "");
  const [busy, setBusy] = useState(false);
  const changed =
    name.trim() !== state.me.name ||
    emailReminders !== (state.me.emailReminders !== false) ||
    discordId.trim() !== (state.me.discordId ?? "");
  return (
    <Modal title="Your profile" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const ok = await api("PUT", "/api/me", { name, emailReminders, discordId: discordId.trim() });
          setBusy(false);
          if (ok) {
            toast("Profile saved.");
            onClose();
          }
        }}
      >
        <div>
          <label className="label" htmlFor="profile-name">Display name</label>
          <input id="profile-name" className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} required />
          <p className="mt-1 text-xs text-ink/50">This is how your roommates see you on meals, votes and emails.</p>
        </div>
        <div>
          <span className="label">Email</span>
          <p className="text-sm text-ink/70">{state.me.email}</p>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-leaf-600" checked={emailReminders} onChange={(e) => setEmailReminders(e.target.checked)} />
            Email me evening reminders
          </label>
        </div>
        <div>
          <label className="label" htmlFor="profile-discord">Discord user ID (optional)</label>
          <input
            id="profile-discord"
            className="input font-mono"
            inputMode="numeric"
            placeholder="e.g. 123456789012345678"
            value={discordId}
            onChange={(e) => setDiscordId(e.target.value.replace(/\D/g, ""))}
          />
          <p className="mt-1 text-xs text-ink/50">
            So Discord reminders can @mention you. In Discord: Settings → Advanced → turn on Developer Mode, then right-click your
            name → Copy User ID.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy || !name.trim() || !changed}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
