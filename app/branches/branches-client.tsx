"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Building2, Check, ChevronDown, Edit3, MapPin, Plus, RotateCcw, Search, X } from "lucide-react";

type Branch = { id: string; code: string; name: string; address: string | null; city: string | null; phone: string | null; status: "ACTIVE" | "INACTIVE" };
type Draft = { code: string; name: string; address: string; city: string; phone: string };
const blank: Draft = { code: "", name: "", address: "", city: "", phone: "" };

export default function BranchesClient({ initialBranches, owner }: { initialBranches: Branch[]; owner: boolean }) {
  const router = useRouter();
  const [branches, setBranches] = useState(initialBranches);
  const [draft, setDraft] = useState<Draft>(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const visible = useMemo(() => branches.filter((branch) =>
    (filter === "ALL" || branch.status === filter) &&
    [branch.name, branch.code, branch.city ?? ""].join(" ").toLowerCase().includes(query.toLowerCase())
  ), [branches, filter, query]);

  function startCreate() { setDraft(blank); setEditing(null); setError(""); setShowForm(true); }
  function startEdit(branch: Branch) {
    setDraft({ code: branch.code, name: branch.name, address: branch.address ?? "", city: branch.city ?? "", phone: branch.phone ?? "" });
    setEditing(branch.id); setError(""); setShowForm(true);
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch(editing ? `/api/branches/${editing}` : "/api/branches", {
        method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save branch.");
      if (editing) setBranches((old) => old.map((item) => item.id === editing ? data.branch : item));
      else setBranches((old) => [data.branch, ...old]);
      setShowForm(false); setDraft(blank); setEditing(null); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong."); }
    finally { setBusy(false); }
  }
  async function changeStatus(branch: Branch) {
    const archive = branch.status === "ACTIVE";
    if (archive && !window.confirm(`Archive ${branch.name}? Its sales and stock history will be retained.`)) return;
    setBusy(true); setError("");
    try {
      const response = archive
        ? await fetch(`/api/branches/${branch.id}`, { method: "DELETE" })
        : await fetch(`/api/branches/${branch.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "ACTIVE" }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update branch.");
      setBranches((old) => old.map((item) => item.id === branch.id ? { ...item, status: archive ? "INACTIVE" : "ACTIVE" } : item));
      router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong."); }
    finally { setBusy(false); }
  }

  return <div className="management-page">
    <div className="management-heading"><div><div className="eyebrow">Business setup</div><h1>Branches</h1><p>Manage your stores and control where staff can work.</p></div>
      {owner && <button className="primary-button" onClick={startCreate}><Plus size={16}/> Add branch</button>}
    </div>
    <div className="branch-stats">
      <div className="branch-stat"><span>Total locations</span><strong>{branches.length}</strong></div>
      <div className="branch-stat"><span>Active</span><strong>{branches.filter((b) => b.status === "ACTIVE").length}</strong></div>
      <div className="branch-stat"><span>Archived</span><strong>{branches.filter((b) => b.status === "INACTIVE").length}</strong></div>
    </div>
    {showForm && <form className="management-panel branch-form" onSubmit={save}>
      <div className="panel-header"><div><div className="panel-title">{editing ? "Edit branch" : "Add a branch"}</div><div className="panel-subtitle">Enter the basic location details.</div></div><button type="button" className="icon-button" aria-label="Close" onClick={() => setShowForm(false)}><X size={17}/></button></div>
      <div className="form-grid">
        {(["code", "name", "city", "phone", "address"] as const).map((key) => <label className={key === "address" ? "form-field full" : "form-field"} key={key}><span>{({code:"Branch code",name:"Branch name",city:"City",phone:"Phone",address:"Address"} as const)[key]}</span><input required={key === "code" || key === "name"} value={draft[key]} onChange={(e) => setDraft((old) => ({ ...old, [key]: e.target.value }))} placeholder={key === "code" ? "e.g. QTA-01" : key === "name" ? "e.g. Quetta Main Branch" : ""}/></label>)}
      </div>
      {error && <div className="form-error">{error}</div>}
      <div className="form-actions"><button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Create branch"}</button></div>
    </form>}
    <section className="management-panel">
      <div className="branch-toolbar"><div><div className="panel-title">Your locations</div><div className="panel-subtitle">{owner ? "Only the Owner can add or archive locations." : "You can view locations assigned to your account."}</div></div><div className="branch-filters"><label className="search-box"><Search size={15}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search branches"/></label><select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} aria-label="Filter branch status"><option value="ALL">All status</option><option value="ACTIVE">Active</option><option value="INACTIVE">Archived</option></select></div></div>
      {error && !showForm && <div className="form-error">{error}</div>}
      {visible.length === 0 ? <div className="empty-state"><Building2 size={28}/><strong>No branches found</strong><span>{branches.length ? "Try changing your search or filter." : "Add your first store location to get started."}</span>{owner && branches.length === 0 && <button className="primary-button" onClick={startCreate}><Plus size={15}/> Add first branch</button>}</div> :
        <div className="branch-table-wrap"><table className="branch-table"><thead><tr><th>Branch</th><th>Location</th><th>Status</th>{owner && <th className="align-right">Actions</th>}</tr></thead><tbody>{visible.map((branch) => <tr key={branch.id}><td><div className="table-branch"><span className="branch-symbol"><Building2 size={17}/></span><span><strong>{branch.name}</strong><small>{branch.code}</small></span></div></td><td><span className="location-cell"><MapPin size={13}/>{[branch.city, branch.address].filter(Boolean).join(" · ") || "Location not added"}</span></td><td><span className={branch.status === "ACTIVE" ? "status-pill status-active" : "status-pill"}>{branch.status === "ACTIVE" ? "Active" : "Archived"}</span></td>{owner && <td><div className="row-actions"><button className="small-action" onClick={() => startEdit(branch)} disabled={busy}><Edit3 size={14}/> Edit</button><button className="small-action" onClick={() => changeStatus(branch)} disabled={busy}>{branch.status === "ACTIVE" ? <><Archive size={14}/> Archive</> : <><RotateCcw size={14}/> Reactivate</>}</button></div></td>}</tr>)}</tbody></table></div>}
    </section>
    <div className="info-strip"><Check size={16}/><span>Branch records are archived instead of permanently deleted, preserving historical sales, stock movements and audit records.</span></div>
  </div>;
}
