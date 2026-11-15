"use client";

import { DEPARTMENTS, SIZE_SYSTEMS, departmentLabels, suggestions, type Department, type SizeSystem } from "@/lib/catalog";

export type ProductValues = {
  articleCode: string; name: string; brand: string; category: string;
  department: Department; sizeSystem: SizeSystem;
  upperMaterial: string; soleMaterial: string; closure: string; season: string;
  heelHeightMm: string; description: string;
};

export const emptyProduct: ProductValues = {
  articleCode: "", name: "", brand: "", category: "", department: "MEN", sizeSystem: "EU",
  upperMaterial: "", soleMaterial: "", closure: "", season: "", heelHeightMm: "", description: "",
};

type Props = {
  values: ProductValues;
  onChange: (next: ProductValues) => void;
  brands: string[];
  categories: string[];
  articleEditable: boolean;
};

/** The shoe-specific details every product needs. Shared by the add-product form and the edit panel. */
export default function ProductFields({ values, onChange, brands, categories, articleEditable }: Props) {
  function set<K extends keyof ProductValues>(key: K, value: ProductValues[K]) {
    onChange({ ...values, [key]: value });
  }
  const categoryOptions = [...new Set([...categories, ...suggestions.categories])];

  return <>
    <div className="form-grid">
      <label className="form-field">
        <span>Article code *</span>
        <input value={values.articleCode} onChange={(e) => set("articleCode", e.target.value)} disabled={!articleEditable} placeholder="e.g. ZH-204" maxLength={30} />
        <small>The model number on the box or supplier invoice. Used to build SKUs.</small>
      </label>
      <label className="form-field">
        <span>Product name *</span>
        <input value={values.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Oxford Classic" maxLength={120} />
      </label>
      <label className="form-field">
        <span>Brand</span>
        <input value={values.brand} onChange={(e) => set("brand", e.target.value)} list="brand-options" placeholder="Leave empty for unbranded" maxLength={60} />
      </label>
      <label className="form-field">
        <span>Category *</span>
        <input value={values.category} onChange={(e) => set("category", e.target.value)} list="category-options" placeholder="e.g. Formal, Sandals, Sneakers" maxLength={60} />
      </label>
      <label className="form-field">
        <span>Department *</span>
        <select value={values.department} onChange={(e) => set("department", e.target.value as Department)}>
          {DEPARTMENTS.map((department) => <option key={department} value={department}>{departmentLabels[department]}</option>)}
        </select>
      </label>
      <label className="form-field">
        <span>Size system *</span>
        <select value={values.sizeSystem} onChange={(e) => set("sizeSystem", e.target.value as SizeSystem)}>
          {SIZE_SYSTEMS.map((system) => <option key={system} value={system}>{system}</option>)}
        </select>
        <small>Pick the system printed on your shoes. Sizes below are in this system.</small>
      </label>
      <label className="form-field">
        <span>Upper material</span>
        <input value={values.upperMaterial} onChange={(e) => set("upperMaterial", e.target.value)} list="upper-options" placeholder="e.g. Leather" maxLength={60} />
      </label>
      <label className="form-field">
        <span>Sole material</span>
        <input value={values.soleMaterial} onChange={(e) => set("soleMaterial", e.target.value)} list="sole-options" placeholder="e.g. Rubber" maxLength={60} />
      </label>
      <label className="form-field">
        <span>Closure</span>
        <input value={values.closure} onChange={(e) => set("closure", e.target.value)} list="closure-options" placeholder="e.g. Lace-up" maxLength={60} />
      </label>
      <label className="form-field">
        <span>Season</span>
        <input value={values.season} onChange={(e) => set("season", e.target.value)} list="season-options" placeholder="e.g. All season" maxLength={40} />
      </label>
      <label className="form-field">
        <span>Heel height (mm)</span>
        <input type="number" inputMode="numeric" min={0} max={200} step={1} value={values.heelHeightMm} onChange={(e) => set("heelHeightMm", e.target.value)} placeholder="Heels and wedges only" />
      </label>
      <label className="form-field full">
        <span>Description</span>
        <textarea value={values.description} onChange={(e) => set("description", e.target.value)} maxLength={500} placeholder="Anything staff should know: fit, care, special features" />
      </label>
    </div>
    <datalist id="brand-options">{brands.map((name) => <option key={name} value={name} />)}</datalist>
    <datalist id="category-options">{categoryOptions.map((name) => <option key={name} value={name} />)}</datalist>
    <datalist id="upper-options">{suggestions.upperMaterials.map((name) => <option key={name} value={name} />)}</datalist>
    <datalist id="sole-options">{suggestions.soleMaterials.map((name) => <option key={name} value={name} />)}</datalist>
    <datalist id="closure-options">{suggestions.closures.map((name) => <option key={name} value={name} />)}</datalist>
    <datalist id="season-options">{suggestions.seasons.map((name) => <option key={name} value={name} />)}</datalist>
  </>;
}
