"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Footprints, LoaderCircle } from "lucide-react";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Sign in failed.");
      router.replace("/");
    } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong."); }
    finally { setBusy(false); }
  }
  return <main className="auth-page"><form className="auth-card" onSubmit={submit}>
    <div className="auth-brand"><span className="auth-logo"><Footprints /></span><div><strong>ITALIAN SHOES</strong><small>RETAIL MANAGEMENT</small></div></div>
    <h1>Welcome back</h1><p className="auth-intro">Sign in with your business account to continue.</p>
    <label className="form-field"><span>Email address</span><input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
    <label className="form-field"><span>Password</span><input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
    {error && <div className="form-error">{error}</div>}
    <button className="primary-button auth-submit" disabled={busy}>{busy ? <><LoaderCircle className="spin" size={16}/> Signing in…</> : "Sign in"}</button>
  </form></main>;
}
