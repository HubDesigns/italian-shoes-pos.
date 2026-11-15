import { z } from "zod";

/* -------------------------------------------------------------------------
 * Footwear catalog rules shared by the API (server) and the forms (client).
 * Nothing here touches the database.
 * ----------------------------------------------------------------------- */

export const DEPARTMENTS = ["MEN", "WOMEN", "BOYS", "GIRLS", "UNISEX"] as const;
export type Department = (typeof DEPARTMENTS)[number];
export const departmentLabels: Record<Department, string> = {
  MEN: "Men", WOMEN: "Women", BOYS: "Boys", GIRLS: "Girls", UNISEX: "Unisex",
};

export const SIZE_SYSTEMS = ["EU", "UK", "US"] as const;
export type SizeSystem = (typeof SIZE_SYSTEMS)[number];

export const PRODUCT_STATUSES = ["ACTIVE", "ARCHIVED"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

/** Suggestions shown in the forms. They are hints only; any text is accepted. */
export const suggestions = {
  categories: ["Formal", "Casual", "Sports", "Sandals", "Slippers", "Boots", "Loafers", "Sneakers", "Heels", "Flats", "School shoes"],
  closures: ["Lace-up", "Slip-on", "Velcro", "Buckle", "Zip", "Strap", "Elastic"],
  upperMaterials: ["Leather", "Synthetic leather", "Suede", "Canvas", "Mesh", "Fabric", "Rubber"],
  soleMaterials: ["Rubber", "PU", "TPR", "EVA", "Leather", "Crepe"],
  seasons: ["All season", "Summer", "Winter"],
  colors: ["Black", "Brown", "Tan", "Navy", "White", "Grey", "Beige", "Maroon", "Blue", "Red", "Green"],
};

/** Quick-fill size runs for the add-product form. */
export const sizePresets: { label: string; system: SizeSystem; sizes: string }[] = [
  { label: "Men EU 39–45", system: "EU", sizes: "39-45" },
  { label: "Women EU 36–41", system: "EU", sizes: "36-41" },
  { label: "Kids EU 28–35", system: "EU", sizes: "28-35" },
  { label: "Men UK 6–11", system: "UK", sizes: "6-11" },
];

/* ---------------------------------- sizes --------------------------------- */

export function isValidSize(size: number) {
  return Number.isFinite(size) && size > 0 && size <= 60 && Number.isInteger(size * 2);
}

export function formatSize(size: number) {
  return Number.isInteger(size) ? String(size) : size.toFixed(1);
}

/** Size as used inside a SKU: 42 -> "42", 7.5 -> "7H". */
function sizeToken(size: number) {
  return Number.isInteger(size) ? String(size) : `${Math.floor(size)}H`;
}

export type SizeParse = { sizes: number[]; error?: string };

/**
 * Parses sizes typed by a person: "39, 40, 41", "39-44", or "6-9:0.5" (range with a half-size step).
 * Sizes must be positive, at most 60, and in steps of 0.5.
 */
export function parseSizes(input: string): SizeParse {
  const tokens = input.replace(/\s*-\s*/g, "-").replace(/\s*:\s*/g, ":").split(/[,\s]+/).filter(Boolean);
  if (tokens.length === 0) return { sizes: [], error: "Enter at least one size." };
  const found = new Set<number>();
  for (const token of tokens) {
    const range = token.match(/^(\d+(?:\.\d)?)-(\d+(?:\.\d)?)(?::(\d+(?:\.\d+)?))?$/);
    if (range) {
      const from = Number(range[1]);
      const to = Number(range[2]);
      const step = range[3] ? Number(range[3]) : 1;
      if (!isValidSize(from) || !isValidSize(to) || from > to) return { sizes: [], error: `"${token}" is not a valid size range.` };
      if (step !== 0.5 && step !== 1) return { sizes: [], error: `Range step in "${token}" must be 1 or 0.5.` };
      for (let size = from; size <= to; size += step) found.add(size);
    } else {
      const size = Number(token);
      if (!/^\d+(\.\d)?$/.test(token) || !isValidSize(size)) return { sizes: [], error: `"${token}" is not a valid size (use whole or half sizes up to 60).` };
      found.add(size);
    }
    if (found.size > 60) return { sizes: [], error: "That is too many sizes for one product. Use 60 or fewer." };
  }
  return { sizes: [...found].sort((a, b) => a - b) };
}

/* --------------------------------- colours -------------------------------- */

/** "dark  BROWN" -> "Dark Brown", so "black" and "Black" never become two colours. */
export function normalizeColor(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_match, separator: string, letter: string) => separator + letter.toUpperCase());
}

