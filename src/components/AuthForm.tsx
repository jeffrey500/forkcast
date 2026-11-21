"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { APP_NAME } from "@/lib/types";
import { hardNavigate } from "./AppProvider";
import { APP_VERSION } from "@/lib/version";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const passwordHadFocus = useRef(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      setBusy(false);
      return;
    }
    hardNavigate("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- tiny static SVG */}
          <img src="/logo.svg" alt="" width={64} height={64} className="mx-auto mb-3 h-16 w-16 drop-shadow" />
          <h1 className="text-2xl font-bold">{APP_NAME}</h1>
          <p className="mt-1 text-sm text-ink/60">
            {mode === "login" ? "Sign in to your household" : "Ask to join your household"}
          </p>
        </div>
        <form onSubmit={submit} className="card space-y-4 p-6">
          {mode === "register" && (
            <div>
              <label className="label" htmlFor="name">Name</label>
              <input
                id="name"
                className="input py-2.5"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                autoCapitalize="words"
                enterKeyHint="next"
              />
            </div>
          )}
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              inputMode="email"
              className="input py-2.5"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
            />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <div className="relative">
              <input
                ref={passwordRef}
                id="password"
                type={showPassword ? "text" : "password"}
                className="input py-2.5 pr-12"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={mode === "register" ? 8 : undefined}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint={mode === "login" ? "go" : "done"}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-ink/50 hover:text-ink focus-visible:text-ink focus-visible:outline-2 focus-visible:outline-leaf-500"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                aria-controls="password"
                title={showPassword ? "Hide password" : "Show password"}
                // Keep focus (and the phone keyboard) in the field when tapping the eye.
                onPointerDown={() => (passwordHadFocus.current = document.activeElement === passwordRef.current)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setShowPassword((v) => !v);
                  const input = passwordRef.current;
                  if (input && passwordHadFocus.current && document.activeElement !== input) input.focus({ preventScroll: true });
                }}
              >
                <EyeIcon off={showPassword} />
              </button>
            </div>
            {mode === "register" && <p className="mt-1 text-xs text-ink/50">At least 8 characters.</p>}
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button className="btn-primary w-full py-3 text-base" disabled={busy}>
            {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
          {mode === "register" && (
            <p className="text-xs text-ink/50">
              An admin approves new accounts before they can see the household. The first account becomes the admin.
            </p>
          )}
        </form>
        <p className="mt-4 text-center text-sm text-ink/60">
          {mode === "login" ? (
            <>New here? <Link className="font-semibold text-leaf-700" href="/register">Create an account</Link></>
          ) : (
            <>Already have an account? <Link className="font-semibold text-leaf-700" href="/login">Sign in</Link></>
          )}
        </p>
        <p className="mt-6 text-center text-xs text-ink/30">v{APP_VERSION}</p>
      </div>
    </main>
  );
}

/** Eye (show) or eye-with-slash (hide) icon for the password toggle. */
function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {off ? (
        <>
          <path d="M10.6 5.1A9.9 9.9 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-2.6 3.5M6.6 6.6C3.9 8.3 2.5 12 2.5 12S6 19 12 19a9.5 9.5 0 0 0 5.4-1.6" />
          <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
          <path d="M3 3l18 18" />
        </>
      ) : (
        <>
          <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}
