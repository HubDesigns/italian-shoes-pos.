"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";

export default function AccountClient() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(null);
    if (newPassword !== confirm) return setMessage({ ok: false, text: "The new passwords do not match." });
    setBusy(true);
    try {
      const response = await fetch("/api/account/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword, newPassword }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not change the password.");
      setCurrentPassword(""); setNewPassword(""); setConfirm("");
      setMessage({ ok: true, text: "Password changed successfully. Your other devices were signed out." });
      router.refresh();
    } catch (error) { setMessage({ ok: false, text: error instanceof Error ? error.message : "Something went wrong." }); }
    finally { setBusy(false); }
  }

  return <section className="management-panel">
    <div className="panel-header"><div><div className="panel-title">Change password</div><div className="panel-subtitle">Use at least 10 characters. Avoid common words and numbers.</div></div><KeyRound size={18} color="#16865d" /></div>
    <form className="panel-pad account-form" onSubmit={submit}>
      <label className="form-field"><span>Current password</span><input required type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></label>
      <label className="form-field"><span>New password</span><input required type="password" minLength={10} autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></label>
      <label className="form-field"><span>Repeat new password</span><input required type="password" minLength={10} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>
      {message && <div className={message.ok ? "success-banner" : "form-error"} style={message.ok ? { marginTop: 14 } : { margin: "14px 0 0" }}>{message.text}</div>}
      <div className="form-actions"><button className="primary-button" disabled={busy}>{busy ? "Saving…" : "Change password"}</button></div>
    </form>
  </section>;
}
