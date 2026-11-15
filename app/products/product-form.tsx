"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createProductSchema, firstIssue } from "@/lib/catalog";
import ProductFields, { emptyProduct, type ProductValues } from "./product-fields";
import VariantBuilder, { type BuilderRow } from "./variant-builder";

export default function ProductForm({ brands, categories }: { brands: string[]; categories: string[] }) {
  const router = useRouter();
  const [values, setValues] = useState<ProductValues>(emptyProduct);
  const [rows, setRows] = useState<BuilderRow[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const heel = values.heelHeightMm.trim();
    if (heel && !/^\d{1,3}$/.test(heel)) return setError("Heel height must be a whole number of millimetres.");
    const payload = {
      articleCode: values.articleCode, name: values.name, brand: values.brand, category: values.category,
      department: values.department, sizeSystem: values.sizeSystem,
      upperMaterial: values.upperMaterial, soleMaterial: values.soleMaterial, closure: values.closure, season: values.season,
      description: values.description, heelHeightMm: heel ? Number(heel) : null,
      variants: rows.map((row) => ({ color: row.color, size: row.size, sku: row.sku, barcode: row.barcode, costPrice: row.costPrice, salePrice: row.salePrice })),
    };
    const checked = createProductSchema.safeParse(payload);
    if (!checked.success) return setError(firstIssue(checked.error));

    setBusy(true);
    try {
      const response = await fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save the product.");
      router.push(`/products/${data.product.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return <form onSubmit={submit}>
    <section className="management-panel">
      <div className="panel-header"><div><div className="panel-title">1. Shoe details</div><div className="panel-subtitle">What the shoe is. These apply to every colour and size.</div></div></div>
      <ProductFields values={values} onChange={setValues} brands={brands} categories={categories} articleEditable />
    </section>

    <section className="management-panel">
      <div className="panel-header"><div><div className="panel-title">2. Colours, sizes and prices</div><div className="panel-subtitle">Every colour in every size becomes its own sellable item with its own stock later.</div></div></div>
      <VariantBuilder articleCode={values.articleCode} onRowsChange={setRows} onSystemSuggest={(sizeSystem) => setValues((old) => ({ ...old, sizeSystem }))} />
    </section>

    {error && <div className="form-error" style={{ margin: "0 0 14px" }}>{error}</div>}
    <div className="form-actions" style={{ padding: 0 }}>
      <Link href="/products" className="secondary-button">Cancel</Link>
      <button className="primary-button" disabled={busy || rows.length === 0}>{busy ? "Saving…" : `Save product${rows.length ? ` with ${rows.length} variant${rows.length === 1 ? "" : "s"}` : ""}`}</button>
    </div>
  </form>;
}
