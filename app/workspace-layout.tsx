import Link from "next/link";
import { Building2, Footprints, LayoutDashboard, Package, ReceiptText, ShieldCheck, Users, Wallet, ChartNoAxesCombined } from "lucide-react";
import LogoutButton from "./logout-button";

type Props = { children: React.ReactNode; active: "branches" | "staff"; user: { name: string; email: string; role: { name: string } } };
export default function WorkspaceLayout({ children, active, user }: Props) {
  const owner = user.role.name === "OWNER";
  const nav = [
    { label: "Overview", href: "/", icon: LayoutDashboard },
    { label: "Branches", href: "/branches", icon: Building2 },
    ...(owner ? [{ label: "Staff & permissions", href: "/staff", icon: Users }] : []),
  ];
  return <main className="app-shell">
    <aside className="sidebar"><div className="brand"><div className="brand-mark"><Footprints size={23}/></div><div><div className="brand-name">ITALIAN SHOES</div><div className="brand-sub">RETAIL MANAGEMENT</div></div></div>
      <div className="nav-label">Workspace</div><nav className="nav-list" aria-label="Main navigation">{nav.map((item) => { const Icon = item.icon; const selected = (active === "branches" && item.href === "/branches") || (active === "staff" && item.href === "/staff"); return <Link key={item.href} href={item.href} className={selected ? "nav-item active" : "nav-item"}><Icon className="nav-icon"/><span>{item.label}</span></Link>; })}</nav>
      <div className="nav-label nav-label-spaced">Modules being developed</div><div className="nav-coming-list"><div><ReceiptText size={16}/> POS & sales</div><div><Package size={16}/> Products & inventory</div><div><Wallet size={16}/> Cash & expenses</div><div><ChartNoAxesCombined size={16}/> Reports</div></div>
      <div className="sidebar-bottom"><div className="user-chip"><div className="avatar">{user.name.slice(0,1).toUpperCase()}</div><div><div className="user-name">{user.name}</div><div className="user-role">{owner ? "Owner / Super Admin" : user.role.name.replaceAll("_"," ")}</div></div></div><LogoutButton/></div>
    </aside>
    <section className="main-area"><header className="topbar"><div className="breadcrumb"><Link href="/" className="breadcrumb-link">Workspace</Link><span style={{padding:"0 8px",color:"#c1c9d2"}}>/</span><strong>{active === "branches" ? "Branches" : "Staff & permissions"}</strong></div><div className="top-actions"><span className="top-role-chip">{owner ? "OWNER ACCESS" : "BRANCH ACCESS"}</span><div className="owner-pill"><div className="owner-avatar">{user.name.slice(0,1).toUpperCase()}</div><div><div className="owner-label">{user.name}</div><div className="owner-caption">{user.email}</div></div></div></div></header><div className="workspace-content">{children}</div></section>
  </main>;
}
