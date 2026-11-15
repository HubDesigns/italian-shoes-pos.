"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArrowLeft, Check, Pencil, RotateCcw } from "lucide-react";
import { addVariantsSchema, departmentLabels, firstIssue, formatSize, updateProductSchema, updateVariantSchema, type Department, type SizeSystem } from "@/lib/catalog";
import { formatPKR } from "@/lib/format";
import ProductFields, { type ProductValues } from "../product-fields";
import VariantBuilder, { type BuilderRow } from "../variant-builder";

export type ProductInfo = {
  id: string; articleCode: string; name: string; brand: string | null; category: string;
  department: Department; sizeSystem: SizeSystem;
  upperMaterial: string | null; soleMaterial: string | null; closure: string | null; season: string | null;
  heelHeightMm: number | null; description: string | null; status: "ACTIVE" | "ARCHIVED";
};
export type VariantRow = {
  id: string; sku: string; barcode: string | null; color: string; size: string;
  costPrice: string | null; salePrice: string; status: "ACTIVE" | "ARCHIVED";
};

type Notice = { kind: "ok" | "error"; text: string } | null;

async function send(url: string, method: string, body: unknown) {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

export default function ProductDetail({ product, variants, canManage, brands, categories }: {
  product: ProductInfo; variants: VariantRow[]; canManage: boolean; brands: string[]; categories: string[];
}) {
  const router = useRouter();
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);

  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<ProductValues>(toValues(product));

  const [editingVariant, setEditingVariant] = useState<string | null>(null);
  const [draft, setDraft] = useState({ costPrice: "", salePrice: "", barcode: "" });

  const [newRows, setNewRows] = useState<BuilderRow[]>([]);
  const [builderKey, setBuilderKey] = useState(0);

  const archived = product.status === "ARCHIVED";
  const colors = new Set(variants.map((variant) => variant.color));
  const sizes = variants.map((variant) => Number(variant.size));
  const sizeRange = sizes.length ? `${formatSize(Math.min(...sizes))}–${formatSize(Math.max(...sizes))} ${product.sizeSystem}` : "—";

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true); setNotice(null);
    try { await action(); setNotice({ kind: "ok", text: success }); router.refresh(); }
    catch (error) { setNotice({ kind: "error", text: error instanceof Error ? error.message : "Something went wrong." }); }
    finally { setBusy(false); }
  }

  function startEdit() { setValues(toValues(product)); setNotice(null); setEditing(true); }

  async function saveDetails() {
    const heel = values.heelHeightMm.trim();
    if (heel && !/^\d{1,3}$/.test(heel)) return setNotice({ kind: "error", text: "Heel height must be a whole number of millimetres." });
    const payload = {
      name: values.name, brand: values.brand, category: values.category, department: values.department, sizeSystem: values.sizeSystem,
      upperMaterial: values.upperMaterial, soleMaterial: values.soleMaterial, closure: values.closure, season: values.season,
      description: values.description, heelHeightMm: heel ? Number(heel) : null,
    };
    const checked = updateProductSchema.safeParse(payload);
    if (!checked.success) return setNotice({ kind: "error", text: firstIssue(checked.error) });
    await run(async () => { await send(`/api/products/${product.id}`, "PATCH", payload); setEditing(false); }, "Product details saved.");
  }

  async function toggleProduct() {
    const next = archived ? "ACTIVE" : "ARCHIVED";
    if (!archived && !window.confirm(`Archive ${product.name}? It stays in your records but is hidden from active lists.`)) return;
    await run(() => send(`/api/products/${product.id}`, "PATCH", { status: next }), archived ? "Product reactivated." : "Product archived.");
  }

  function startVariantEdit(variant: VariantRow) {
    setDraft({ costPrice: variant.costPrice ?? "", salePrice: variant.salePrice, barcode: variant.barcode ?? "" });
    setEditingVariant(variant.id); setNotice(null);
  }

  async function saveVariant(variant: VariantRow) {
    const payload = { costPrice: draft.costPrice, salePrice: draft.salePrice, barcode: draft.barcode.trim() };
    const checked = updateVariantSchema.safeParse(payload);
    if (!checked.success) return setNotice({ kind: "error", text: firstIssue(checked.error) });
    await run(async () => { await send(`/api/variants/${variant.id}`, "PATCH", payload); setEditingVariant(null); }, `${variant.sku} updated.`);
  }

  async function toggleVariant(variant: VariantRow) {
    const next = variant.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE";
    await run(() => send(`/api/variants/${variant.id}`, "PATCH", { status: next }), `${variant.sku} ${next === "ARCHIVED" ? "archived" : "reactivated"}.`);
  }

  async function addVariants() {
    const payload = { variants: newRows.map((row) => ({ color: row.color, size: row.size, sku: row.sku, barcode: row.barcode, costPrice: row.costPrice, salePrice: row.salePrice })) };
    const checked = addVariantsSchema.safeParse(payload);
    if (!checked.success) return setNotice({ kind: "error", text: firstIssue(checked.error) });
    await run(async () => { await send(`/api/products/${product.id}/variants`, "POST", payload); setNewRows([]); setBuilderKey((key) => key + 1); }, `${payload.variants.length} variant${payload.variants.length === 1 ? "" : "s"} added.`);
  }

  const meta: [string, string][] = [
    ["Brand", product.brand ?? "—"], ["Category", product.category], ["Department", departmentLabels[product.department]],
    ["Size system", product.sizeSystem], ["Upper", product.upperMaterial ?? "—"], ["Sole", product.soleMaterial ?? "—"],
    ["Closure", product.closure ?? "—"], ["Season", product.season ?? "—"],
    ["Heel height", product.heelHeightMm === null ? "—" : `${product.heelHeightMm} mm`],
  ];

  return <div className="management-page">
    <div className="management-heading">
      <div>
        <div className="eyebrow">Product · {product.articleCode}</div>
        <h1>{product.name}</h1>
        <p>{colors.size} colour{colors.size === 1 ? "" : "s"} · {variants.length} variant{variants.length === 1 ? "" : "s"} · sizes {sizeRange} <span className={archived ? "status-pill status-archived" : "status-pill status-active"} style={{ marginLeft: 8 }}>{archived ? "Archived" : "Active"}</span></p>
      </div>
      <div className="heading-buttons">
        <Link href="/products" className="secondary-button"><ArrowLeft size={15} /> All products</Link>
        {canManage && <button type="button" className="secondary-button" onClick={toggleProduct} disabled={busy}>{archived ? <><RotateCcw size={15} /> Reactivate</> : <><Archive size={15} /> Archive</>}</button>}
      </div>
    </div>

    {notice && <div className={notice.kind === "ok" ? "success-banner" : "form-error"} style={notice.kind === "error" ? { margin: "0 0 14px" } : undefined}>{notice.text}</div>}

    <section className="management-panel">
      <div className="panel-header">
        <div><div className="panel-title">Shoe details</div><div className="panel-subtitle">Apply to every colour and size.</div></div>
        {canManage && !editing && <button type="button" className="small-action" onClick={startEdit}><Pencil size={13} /> Edit details</button>}
      </div>
      {editing
        ? <>
          <ProductFields values={values} onChange={setValues} brands={brands} categories={categories} articleEditable={false} />
          <div className="form-actions" style={{ paddingBottom: 18 }}>
            <button type="button" className="secondary-button" onClick={() => setEditing(false)}>Cancel</button>
            <button type="button" className="primary-button" onClick={saveDetails} disabled={busy}><Check size={15} /> {busy ? "Saving…" : "Save details"}</button>
          </div>
        </>
        : <>
          <dl className="product-meta-grid">{meta.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          {product.description && <p className="form-hint" style={{ fontSize: 12 }}>{product.description}</p>}
        </>}
    </section>

    <section className="management-panel">
      <div className="panel-header"><div><div className="panel-title">Colours and sizes</div><div className="panel-subtitle">Each row is one sellable item.{canManage ? "" : " Prices can be changed by the Owner."}</div></div></div>
      <div className="branch-table-wrap">
        <table className="branch-table variant-table">
          <thead><tr><th>Colour</th><th>Size</th><th>SKU</th><th>Barcode</th>{canManage && <th>Cost</th>}<th>Sale price</th><th>Status</th>{canManage && <th className="align-right">Actions</th>}</tr></thead>
          <tbody>
            {variants.map((variant) => {
              const isEditing = editingVariant === variant.id;
              return <tr key={variant.id} style={variant.status === "ARCHIVED" ? { opacity: 0.55 } : undefined}>
                <td>{variant.color}</td>
                <td>{formatSize(Number(variant.size))}</td>
                <td>{variant.sku}</td>
                <td>{isEditing ? <input value={draft.barcode} onChange={(e) => setDraft((old) => ({ ...old, barcode: e.target.value }))} placeholder="Scan or type" aria-label="Barcode" /> : variant.barcode ?? "—"}</td>
                {canManage && <td className="price-text">{isEditing ? <input inputMode="decimal" value={draft.costPrice} onChange={(e) => setDraft((old) => ({ ...old, costPrice: e.target.value }))} aria-label="Cost price" /> : formatPKR(variant.costPrice ?? "")}</td>}
                <td className="price-text">{isEditing ? <input inputMode="decimal" value={draft.salePrice} onChange={(e) => setDraft((old) => ({ ...old, salePrice: e.target.value }))} aria-label="Sale price" /> : formatPKR(variant.salePrice)}</td>
                <td><span className={variant.status === "ACTIVE" ? "status-pill status-active" : "status-pill status-archived"}>{variant.status === "ACTIVE" ? "Active" : "Archived"}</span></td>
                {canManage && <td>
                  <div className="row-actions">
                    {isEditing
                      ? <>
                        <button type="button" className="small-action" onClick={() => setEditingVariant(null)} disabled={busy}>Cancel</button>
                        <button type="button" className="small-action" onClick={() => saveVariant(variant)} disabled={busy}><Check size={13} /> Save</button>
                      </>
                      : <>
                        <button type="button" className="small-action" onClick={() => startVariantEdit(variant)} disabled={busy}><Pencil size={13} /> Edit</button>
                        <button type="button" className="small-action" onClick={() => toggleVariant(variant)} disabled={busy}>{variant.status === "ACTIVE" ? <><Archive size={13} /> Archive</> : <><RotateCcw size={13} /> Reactivate</>}</button>
                      </>}
                  </div>
                </td>}
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </section>

    {canManage && !archived && <section className="management-panel">
      <div className="panel-header"><div><div className="panel-title">Add more colours or sizes</div><div className="panel-subtitle">Combinations that already exist are skipped automatically.</div></div></div>
      <VariantBuilder key={builderKey} articleCode={product.articleCode} existing={variants.map((variant) => `${variant.color}|${Number(variant.size)}`)} onRowsChange={setNewRows} />
      {newRows.length > 0 && <div className="form-actions" style={{ paddingBottom: 18 }}>
        <button type="button" className="primary-button" onClick={addVariants} disabled={busy}>{busy ? "Adding…" : `Add ${newRows.length} variant${newRows.length === 1 ? "" : "s"}`}</button>
      </div>}
    </section>}
  </div>;
}

function toValues(product: ProductInfo): ProductValues {
  return {
    articleCode: product.articleCode, name: product.name, brand: product.brand ?? "", category: product.category,
    department: product.department, sizeSystem: product.sizeSystem,
    upperMaterial: product.upperMaterial ?? "", soleMaterial: product.soleMaterial ?? "", closure: product.closure ?? "", season: product.season ?? "",
    heelHeightMm: product.heelHeightMm === null ? "" : String(product.heelHeightMm), description: product.description ?? "",
  };
}