/** Splits "black, brown; tan" into normalized unique colours. */
export function parseColors(input: string) {
  const seen = new Set<string>();
  for (const part of input.split(/[,;\n]+/)) {
    const color = normalizeColor(part);
    if (color) seen.add(color);
  }
  return [...seen];
}

/* ----------------------------------- SKUs --------------------------------- */

function colorCode(color: string) {
  return color.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase() || "CLR";
}

/** ZH-204 + Black + 42 -> "ZH-204-BLA-42". */
export function generateSku(articleCode: string, color: string, size: number) {
  return `${articleCode}-${colorCode(color)}-${sizeToken(size)}`;
}

export type VariantDraft = { color: string; size: number; costPrice: string; salePrice: string; sku?: string | null; barcode?: string | null };
export type FinalVariant = Omit<VariantDraft, "sku" | "barcode"> & { sku: string; barcode: string | null };

/**
 * Normalizes colours and fills in missing SKUs. Typed-in SKUs are kept exactly (uppercased);
 * generated ones get "-2", "-3"... if two colours would otherwise share a code.
 */
export function finalizeVariants(articleCode: string, drafts: VariantDraft[]): FinalVariant[] {
  const taken = new Set(drafts.flatMap((draft) => (draft.sku?.trim() ? [draft.sku.trim().toUpperCase()] : [])));
  return drafts.map((draft) => {
    const color = normalizeColor(draft.color);
    let sku = draft.sku?.trim() ? draft.sku.trim().toUpperCase() : generateSku(articleCode, color, draft.size);
    if (!draft.sku?.trim()) {
      const base = sku;
      let counter = 2;
      while (taken.has(sku)) sku = `${base}-${counter++}`;
      taken.add(sku);
    }
    return { color, size: draft.size, costPrice: draft.costPrice, salePrice: draft.salePrice, sku, barcode: draft.barcode?.trim() || null };
  });
}

/** Every colour in every size, ordered by colour then size. Used by the add-product form. */
export function generateVariantRows(input: { articleCode: string; colors: string[]; sizes: number[]; costPrice: string; salePrice: string }): FinalVariant[] {
  const drafts: VariantDraft[] = input.colors.flatMap((color) =>
    input.sizes.map((size) => ({ color, size, costPrice: input.costPrice, salePrice: input.salePrice })),
  );
  return finalizeVariants(input.articleCode, drafts);
}

/* ------------------------------- validation ------------------------------- */

const money = z.preprocess(
  (value) => (typeof value === "number" ? String(value) : value),
  z.string().trim().regex(/^\d{1,10}(\.\d{1,2})?$/, "Enter an amount like 4500 or 4500.50 (up to 2 decimals)."),
);
const positiveMoney = z.preprocess(
  (value) => (typeof value === "number" ? String(value) : value),
  z.string().trim()
    .regex(/^\d{1,10}(\.\d{1,2})?$/, "Enter an amount like 4500 or 4500.50 (up to 2 decimals).")
    .refine((value) => Number(value) > 0, "Sale price must be greater than zero."),
);

const text = (label: string, max: number) => z.string().trim().max(max, `${label} must be ${max} characters or fewer.`);
const barcodeText = z.string().trim().regex(/^[A-Za-z0-9-]{4,32}$/, "Barcode must be 4–32 letters, numbers or dashes.");
const skuText = z.string().trim().regex(/^[A-Za-z0-9._-]{1,40}$/, "SKU may use letters, numbers, dots, dashes and underscores (max 40).");

