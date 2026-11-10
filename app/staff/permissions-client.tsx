"use client";

import { useState } from "react";
import { LockKeyhole, Save, UserPlus, Users, Building2, Check, X, Pencil } from "lucide-react";

type Role = { id: string; name: string; description: string | null; permissions: { permission: { key: string; description: string } }[] };
type Branch = { id: string; name: string };
type Staff = { id: string; name: string; email: string; status: string; role: { id: string; name: string }; branchAssignments: { branch: { id: string; name: string; status: string } }[] };
const groups = [
  { title: "Daily operations", items: [["dashboard.view","View dashboard"],["sales.view","View POS and sales"],["sales.create","Create sales"]] },
  { title: "Stock and finance", items: [["inventory.view","View inventory"],["inventory.manage","Manage inventory"],["expenses.view","View expenses"],["expenses.manage","Manage expenses"]] },
  { title: "Team and reporting", items: [["reports.view","View branch reports"],["staff.view","View staff"]] },
];
export default function PermissionsClient({ initialRoles, initialStaff, branches }: { initialRoles: Role[]; initialStaff: Staff[]; branches: Branch[] }) {
  const [roles, setRoles] = useState(initialRoles);
  const [staff, setStaff] = useState(initialStaff);
  const managerRole = initialRoles.find((r) => r.name === "BRANCH_MANAGER");
  const [selectedId, setSelectedId] = useState(managerRole?.id ?? initialRoles[0]?.id ?? "");
  const [selected, setSelected] = useState<string[]>(managerRole?.permissions.map((p) => p.permission.key) ?? []);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newStaff, setNewStaff] = useState({ name: "", email: "", password: "", roleId: managerRole?.id ?? "" });
  const [newBranches, setNewBranches] = useState<string[]>(branches[0] ? [branches[0].id] : []);
  const [editingStaff, setEditingStaff] = useState<string | null>(null);
  const [editBranches, setEditBranches] = useState<string[]>([]);
  const role = roles.find((item) => item.id === selectedId);
  function chooseRole(id: string) { setSelectedId(id); setSelected(roles.find((item) => item.id === id)?.permissions.map((p) => p.permission.key) ?? []); setMessage(""); }
  function toggle(key: string) { setSelected((old) => old.includes(key) ? old.filter((item) => item !== key) : [...old, key]); }
  function toggleBranch(id: string, values: string[], setter: (next: string[]) => void) { setter(values.includes(id) ? values.filter((item) => item !== id) : [...values, id]); }
  async function savePermissions() {
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
  async function createStaff(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/staff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...newStaff, branchIds: newBranches }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create staff account.");
      setStaff((old) => [...old, data.staff]); setNewStaff({ name: "", email: "", password: "", roleId: managerRole?.id ?? "" }); setNewBranches(branches[0] ? [branches[0].id] : []); setShowCreate(false); setMessage("Staff account created successfully.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Something went wrong."); }
    finally { setBusy(false); }
  }
  async function saveBranchAccess(id: string) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/staff/${id}/branches`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ branchIds: editBranches }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update branch access.");
      setStaff((old) => old.map((member) => member.id === id ? { ...member, branchAssignments: branches.filter((branch) => editBranches.includes(branch.id)).map((branch) => ({ branch: { ...branch, status: "ACTIVE" } })) } : member));
      setEditingStaff(null); setMessage("Branch access updated successfully.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Something went wrong."); }
    finally { setBusy(false); }
  }
  return <div className="management-page">
    <div className="management-heading"><div><div className="eyebrow">Owner controls</div><h1>Staff & permissions</h1><p>Create staff accounts, assign their branches and control access by role.</p></div><button className="primary-button" onClick={() => { setShowCreate((old) => !old); setMessage(""); }}><UserPlus size={16}/>{showCreate ? "Close form" : "Add staff member"}</button></div>
    {message && <div className={message.includes("successfully") ? "success-banner" : "form-error"}>{message}</div>}
    {showCreate && <form className="management-panel staff-create-form" onSubmit={createStaff}>
      <div className="panel-header"><div><div className="panel-title">Create staff account</div><div className="panel-subtitle">The Owner controls the role and branch access.</div></div></div>
      <div className="form-grid">
        <label className="form-field"><span>Full name</span><input required value={newStaff.name} onChange={(e) => setNewStaff((old) => ({ ...old, name: e.target.value }))}/></label>
        <label className="form-field"><span>Email address</span><input required type="email" value={newStaff.email} onChange={(e) => setNewStaff((old) => ({ ...old, email: e.target.value }))}/></label>
        <label className="form-field"><span>Temporary password (minimum 10 characters)</span><input required type="password" minLength={10} value={newStaff.password} onChange={(e) => setNewStaff((old) => ({ ...old, password: e.target.value }))}/></label>
        <label className="form-field"><span>Role</span><select value={newStaff.roleId} required onChange={(e) => setNewStaff((old) => ({ ...old, roleId: e.target.value }))}>{roles.filter((item) => item.name !== "OWNER").map((item) => <option key={item.id} value={item.id}>{item.name.replaceAll("_"," ")}</option>)}</select></label>
        <div className="form-field full"><span>Branch access (select one or more)</span><div className="branch-checkbox-grid">{branches.map((branch) => <label key={branch.id}><input type="checkbox" checked={newBranches.includes(branch.id)} onChange={() => toggleBranch(branch.id,newBranches,setNewBranches)}/>{branch.name}</label>)}</div>{branches.length === 0 && <small>Create an active branch before adding branch staff.</small>}</div>
      </div>
      <div className="form-actions"><button type="button" className="secondary-button" onClick={() => setShowCreate(false)}>Cancel</button><button className="primary-button" disabled={busy || !branches.length || !newStaff.roleId}>{busy ? "Creating…" : "Create account"}</button></div>
    </form>}
    <section className="management-panel staff-list-panel"><div className="panel-header"><div><div className="panel-title">Staff accounts</div><div className="panel-subtitle">A user can access only branches assigned by the Owner.</div></div><Users size={18} color="#16865d"/></div>
      {staff.length === 0 ? <div className="empty-state"><Users size={27}/><strong>No staff accounts yet</strong><span>Create your first branch manager or staff account.</span></div> : <div className="staff-list">{staff.map((member) => <div className="staff-record" key={member.id}><div className="staff-person"><span className="staff-avatar">{member.name.slice(0,1).toUpperCase()}</span><span><strong>{member.name}</strong><small>{member.email} · {member.role.name.replaceAll("_"," ")}</small></span></div><div className="staff-branches">{member.branchAssignments.map((item) => <span key={item.branch.id}>{item.branch.name}</span>)}</div><button className="small-action" onClick={() => { setEditingStaff(editingStaff === member.id ? null : member.id); setEditBranches(member.branchAssignments.map((item) => item.branch.id)); }}><Pencil size={13}/> Branch access</button>
        {editingStaff === member.id && <div className="staff-access-editor"><strong>Branches this user can access</strong><div className="branch-checkbox-grid">{branches.map((branch) => <label key={branch.id}><input type="checkbox" checked={editBranches.includes(branch.id)} onChange={() => toggleBranch(branch.id,editBranches,setEditBranches)}/>{branch.name}</label>)}</div><div className="form-actions"><button className="secondary-button" onClick={() => setEditingStaff(null)} type="button">Cancel</button><button className="primary-button" disabled={busy || !editBranches.length} onClick={() => saveBranchAccess(member.id)} type="button"><Check size={14}/> Save access</button></div></div>}
      </div>)}</div>}
    </section>
    <div className="section-heading"><div><div className="eyebrow">Role configuration</div><h2>Module permissions</h2><p>Changes apply to every user assigned to the selected role.</p></div></div>
    <div className="permission-layout">
      <aside className="management-panel role-picker"><div className="panel-title">Staff roles</div><div className="panel-subtitle">Select a role to manage its access.</div>{roles.map((item) => <button key={item.id} className={selectedId === item.id ? "role-option selected" : "role-option"} onClick={() => chooseRole(item.id)}><span><strong>{item.name.replaceAll("_"," ")}</strong><small>{item.description || "Custom access role"}</small></span>{item.name === "OWNER" && <LockKeyhole size={15}/>}</button>)}</aside>
      <section className="management-panel permission-panel"><div className="panel-header"><div><div className="panel-title">{role?.name.replaceAll("_"," ") ?? "Role permissions"}</div><div className="panel-subtitle">{role?.name === "OWNER" ? "Owner has complete business authority." : "Choose which modules this role can access."}</div></div><span className="status-pill status-active">{role?.name === "OWNER" ? "Full access" : "Custom access"}</span></div>
        {role?.name === "OWNER" ? <div className="owner-lock"><LockKeyhole size={24}/><strong>Owner permissions are protected</strong><span>The Owner always retains complete control, including branch creation, archival, staff permissions and business settings.</span></div> :
          <>{groups.map((group) => <div className="permission-group" key={group.title}><h3>{group.title}</h3>{group.items.map(([key,label]) => <label className="permission-row" key={key}><span><strong>{label}</strong><small>{key}</small></span><input type="checkbox" checked={selected.includes(key)} onChange={() => toggle(key)}/></label>)}</div>)}<div className="owner-only-note"><LockKeyhole size={15}/> Branch management, permission management and business settings are always Owner-only.</div><div className="permission-footer"><span className="success-text">{message.includes("Permissions saved") ? message : ""}</span><button className="primary-button" onClick={savePermissions} disabled={busy}><Save size={15}/>{busy ? "Saving…" : "Save permissions"}</button></div></>}
      </section>
    </div>
  </div>;
}
