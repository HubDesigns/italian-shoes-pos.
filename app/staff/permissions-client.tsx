"use client";

import { useState } from "react";
import { Check, LockKeyhole, Save } from "lucide-react";

type Role = { id: string; name: string; description: string | null; permissions: { permission: { key: string; description: string } }[] };
const groups = [
  { title: "Daily operations", items: [["dashboard.view","View dashboard"],["sales.view","View POS and sales"],["sales.create","Create sales"]] },
  { title: "Stock and finance", items: [["inventory.view","View inventory"],["inventory.manage","Manage inventory"],["expenses.view","View expenses"],["expenses.manage","Manage expenses"]] },
  { title: "Team and reporting", items: [["reports.view","View branch reports"],["staff.view","View staff"]] },
];
export default function PermissionsClient({ initialRoles }: { initialRoles: Role[] }) {
  const [roles, setRoles] = useState(initialRoles);
  const [selectedId, setSelectedId] = useState(initialRoles.find((r) => r.name === "BRANCH_MANAGER")?.id ?? initialRoles[0]?.id ?? "");
  const [selected, setSelected] = useState<string[]>(initialRoles.find((r) => r.id === (initialRoles.find((x) => x.name === "BRANCH_MANAGER")?.id ?? initialRoles[0]?.id))?.permissions.map((p) => p.permission.key) ?? []);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const role = roles.find((item) => item.id === selectedId);
  function chooseRole(id: string) { setSelectedId(id); setSelected(roles.find((item) => item.id === id)?.permissions.map((p) => p.permission.key) ?? []); setMessage(""); }
  function toggle(key: string) { setSelected((old) => old.includes(key) ? old.filter((item) => item !== key) : [...old, key]); }
  async function save() {
    if (!role || role.name === "OWNER") return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/roles/${role.id}/permissions`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ permissionKeys: selected }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save permissions.");
      setRoles((old) => old.map((item) => item.id === role.id ? { ...item, permissions: selected.map((key) => ({ permission: { key, description: key } })) } : item));
      setMessage("Permissions saved successfully.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Something went wrong."); }
    finally { setBusy(false); }
  }
  if (!roles.length) return <div className="empty-state">No staff roles have been created yet.</div>;
  return <div className="management-page">
    <div className="management-heading"><div><div className="eyebrow">Owner controls</div><h1>Staff & permissions</h1><p>Choose which parts of the system each role can access.</p></div></div>
    <div className="permission-layout">
      <aside className="management-panel role-picker"><div className="panel-title">Staff roles</div><div className="panel-subtitle">Select a role to manage its access.</div>{roles.map((item) => <button key={item.id} className={selectedId === item.id ? "role-option selected" : "role-option"} onClick={() => chooseRole(item.id)}><span><strong>{item.name.replaceAll("_"," ")}</strong><small>{item.description || "Custom access role"}</small></span>{item.name === "OWNER" && <LockKeyhole size={15}/>}</button>)}</aside>
      <section className="management-panel permission-panel"><div className="panel-header"><div><div className="panel-title">{role?.name.replaceAll("_"," ") ?? "Role permissions"}</div><div className="panel-subtitle">{role?.name === "OWNER" ? "Owner has complete business authority." : "Changes apply to every user assigned to this role."}</div></div><span className="status-pill status-active">{role?.name === "OWNER" ? "Full access" : "Custom access"}</span></div>
        {role?.name === "OWNER" ? <div className="owner-lock"><LockKeyhole size={24}/><strong>Owner permissions are protected</strong><span>The Owner always retains complete control, including branch creation, archival, staff permissions and business settings.</span></div> :
          <>{groups.map((group) => <div className="permission-group" key={group.title}><h3>{group.title}</h3>{group.items.map(([key,label]) => <label className="permission-row" key={key}><span><strong>{label}</strong><small>{key}</small></span><input type="checkbox" checked={selected.includes(key)} onChange={() => toggle(key)}/></label>)}</div>)}<div className="owner-only-note"><LockKeyhole size={15}/> Branch management, permission management and business settings are always Owner-only.</div><div className="permission-footer">{message && <span className={message.includes("successfully") ? "success-text" : "form-error"}>{message}</span>}<button className="primary-button" onClick={save} disabled={busy}><Save size={15}/>{busy ? "Saving…" : "Save permissions"}</button></div></>}
      </section>
    </div>
  </div>;
}
