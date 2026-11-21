"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Modal } from "./ui";
import { logout, useApp } from "./AppProvider";
import { APP_NAME } from "@/lib/types";

const NAV = [
  { href: "/", label: "Week", icon: "📅" },
  { href: "/fridge", label: "Fridge & shopping", icon: "🧊" },
  { href: "/recipes", label: "Recipes", icon: "📖" },
  { href: "/ideas", label: "Ask Claude", icon: "✨" },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const { state } = useApp();
  const [profileOpen, setProfileOpen] = useState(false);
  const path = usePathname();
  const nav = state.me.role === "admin" ? [...NAV, { href: "/admin", label: "Admin", icon: "🔑" }] : NAV;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-black/5 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- tiny static SVG */}
            <img src="/logo.svg" alt="" width={34} height={34} className="h-[34px] w-[34px] drop-shadow-sm" />
            <span className="leading-tight">
              <span className="block text-sm font-extrabold">{APP_NAME}</span>
              <span className="block text-[11px] text-ink/50">{state.settings.householdName}</span>
            </span>
          </Link>
          <nav className="ml-4 hidden gap-1 md:flex">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                  path === n.href ? "bg-white text-leaf-700 shadow-sm" : "text-ink/70 hover:bg-black/5"
                }`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <button
              className="btn-ghost btn-sm max-w-40 truncate"
              onClick={() => setProfileOpen(true)}
              title="Your profile"
              aria-label={`Your profile (${state.me.name})`}
            >
              <span aria-hidden>👤</span> <span className="hidden truncate sm:inline">{state.me.name}</span>
            </button>
            <button className="btn-ghost btn-sm" onClick={logout}>Sign out</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 pt-6 pb-28 md:pb-12">{children}</main>
      {profileOpen && <ProfileDialog onClose={() => setProfileOpen(false)} />}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-black/10 bg-white md:hidden">
        {nav.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`flex flex-1 flex-col items-center py-2 text-[11px] font-semibold ${
              path === n.href ? "text-leaf-700" : "text-ink/60"
            }`}
          >
            <span className="text-lg">{n.icon}</span>
            {n.label.split(" ")[0]}
          </Link>
        ))}
      </nav>
    </div>
  );
}

function ProfileDialog({ onClose }: { onClose: () => void }) {
  const { state, api, toast } = useApp();
  const [name, setName] = useState(state.me.name);
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Your profile" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const ok = await api("PUT", "/api/me", { name });
          setBusy(false);
          if (ok) {
            toast("Name updated.");
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
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy || !name.trim() || name.trim() === state.me.name}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