export const variantSchema = z.object({
  color: text("Colour", 40).min(1, "Colour is required."),
  size: z.number("Size must be a number.").refine(isValidSize, "Size must be between 1 and 60, in whole or half steps."),
  costPrice: money,
  salePrice: positiveMoney,
  sku: skuText.optional().or(z.literal("")),
  barcode: barcodeText.optional().or(z.literal("")),
});

const variantList = z.array(variantSchema).min(1, "Add at least one colour and size.").max(300, "Add 300 variants or fewer at a time.")
  .refine((list) => new Set(list.map((item) => `${normalizeColor(item.color)}|${item.size}`)).size === list.length, "The same colour and size appears more than once.")
  .refine((list) => {
    const skus = list.map((item) => item.sku?.trim().toUpperCase()).filter(Boolean);
    return new Set(skus).size === skus.length;
  }, "Two variants share the same SKU.")
  .refine((list) => {
    const codes = list.map((item) => item.barcode?.trim()).filter(Boolean);
    return new Set(codes).size === codes.length;
  }, "Two variants share the same barcode.");

const productFields = {
  articleCode: z.string().trim().regex(/^[A-Za-z0-9._/-]{1,30}$/, "Article code may use letters, numbers, dots, dashes and slashes (max 30).").transform((value) => value.toUpperCase()),
  name: text("Name", 120).min(2, "Product name is required."),
  brand: text("Brand", 60),
  category: text("Category", 60).min(1, "Category is required."),
  department: z.enum(DEPARTMENTS, "Choose men, women, boys, girls or unisex."),
  sizeSystem: z.enum(SIZE_SYSTEMS, "Choose EU, UK or US sizing."),
  upperMaterial: text("Upper material", 60),
  soleMaterial: text("Sole material", 60),
  closure: text("Closure", 60),
  heelHeightMm: z.number().int("Heel height must be a whole number of millimetres.").min(0).max(200, "Heel height looks too large (max 200 mm)."),
  season: text("Season", 40),
  description: text("Description", 500),
};

export const createProductSchema = z.object({
  articleCode: productFields.articleCode,
  name: productFields.name,
  brand: productFields.brand.optional(),
  category: productFields.category,
  department: productFields.department,
  sizeSystem: productFields.sizeSystem,
  upperMaterial: productFields.upperMaterial.optional(),
  soleMaterial: productFields.soleMaterial.optional(),
  closure: productFields.closure.optional(),
  heelHeightMm: productFields.heelHeightMm.nullable().optional(),
  season: productFields.season.optional(),
  description: productFields.description.optional(),
  variants: variantList,
});

export const updateProductSchema = z.object({
  name: productFields.name,
  brand: productFields.brand,
  category: productFields.category,
  department: productFields.department,
  sizeSystem: productFields.sizeSystem,
  upperMaterial: productFields.upperMaterial,
  soleMaterial: productFields.soleMaterial,
  closure: productFields.closure,
  heelHeightMm: productFields.heelHeightMm.nullable(),
  season: productFields.season,
  description: productFields.description,
  status: z.enum(PRODUCT_STATUSES),
}).partial().refine((value) => Object.keys(value).length > 0, "Nothing to update.");

export const addVariantsSchema = z.object({ variants: variantList });

export const updateVariantSchema = z.object({
  costPrice: money,
  salePrice: positiveMoney,
  barcode: barcodeText.or(z.literal("")).nullable(),
  status: z.enum(PRODUCT_STATUSES),
}).partial().refine((value) => Object.keys(value).length > 0, "Nothing to update.");

/** First problem in plain words, for showing in a form. */
export function firstIssue(error: z.ZodError) {
  const issue = error.issues[0];
  if (!issue) return "Check the details and try again.";
  const field = issue.path.filter((part) => typeof part === "string").join(" › ");
  if (/^Invalid|expected|received/i.test(issue.message)) return field ? `Check the "${field}" field.` : "Check the details and try again.";
  return issue.message;
}

/** Empty or missing text becomes null, so cleared fields are stored as NULL rather than "". */
export function blankToNull(value: string | null | undefined) {
  return value && value.trim() ? value.trim() : null;
}
