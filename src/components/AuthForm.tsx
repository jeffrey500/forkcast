"use client";

import Link from "next/link";
import { useState } from "react";
import { APP_NAME } from "@/lib/types";
import { hardNavigate } from "./AppProvider";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
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
              <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
            </div>
          )}
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === "register" ? 8 : undefined}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
            {mode === "register" && <p className="mt-1 text-xs text-ink/50">At least 8 characters.</p>}
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>
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
      </div>
    </main>
  );
}
