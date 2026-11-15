"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Package, Plus, Search } from "lucide-react";
import { DEPARTMENTS, departmentLabels, type Department } from "@/lib/catalog";
import { formatPKR } from "@/lib/format";

export type ProductRow = {
  id: string; articleCode: string; name: string; brand: string | null; category: string;
  department: Department; sizeSystem: string; status: "ACTIVE" | "ARCHIVED";
  variantCount: number; colorCount: number; minPrice: number | null; maxPrice: number | null;
};

function priceRange(row: ProductRow) {
  if (row.minPrice === null || row.maxPrice === null) return "—";
  return row.minPrice === row.maxPrice ? formatPKR(row.minPrice) : `${formatPKR(row.minPrice)} – ${formatPKR(row.maxPrice)}`;
}

export default function ProductsClient({ rows, canManage }: { rows: ProductRow[]; canManage: boolean }) {
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState<"ALL" | Department>("ALL");
  const [status, setStatus] = useState<"ALL" | "ACTIVE" | "ARCHIVED">("ACTIVE");

  const visible = useMemo(() => rows.filter((row) =>
    (department === "ALL" || row.department === department) &&
    (status === "ALL" || row.status === status) &&
    [row.name, row.articleCode, row.brand ?? "", row.category].join(" ").toLowerCase().includes(query.trim().toLowerCase()),
  ), [rows, department, status, query]);

  const activeProducts = rows.filter((row) => row.status === "ACTIVE");
  const totalVariants = activeProducts.reduce((sum, row) => sum + row.variantCount, 0);

  return <div className="management-page">
    <div className="management-heading">
      <div>
        <div className="eyebrow">Product catalog</div>
        <h1>Products</h1>
        <p>Every shoe model with its colours, sizes and prices.</p>
      </div>
      {canManage && <Link href="/products/new" className="primary-button"><Plus size={16} /> Add product</Link>}
    </div>

    <div className="branch-stats">
      <div className="branch-stat"><span>Active products</span><strong>{activeProducts.length}</strong></div>
      <div className="branch-stat"><span>Sellable variants</span><strong>{totalVariants}</strong></div>
      <div className="branch-stat"><span>Archived</span><strong>{rows.length - activeProducts.length}</strong></div>
    </div>

    <section className="management-panel">
      <div className="branch-toolbar">
        <div><div className="panel-title">Catalog</div><div className="panel-subtitle">Search by name, article code, brand or category.</div></div>
        <div className="branch-filters">
          <label className="search-box"><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products" /></label>
          <select value={department} onChange={(e) => setDepartment(e.target.value as typeof department)} aria-label="Filter by department">
            <option value="ALL">All departments</option>
            {DEPARTMENTS.map((item) => <option key={item} value={item}>{departmentLabels[item]}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Filter by status">
            <option value="ACTIVE">Active</option>
            <option value="ARCHIVED">Archived</option>
            <option value="ALL">All status</option>
          </select>
        </div>
      </div>

      {visible.length === 0
        ? <div className="empty-state">
          <Package size={28} />
          <strong>{rows.length ? "No products match" : "No products yet"}</strong>
          <span>{rows.length ? "Try a different search or filter." : canManage ? "Add your first shoe to start building the catalog." : "The Owner has not added any products yet."}</span>
          {canManage && rows.length === 0 && <Link href="/products/new" className="primary-button"><Plus size={15} /> Add first product</Link>}
        </div>
        : <div className="branch-table-wrap">
          <table className="branch-table">
            <thead><tr><th>Product</th><th>Category</th><th>Department</th><th>Colours</th><th>Variants</th><th>Sale price</th><th>Status</th></tr></thead>
            <tbody>
              {visible.map((row) => <tr key={row.id}>
                <td>
                  <Link href={`/products/${row.id}`} className="table-link">
                    <div className="table-branch"><span className="branch-symbol"><Package size={17} /></span><span><strong>{row.name}</strong><small>{row.articleCode}{row.brand ? ` · ${row.brand}` : ""}</small></span></div>
                  </Link>
                </td>
                <td>{row.category}</td>
                <td>{departmentLabels[row.department]} · {row.sizeSystem}</td>
                <td>{row.colorCount}</td>
                <td>{row.variantCount}</td>
                <td className="price-text">{priceRange(row)}</td>
                <td><span className={row.status === "ACTIVE" ? "status-pill status-active" : "status-pill status-archived"}>{row.status === "ACTIVE" ? "Active" : "Archived"}</span></td>
              </tr>)}
            </tbody>
          </table>
        </div>}
    </section>
  </div>;
}
