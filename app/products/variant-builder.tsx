"use client";

import { useState } from "react";
import { Trash2, Wand2 } from "lucide-react";
import { formatSize, generateVariantRows, parseColors, parseSizes, sizePresets, suggestions, type SizeSystem } from "@/lib/catalog";

export type BuilderRow = { key: string; color: string; size: number; sku: string; barcode: string; costPrice: string; salePrice: string };

type Props = {
  articleCode: string;
  /** "Colour|size" pairs that already exist, so they are not generated twice. */
  existing?: string[];
  onRowsChange: (rows: BuilderRow[]) => void;
  onSystemSuggest?: (system: SizeSystem) => void;
};

const priceFormat = /^\d{1,10}(\.\d{1,2})?$/;

/**
 * Type the colours and sizes once; get one row per colour and size, each with its own SKU, barcode and prices.
 * Every row can be adjusted before saving.
 */
export default function VariantBuilder({ articleCode, existing = [], onRowsChange, onSystemSuggest }: Props) {
  const [colorsText, setColorsText] = useState("");
  const [sizesText, setSizesText] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [rows, setRows] = useState<BuilderRow[]>([]);
  const [message, setMessage] = useState("");

  function commit(next: BuilderRow[]) { setRows(next); onRowsChange(next); }

  function addColor(color: string) {
    setColorsText((old) => parseColors(`${old},${color}`).join(", "));
  }

  function generate() {
    setMessage("");
    const code = articleCode.trim().toUpperCase();
    if (!code) return setMessage("Enter the article code first; it is used to build each SKU.");
    const colors = parseColors(colorsText);
    if (colors.length === 0) return setMessage("Enter at least one colour.");
    const parsed = parseSizes(sizesText);
    if (parsed.error) return setMessage(parsed.error);
    if (!priceFormat.test(costPrice.trim())) return setMessage("Enter the cost price per pair, e.g. 3200.");
    if (!priceFormat.test(salePrice.trim()) || Number(salePrice) <= 0) return setMessage("Enter the sale price per pair, e.g. 5500.");
    if (colors.length * parsed.sizes.length > 300) return setMessage("That is more than 300 variants. Add colours in batches.");

    const taken = new Set(existing);
    const generated = generateVariantRows({ articleCode: code, colors, sizes: parsed.sizes, costPrice: costPrice.trim(), salePrice: salePrice.trim() });
    const fresh = generated.filter((row) => !taken.has(`${row.color}|${row.size}`));
    const skipped = generated.length - fresh.length;
    commit(fresh.map((row) => ({ key: `${row.color}|${row.size}`, color: row.color, size: row.size, sku: row.sku, barcode: "", costPrice: row.costPrice, salePrice: row.salePrice })));
    setMessage(skipped ? `${skipped} colour/size combination${skipped === 1 ? " was" : "s were"} skipped because ${skipped === 1 ? "it already exists" : "they already exist"}.` : "");
  }

  function update(key: string, field: "sku" | "barcode" | "costPrice" | "salePrice", value: string) {
    commit(rows.map((row) => row.key === key ? { ...row, [field]: value } : row));
  }

  const colorCount = new Set(rows.map((row) => row.color)).size;

  return <div>
    <div className="form-grid">
      <div className="form-field full">
        <label htmlFor="builder-colors">Colours *</label>
        <input id="builder-colors" value={colorsText} onChange={(e) => setColorsText(e.target.value)} placeholder="Black, Brown, Tan" />
        <div className="chip-row">
          {suggestions.colors.map((color) => <button key={color} type="button" className="chip" onClick={() => addColor(color)}>+ {color}</button>)}
        </div>
        <small>Separate colours with commas. &quot;black&quot; and &quot;Black&quot; are treated as the same colour.</small>
      </div>
      <div className="form-field full">
        <label htmlFor="builder-sizes">Sizes *</label>
        <input id="builder-sizes" value={sizesText} onChange={(e) => setSizesText(e.target.value)} placeholder="39-45  or  39, 40, 41  or  6-9:0.5" />
        <div className="chip-row">
          {sizePresets.map((preset) => <button key={preset.label} type="button" className="chip" onClick={() => { setSizesText(preset.sizes); onSystemSuggest?.(preset.system); }}>{preset.label}</button>)}
        </div>
        <small>Use a range like 39-45, a list like 40, 41, 42, or half sizes like 6-9:0.5.</small>
      </div>
      <label className="form-field">
        <span>Cost price per pair (PKR) *</span>
        <input inputMode="decimal" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} placeholder="3200" />
      </label>
      <label className="form-field">
        <span>Sale price per pair (PKR) *</span>
        <input inputMode="decimal" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} placeholder="5500" />
      </label>
    </div>
    <div className="form-actions" style={{ justifyContent: "flex-start", paddingBottom: 14 }}>
      <button type="button" className="secondary-button" onClick={generate}><Wand2 size={15} /> {rows.length ? "Regenerate variants" : "Generate variants"}</button>
    </div>
    {message && <div className="form-error" style={{ marginTop: 0 }}>{message}</div>}

    {rows.length > 0 && <>
      <p className="form-hint">{rows.length} variant{rows.length === 1 ? "" : "s"} ({colorCount} colour{colorCount === 1 ? "" : "s"}). Adjust any SKU, barcode or price below. Regenerating replaces these rows.</p>
      <div className="branch-table-wrap">
        <table className="branch-table variant-table">
          <thead><tr><th>Colour</th><th>Size</th><th>SKU</th><th>Barcode (optional)</th><th>Cost</th><th>Sale price</th><th /></tr></thead>
          <tbody>
            {rows.map((row) => <tr key={row.key}>
              <td>{row.color}</td>
              <td>{formatSize(row.size)}</td>
              <td><input value={row.sku} onChange={(e) => update(row.key, "sku", e.target.value)} aria-label={`SKU for ${row.color} ${formatSize(row.size)}`} /></td>
              <td><input value={row.barcode} onChange={(e) => update(row.key, "barcode", e.target.value)} placeholder="Scan or type" aria-label={`Barcode for ${row.color} ${formatSize(row.size)}`} /></td>
              <td><input inputMode="decimal" value={row.costPrice} onChange={(e) => update(row.key, "costPrice", e.target.value)} aria-label={`Cost for ${row.color} ${formatSize(row.size)}`} /></td>
              <td><input inputMode="decimal" value={row.salePrice} onChange={(e) => update(row.key, "salePrice", e.target.value)} aria-label={`Sale price for ${row.color} ${formatSize(row.size)}`} /></td>
              <td><button type="button" className="small-action" aria-label={`Remove ${row.color} ${formatSize(row.size)}`} onClick={() => commit(rows.filter((item) => item.key !== row.key))}><Trash2 size={13} /></button></td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </>}
  </div>;
}
