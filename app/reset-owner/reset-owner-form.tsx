"use client";

import Link from "next/link";
import { useState } from "react";
import { Footprints, LoaderCircle } from "lucide-react";

export default function ResetOwnerForm() {
  const [setupSecret, setSetupSecret] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [doneEmail, setDoneEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      const response = await fetch("/api/auth/owner-reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ setupSecret, newPassword }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not reset the password.");
      setDoneEmail(data.email); setSetupSecret(""); setNewPassword("");
    } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong."); }
    finally { setBusy(false); }
  }

  return <main className="auth-page"><form className="auth-card" onSubmit={submit}>
    <div className="auth-brand"><span className="auth-logo"><Footprints /></span><div><strong>ITALIAN SHOES</strong><small>RETAIL MANAGEMENT</small></div></div>
    <h1>Owner password recovery</h1>
    {doneEmail
      ? <>
        <div className="success-banner">Password changed for {doneEmail}. You can sign in now.</div>
        <Link href="/login" className="primary-button auth-submit" style={{ textDecoration: "none", justifyContent: "center" }}>Go to sign in</Link>
      </>
      : <>
        <p className="auth-note">Enter the setup key (OWNER_SETUP_SECRET from your server settings) and choose a new password for the Owner account.</p>
        <label className="form-field"><span>Setup key</span><input type="password" required autoComplete="off" value={setupSecret} onChange={(e) => setSetupSecret(e.target.value)} /></label>
        <label className="form-field"><span>New password (at least 10 characters)</span><input type="password" required minLength={10} autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></label>
        {error && <div className="form-error">{error}</div>}
        <button className="primary-button auth-submit" disabled={busy}>{busy ? <><LoaderCircle className="spin" size={16}/> Saving…</> : "Set new password"}</button>
        <Link href="/login" className="auth-link">Back to sign in</Link>
      </>}
  </form></main>;
}
