import Link from "next/link";
import { Building2, ChartNoAxesCombined, Footprints, LayoutDashboard, Package, ReceiptText, Users, Wallet, Warehouse } from "lucide-react";
import { hasPermission, type CurrentUser } from "@/lib/auth";
import LogoutButton from "./logout-button";
import MobileNav from "./mobile-nav";

export type WorkspaceSection = "overview" | "branches" | "products" | "staff";

const sectionTitles: Record<WorkspaceSection, string> = {
  overview: "Overview",
  branches: "Branches",
  products: "Products",
  staff: "Staff & permissions",
};

type Props = { children: React.ReactNode; active: WorkspaceSection; user: CurrentUser };

export default function WorkspaceLayout({ children, active, user }: Props) {
  const owner = user.role.name === "OWNER";
  const nav = [
    { key: "overview", label: "Overview", href: "/", icon: LayoutDashboard, show: true },
    { key: "branches", label: "Branches", href: "/branches", icon: Building2, show: true },
    { key: "products", label: "Products", href: "/products", icon: Package, show: hasPermission(user, "inventory.view") },
    { key: "staff", label: "Staff & permissions", href: "/staff", icon: Users, show: owner },
  ] as const;

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark"><Footprints size={23} /></div>
        <div><div className="brand-name">ITALIAN SHOES</div><div className="brand-sub">RETAIL MANAGEMENT</div></div>
      </div>
      <div className="nav-label">Workspace</div>
      <nav className="nav-list" aria-label="Main navigation">
        {nav.filter((item) => item.show).map((item) => {
          const Icon = item.icon;
          return <Link key={item.key} href={item.href} className={item.key === active ? "nav-item active" : "nav-item"}>
            <Icon className="nav-icon" /><span>{item.label}</span>
          </Link>;
        })}
      </nav>
      <div className="nav-label nav-label-spaced">Modules being developed</div>
      <div className="nav-coming-list">
        <div><ReceiptText size={16} /> POS & sales</div>
        <div><Warehouse size={16} /> Stock & transfers</div>
        <div><Wallet size={16} /> Cash & expenses</div>
        <div><ChartNoAxesCombined size={16} /> Reports</div>
      </div>
      <div className="sidebar-bottom">
        <div className="user-chip">
          <div className="avatar">{user.name.slice(0, 1).toUpperCase()}</div>
          <div><div className="user-name">{user.name}</div><div className="user-role">{owner ? "Owner / Super Admin" : user.role.name.replaceAll("_", " ")}</div></div>
        </div>
        <LogoutButton />
      </div>
    </aside>
    <section className="main-area">
      <header className="topbar">
        <div className="top-actions">
          <MobileNav />
          <div className="breadcrumb">
            <Link href="/" className="breadcrumb-link">Workspace</Link>
            <span style={{ padding: "0 8px", color: "#c1c9d2" }}>/</span>
            <strong>{sectionTitles[active]}</strong>
          </div>
        </div>
        <div className="top-actions">
          <span className="top-role-chip">{owner ? "OWNER ACCESS" : "BRANCH ACCESS"}</span>
          <div className="owner-pill">
            <div className="owner-avatar">{user.name.slice(0, 1).toUpperCase()}</div>
            <div><div className="owner-label">{user.name}</div><div className="owner-caption">{user.email}</div></div>
          </div>
        </div>
      </header>
      <div className="workspace-content">{children}</div>
    </section>
  </main>;
}
