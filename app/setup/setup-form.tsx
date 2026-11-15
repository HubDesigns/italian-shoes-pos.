"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Footprints, LoaderCircle } from "lucide-react";

export default function SetupForm() {
  const router = useRouter();
  const [form, setForm] = useState({ organizationName: "Italian Shoes", name: "", email: "", password: "", setupSecret: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      const response = await fetch("/api/setup/owner", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not complete setup.");
      router.replace("/");
    } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong."); }
    finally { setBusy(false); }
  }
  const field = (key: keyof typeof form, label: string, type = "text") => (
    <label className="form-field"><span>{label}</span><input required value={form[key]} type={type} onChange={(e) => setForm((old) => ({ ...old, [key]: e.target.value }))} /></label>
  );
  return <main className="auth-page"><form className="auth-card" onSubmit={submit}>
    <div className="auth-brand"><span className="auth-logo"><Footprints /></span><div><strong>ITALIAN SHOES</strong><small>FIRST-TIME BUSINESS SETUP</small></div></div>
    <h1>Create the Owner account</h1><p className="auth-intro">This one-time setup creates your business workspace and the first Owner account. Keep the setup key private.</p>
    {field("organizationName", "Business name")}
    {field("name", "Owner full name")}
    {field("email", "Owner email", "email")}
    {field("password", "Password (at least 10 characters)", "password")}
    {field("setupSecret", "One-time setup key", "password")}
    {error && <div className="form-error">{error}</div>}
    <button className="primary-button auth-submit" disabled={busy}>{busy ? <><LoaderCircle className="spin" size={16}/> Creating secure workspace…</> : "Create Owner account"}</button>
    <p className="auth-footnote">The Owner account is the only role allowed to create or archive branches and manage staff permissions.</p>
  </form></main>;
}
