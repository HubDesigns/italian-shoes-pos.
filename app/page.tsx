"use client";

import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, Bell, Boxes,
  Building2, CalendarDays, ChartNoAxesCombined, ChevronDown, CircleDollarSign,
  ClipboardList, CreditCard, FileBarChart, Footprints, LayoutDashboard,
  Menu, Package, PackageSearch, ReceiptText, Search, Settings, ShieldAlert,
  ShoppingBag, Truck, Users, Wallet, Warehouse
} from "lucide-react";

const navigation = [
  { label: "Overview", icon: LayoutDashboard, active: true },
  { label: "Branches", icon: Building2 },
  { label: "POS Terminal", icon: ShoppingBag },
  { label: "Sales & Invoices", icon: ReceiptText },
  { label: "Products & Inventory", icon: Package },
  { label: "Warehouse & Transfers", icon: Warehouse },
  { label: "Purchases & Suppliers", icon: Truck },
  { label: "Customers", icon: Users },
  { label: "Cash Management", icon: Wallet },
  { label: "Bills & Expenses", icon: ClipboardList },
  { label: "Staff & Payroll", icon: Users },
  { label: "Reports & Analytics", icon: FileBarChart },
  { label: "Business Control", icon: ShieldAlert },
  { label: "Settings", icon: Settings },
];

const metrics = [
  { label: "Today's Sales", icon: CircleDollarSign, tone: "green", note: "Live sales total will appear here" },
  { label: "Cash Collected", icon: Wallet, tone: "", note: "Cash payments only" },
  { label: "Inventory Value", icon: Boxes, tone: "", note: "Based on recorded stock cost" },
  { label: "Pending Alerts", icon: AlertTriangle, tone: "amber", note: "Discrepancies and approvals" },
];

const branches = ["Branch 01", "Branch 02", "Branch 03", "Branch 04"];

export default function DashboardPage() {
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Footprints size={23} strokeWidth={2.2} /></div>
          <div><div className="brand-name">ITALIAN SHOES</div><div className="brand-sub">RETAIL MANAGEMENT</div></div>
        </div>
        <div className="nav-label">Workspace</div>
        <nav className="nav-list" aria-label="Main navigation">
          {navigation.map((item) => {
            const Icon = item.icon;
            return <button key={item.label} className={`nav-item ${item.active ? "active" : ""}`} type="button">
              <Icon className="nav-icon" strokeWidth={1.8} /><span>{item.label}</span>
            </button>;
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="user-chip">
            <div className="avatar">O</div>
            <div><div className="user-name">Business Owner</div><div className="user-role">Super Admin</div></div>
          </div>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div className="top-actions">
            <button className="icon-button mobile-menu" aria-label="Open menu" type="button"><Menu size={18} /></button>
            <div className="breadcrumb">Workspace <span style={{padding: "0 8px", color: "#c1c9d2"}}>/</span> <strong>Overview</strong></div>
          </div>
          <div className="top-actions">
            <button className="icon-button" aria-label="Search" type="button"><Search size={17} /></button>
            <button className="icon-button" aria-label="Notifications" type="button"><Bell size={17} /><span className="notification-dot" /></button>
            <div className="owner-pill">
              <div className="owner-avatar">O</div>
              <div><div className="owner-label">Business Owner</div><div className="owner-caption">Administrator</div></div>
              <ChevronDown size={14} color="#8491a2" />
            </div>
          </div>
        </header>

        <div className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">Business overview</div>
              <h1>Good morning</h1>
              <p className="page-description">Here is what is happening across your business.</p>
            </div>
            <div className="heading-actions">
              <button className="select-control" type="button"><Building2 size={15} /> All branches <ChevronDown size={14} /></button>
              <button className="secondary-button" type="button"><CalendarDays size={15} /> Today <ChevronDown size={14} /></button>
              <button className="primary-button" type="button"><FileBarChart size={15} /> View reports</button>
            </div>
          </div>

          <section className="summary-grid" aria-label="Business summary">
            {metrics.map((metric) => {
              const Icon = metric.icon;
              return <article className="metric-card" key={metric.label}>
                <div className="metric-top">
                  <span className="metric-label">{metric.label}</span>
                  <span className={`metric-icon ${metric.tone}`}><Icon size={17} /></span>
                </div>
                <div className="metric-value">—</div>
                <div className="metric-foot">{metric.note}</div>
              </article>;
            })}
          </section>

          <section className="dashboard-grid">
            <article className="panel">
              <div className="panel-header">
                <div><div className="panel-title">Branch performance</div><div className="panel-subtitle">Compare activity across all locations</div></div>
                <a className="text-link" href="/branches">Manage branches</a>
              </div>
              <div className="panel-body">
                <div className="branch-list">
                  {branches.map((branch, index) => <div className="branch-row" key={branch}>
                    <div className="branch-left">
                      <div className="branch-symbol"><Building2 size={17} /></div>
                      <div><div className="branch-name">{branch}</div><div className="branch-meta">Branch setup pending</div></div>
                    </div>
                    <span className="status-pill">Not configured</span>
                  </div>)}
                </div>
                <p className="empty-note">Branch sales and employee performance will appear here after branches, users and transactions are configured.</p>
              </div>
            </article>

            <article className="panel">
              <div className="panel-header">
                <div><div className="panel-title">Business alerts</div><div className="panel-subtitle">Items that may need your attention</div></div>
                <span className="metric-icon amber"><ShieldAlert size={17} /></span>
              </div>
              <div className="panel-body">
                <div className="alert-list">
                  <div className="alert-row"><div className="alert-symbol"><AlertTriangle size={16} /></div><div><div className="alert-title">Cash reconciliation</div><div className="alert-description">Shortages and excess cash will be flagged after shift closing.</div></div></div>
                  <div className="alert-row"><div className="alert-symbol"><PackageSearch size={16} /></div><div><div className="alert-title">Inventory monitoring</div><div className="alert-description">Low stock and stock-count differences will appear here.</div></div></div>
                  <div className="alert-row"><div className="alert-symbol"><Activity size={16} /></div><div><div className="alert-title">Approval requests</div><div className="alert-description">Discounts, returns and adjustments requiring approval.</div></div></div>
                </div>
              </div>
            </article>
          </section>

          <section className="bottom-grid">
            <article className="panel">
              <div className="panel-header"><div><div className="panel-title">Sales activity</div><div className="panel-subtitle">Daily sales trend across selected branches</div></div><ArrowUpRight size={17} color="#8a96a6" /></div>
              <div className="panel-body"><div className="placeholder-chart"><div><ChartNoAxesCombined size={25} style={{margin: "0 auto 9px"}} /><div>Sales chart will be connected to verified transaction data.</div></div></div></div>
            </article>
            <article className="panel">
              <div className="panel-header"><div><div className="panel-title">Payment overview</div><div className="panel-subtitle">Cash, bank and digital payment breakdown</div></div><ArrowDownRight size={17} color="#8a96a6" /></div>
              <div className="panel-body"><div className="placeholder-chart"><div><CreditCard size={25} style={{margin: "0 auto 9px"}} /><div>Payment breakdown will appear after payment methods are configured.</div></div></div></div>
            </article>
          </section>
          <div className="footer-note">Italian Shoes Retail Management · PKR · Asia/Karachi</div>
        </div>
      </section>
    </main>
  );
}
