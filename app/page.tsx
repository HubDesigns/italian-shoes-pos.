import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { Activity, Archive, ArrowUpRight, Building2, ChartNoAxesCombined, CircleDollarSign, Footprints, LayoutDashboard, Package, ReceiptText, ShieldCheck, Users, Wallet } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import LogoutButton from "./logout-button";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    const userCount = await prisma.user.count();
    redirect(userCount === 0 ? "/setup" : "/login");
  }
  const owner = user.role.name === "OWNER";
  const assignedBranchIds = user.branchAssignments.map((item) => item.branchId);
  const branchScope: Prisma.BranchWhereInput = owner ? {} : { id: { in: assignedBranchIds } };
  const [activeBranches, archivedBranches, branches, staffCount] = await Promise.all([
    prisma.branch.count({ where: { organizationId: user.organizationId, ...branchScope, status: "ACTIVE" } }),
    prisma.branch.count({ where: { organizationId: user.organizationId, ...branchScope, status: "INACTIVE" } }),
    prisma.branch.findMany({ where: { organizationId: user.organizationId, ...branchScope }, orderBy: { name: "asc" }, select: { id: true, code: true, name: true, city: true, status: true } }),
    prisma.user.count({ where: { organizationId: user.organizationId, ...(owner ? {} : { branchAssignments: { some: { branchId: { in: assignedBranchIds } } } }) } }),
  ]);
  const permissionKeys = new Set(user.role.permissions.map((item) => item.permission.key));
  const canView = (key: string) => owner || permissionKeys.has(key);
  const nav = [
    { label: "Overview", href: "/", icon: LayoutDashboard, show: true },
    { label: "Branches", href: "/branches", icon: Building2, show: true },
    { label: "Staff & permissions", href: "/staff", icon: Users, show: owner },
  ];
  const cards = [
    { label: "Active branches", value: String(activeBranches), note: "Locations currently operating", icon: Building2 },
    { label: "Staff accounts", value: String(staffCount), note: "Accounts in your access scope", icon: Users },
    { label: "Archived locations", value: String(archivedBranches), note: "Historical records retained", icon: Archive },
    { label: "Your role", value: owner ? "Owner" : user.role.name.replaceAll("_", " "), note: owner ? "Full business authority" : "Access controlled by Owner", icon: ShieldCheck },
  ];
  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Footprints size={23}/></div><div><div className="brand-name">ITALIAN SHOES</div><div className="brand-sub">RETAIL MANAGEMENT</div></div></div>
      <div className="nav-label">Workspace</div>
      <nav className="nav-list" aria-label="Main navigation">{nav.filter((item) => item.show).map((item) => { const Icon = item.icon; return <Link key={item.href} href={item.href} className={item.href === "/" ? "nav-item active" : "nav-item"}><Icon className="nav-icon"/><span>{item.label}</span></Link>; })}</nav>
      <div className="nav-label nav-label-spaced">Modules being developed</div>
      <div className="nav-coming-list"><div><ReceiptText size={16}/> POS & sales</div><div><Package size={16}/> Products & inventory</div><div><Wallet size={16}/> Cash & expenses</div><div><ChartNoAxesCombined size={16}/> Reports</div></div>
      <div className="sidebar-bottom"><div className="user-chip"><div className="avatar">{user.name.slice(0,1).toUpperCase()}</div><div><div className="user-name">{user.name}</div><div className="user-role">{owner ? "Owner / Super Admin" : user.role.name.replaceAll("_"," ")}</div></div></div><LogoutButton/></div>
    </aside>
    <section className="main-area">
      <header className="topbar"><div className="breadcrumb">Workspace <span style={{padding:"0 8px",color:"#c1c9d2"}}>/</span><strong>Overview</strong></div><div className="top-actions"><span className="top-role-chip">{owner ? "OWNER ACCESS" : "BRANCH ACCESS"}</span><div className="owner-pill"><div className="owner-avatar">{user.name.slice(0,1).toUpperCase()}</div><div><div className="owner-label">{user.name}</div><div className="owner-caption">{user.email}</div></div></div></div></header>
      <div className="content">
        <div className="page-heading"><div><div className="eyebrow">{owner ? "Business overview" : "Branch workspace"}</div><h1>Good morning, {user.name.split(" ")[0]}</h1><p className="page-description">{owner ? "A clear view of your business locations and team access." : "Here are the locations and tools assigned to your account."}</p></div><div className="heading-actions"><Link className="primary-button" href="/branches"><Building2 size={15}/> {owner ? "Manage branches" : "View my branches"}</Link></div></div>
        <section className="summary-grid" aria-label="Business summary">{cards.map((card) => { const Icon = card.icon; return <article className="metric-card" key={card.label}><div className="metric-top"><span className="metric-label">{card.label}</span><span className="metric-icon green"><Icon size={17}/></span></div><div className="metric-value metric-value-small">{card.value}</div><div className="metric-foot">{card.note}</div></article>; })}</section>
        <section className="dashboard-grid">
          <article className="panel"><div className="panel-header"><div><div className="panel-title">{owner ? "Your business locations" : "Assigned locations"}</div><div className="panel-subtitle">{owner ? "Manage active and archived branches" : "Only branches assigned by the Owner appear here"}</div></div><Link className="text-link" href="/branches">Open branches <ArrowUpRight size={13}/></Link></div>
            <div className="panel-body">{branches.length ? <div className="branch-list">{branches.map((branch) => <div className="branch-row" key={branch.id}><div className="branch-left"><div className="branch-symbol"><Building2 size={17}/></div><div><div className="branch-name">{branch.name}</div><div className="branch-meta">{branch.code}{branch.city ? " · "+branch.city : ""}</div></div></div><span className={branch.status === "ACTIVE" ? "status-pill status-active" : "status-pill"}>{branch.status === "ACTIVE" ? "Active" : "Archived"}</span></div>)}</div> : <div className="empty-state compact"><Building2 size={25}/><strong>{owner ? "No branches created yet" : "No branch assigned"}</strong><span>{owner ? "Create your first location to begin organizing the business." : "Ask the Owner to assign your branch access."}</span>{owner && <Link href="/branches" className="text-link">Create first branch</Link>}</div>}</div>
          </article>
          <article className="panel"><div className="panel-header"><div><div className="panel-title">Access & control</div><div className="panel-subtitle">Your account permissions</div></div><ShieldCheck size={18} color="#16865d"/></div><div className="panel-body"><div className="access-card"><div className="access-icon"><ShieldCheck size={19}/></div><div><strong>{owner ? "Full Owner authority" : "Role-based access"}</strong><p>{owner ? "You control branch creation, staff permissions and business settings." : "Your access is limited to modules and branches granted by the Owner."}</p></div></div>{owner ? <Link href="/staff" className="permission-link">Manage staff permissions <ArrowUpRight size={14}/></Link> : <div className="permission-list">{[["Dashboard",canView("dashboard.view")],["Sales",canView("sales.view")],["Inventory",canView("inventory.view")],["Expenses",canView("expenses.view")],["Reports",canView("reports.view")]].map(([label,allowed]) => <div className="permission-summary-row" key={String(label)}><span>{label}</span><strong className={allowed ? "allowed" : "not-allowed"}>{allowed ? "Allowed" : "Not granted"}</strong></div>)}</div>}</div></article>
        </section>
        <section className="bottom-grid"><article className="panel"><div className="panel-header"><div><div className="panel-title">Sales & finance</div><div className="panel-subtitle">Live totals will appear when POS and payment modules are connected</div></div><CircleDollarSign size={18} color="#8a96a6"/></div><div className="panel-body"><div className="placeholder-chart"><div><Activity size={25} style={{margin:"0 auto 9px"}}/><div>There are no sales records in the database yet. No figures are being estimated or fabricated.</div></div></div></div></article><article className="panel"><div className="panel-header"><div><div className="panel-title">Next development modules</div><div className="panel-subtitle">These sections will become available as they are implemented</div></div></div><div className="panel-body"><div className="next-module-list"><span>01</span><div><strong>Products & size variants</strong><small>Footwear sizes, colours, SKUs and barcodes</small></div></div><div className="next-module-list"><span>02</span><div><strong>POS, payments & receipts</strong><small>Cash, bank, card and digital payments</small></div></div><div className="next-module-list"><span>03</span><div><strong>Stock transfers & purchasing</strong><small>Central warehouse and branch stock</small></div></div></div></article></section>
        <div className="footer-note">Italian Shoes Retail Management · PKR · Asia/Karachi</div>
      </div>
    </section>
  </main>;
}
