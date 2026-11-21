"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AppState, PublicUser } from "@/lib/types";

type Toast = { id: number; text: string; tone: "ok" | "error" };

interface Ctx {
  state: AppState;
  refresh: () => Promise<void>;
  /** Call the API; refreshes state afterwards and toasts errors. Returns null on failure. */
  api: <T = unknown>(method: string, url: string, body?: unknown) => Promise<T | null>;
  toast: (text: string, tone?: Toast["tone"]) => void;
  userName: (id: string | null | undefined) => string;
}

const AppContext = createContext<Ctx | null>(null);
let toastSeq = 0;

/** Full page load, so all client state resets (used on sign-in/out). */
export function hardNavigate(path: string) {
  window.location.replace(path);
}

export function useApp(): Ctx {
  const c = useContext(AppContext);
  if (!c) throw new Error("useApp outside AppProvider");
  return c;
}

export async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
  hardNavigate("/login");
}

export default function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState | null>(null);
  const [pendingMe, setPendingMe] = useState<PublicUser | null>(null);
  const [loadError, setLoadError] = useState("");
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((text: string, tone: Toast["tone"] = "ok") => {
    const id = ++toastSeq;
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 6000 : 3500);
  }, []);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/state", { cache: "no-store" });
    if (res.status === 401) {
      // Session cookie is valid but the account is gone (deleted by an admin):
      // clear the cookie, or the login page would bounce straight back here.
      await logout();
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoadError(data.error ?? "Couldn't load your household.");
      return;
    }
    setLoadError("");
    if (data.pending) {
      setPendingMe(data.me);
      return;
    }
    setPendingMe(null);
    setState(data as AppState);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load
    refresh();
    // Pick up roommates' changes when coming back to the tab.
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const api = useCallback(
    async <T,>(method: string, url: string, body?: unknown): Promise<T | null> => {
      const res = await fetch(url, {
        method,
        headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data.error ?? "Something went wrong.", "error");
        if (res.status === 401) await logout();
        return null;
      }
      await refresh();
      return data as T;
    },
    [refresh, toast],
  );

  const value = useMemo<Ctx | null>(() => {
    if (!state) return null;
    const names = new Map(state.users.map((u) => [u.id, u.name]));
    return {
      state,
      refresh,
      api,
      toast,
      userName: (id) => (id ? (names.get(id) ?? "Former roommate") : "—"),
    };
  }, [state, refresh, api, toast]);

  if (pendingMe) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="card max-w-md p-8 text-center">
          <div className="mb-3 text-4xl">⏳</div>
          <h1 className="text-xl font-bold">Waiting for approval</h1>
          <p className="mt-2 text-sm text-ink/70">
            Hi {pendingMe.name}! An admin needs to approve <b>{pendingMe.email}</b> before you can see the
            household&apos;s meals and fridge. Ask a roommate to check the Admin page.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <button className="btn-outline" onClick={() => refresh()}>Check again</button>
            <button className="btn-ghost" onClick={logout}>Sign out</button>
          </div>
        </div>
      </main>
    );
  }

  if (!value) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 text-sm text-ink/60">
        {loadError ? (
          <div className="card max-w-md p-6 text-center">
            <p className="font-semibold text-red-700">{loadError}</p>
            <button className="btn-outline mt-4" onClick={() => refresh()}>Try again</button>
          </div>
        ) : (
          "Loading…"
        )}
      </main>
    );
  }

  return (
    <AppContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto max-w-md rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg ${
              t.tone === "error" ? "bg-red-700 text-white" : "bg-ink text-white"
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
}
