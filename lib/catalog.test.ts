import { describe, expect, it } from "vitest";
import {
  addVariantsSchema, blankToNull, createProductSchema, finalizeVariants, firstIssue, formatSize,
  generateSku, generateVariantRows, normalizeColor, parseColors, parseSizes, updateProductSchema, updateVariantSchema,
} from "./catalog";

const validProduct = {
  articleCode: "zh-204",
  name: "Oxford Classic",
  category: "Formal",
  department: "MEN",
  sizeSystem: "EU",
  variants: [{ color: "black", size: 42, costPrice: "3200", salePrice: "5500" }],
};

describe("parseSizes", () => {
  it("parses lists, ranges and half-size ranges", () => {
    expect(parseSizes("40, 41 42").sizes).toEqual([40, 41, 42]);
    expect(parseSizes("39-42").sizes).toEqual([39, 40, 41, 42]);
    expect(parseSizes("6-8:0.5").sizes).toEqual([6, 6.5, 7, 7.5, 8]);
    expect(parseSizes("39 - 41").sizes).toEqual([39, 40, 41]);
  });
  it("removes duplicates and sorts", () => {
    expect(parseSizes("42, 40, 41, 40-41").sizes).toEqual([40, 41, 42]);
  });
  it("rejects bad input with a message", () => {
    expect(parseSizes("").error).toMatch(/at least one/i);
    expect(parseSizes("abc").error).toMatch(/not a valid size/i);
    expect(parseSizes("44-40").error).toMatch(/valid size range/i);
    expect(parseSizes("40.3").error).toMatch(/not a valid size/i);
    expect(parseSizes("0").error).toBeDefined();
    expect(parseSizes("61").error).toBeDefined();
    expect(parseSizes("6-9:0.25").error).toMatch(/step/i);
  });
  it("caps the number of sizes", () => {
    expect(parseSizes("1-60:0.5").error).toMatch(/too many/i);
  });
});

describe("colours", () => {
  it("normalizes case and spacing", () => {
    expect(normalizeColor("  dark   BROWN ")).toBe("Dark Brown");
    expect(normalizeColor("off-white")).toBe("Off-White");
  });
  it("splits and de-duplicates", () => {
    expect(parseColors("black, Black; tan\nNavy")).toEqual(["Black", "Tan", "Navy"]);
  });
});

describe("SKUs", () => {
  it("builds readable SKUs", () => {
    expect(formatSize(7.5)).toBe("7.5");
    expect(formatSize(42)).toBe("42");
    expect(generateSku("ZH-204", "Black", 42)).toBe("ZH-204-BLA-42");
    expect(generateSku("ZH-204", "Black", 7.5)).toBe("ZH-204-BLA-7H");
  });
  it("keeps typed SKUs and suffixes colliding generated ones", () => {
    const result = finalizeVariants("ZH", [
      { color: "Beige", size: 40, costPrice: "1", salePrice: "2" },
      { color: "Beige Dark", size: 40, costPrice: "1", salePrice: "2" },
      { color: "Tan", size: 40, costPrice: "1", salePrice: "2", sku: "custom-1" },
    ]);
    expect(result.map((item) => item.sku)).toEqual(["ZH-BEI-40", "ZH-BEI-40-2", "CUSTOM-1"]);
  });
  it("generates a colour x size grid", () => {
    const rows = generateVariantRows({ articleCode: "ZH", colors: ["Black", "Brown"], sizes: [40, 41], costPrice: "100", salePrice: "200" });
    expect(rows).toHaveLength(4);
    expect(new Set(rows.map((row) => row.sku)).size).toBe(4);
    expect(rows[0]).toMatchObject({ color: "Black", size: 40, sku: "ZH-BLA-40" });
  });
});

describe("createProductSchema", () => {
  it("accepts a valid product and uppercases the article code", () => {
    const parsed = createProductSchema.safeParse(validProduct);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.articleCode).toBe("ZH-204");
  });
  it("accepts prices sent as numbers", () => {
    const parsed = createProductSchema.safeParse({ ...validProduct, variants: [{ color: "Black", size: 42, costPrice: 3200, salePrice: 5500 }] });
    expect(parsed.success).toBe(true);
  });
  it("rejects bad prices", () => {
    for (const salePrice of ["0", "-5", "12.345", "abc", ""]) {
      const parsed = createProductSchema.safeParse({ ...validProduct, variants: [{ color: "Black", size: 42, costPrice: "100", salePrice }] });
      expect(parsed.success, `salePrice ${salePrice}`).toBe(false);
    }
  });
  it("rejects duplicate colour+size even when the case differs", () => {
    const parsed = createProductSchema.safeParse({
      ...validProduct,
      variants: [
        { color: "black", size: 42, costPrice: "1", salePrice: "2" },
        { color: "BLACK", size: 42, costPrice: "1", salePrice: "2" },
      ],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(firstIssue(parsed.error)).toMatch(/more than once/i);
  });
  it("rejects shared barcodes and shared SKUs", () => {
    const base = { costPrice: "1", salePrice: "2" };
    const barcodes = createProductSchema.safeParse({ ...validProduct, variants: [{ color: "A", size: 40, barcode: "123456", ...base }, { color: "A", size: 41, barcode: "123456", ...base }] });
    const skus = createProductSchema.safeParse({ ...validProduct, variants: [{ color: "A", size: 40, sku: "x1", ...base }, { color: "A", size: 41, sku: "X1", ...base }] });
    expect(barcodes.success).toBe(false);
    expect(skus.success).toBe(false);
  });
  it("rejects half-step violations, missing variants and bad departments", () => {
    expect(createProductSchema.safeParse({ ...validProduct, variants: [{ color: "A", size: 42.3, costPrice: "1", salePrice: "2" }] }).success).toBe(false);
    expect(createProductSchema.safeParse({ ...validProduct, variants: [] }).success).toBe(false);
    expect(createProductSchema.safeParse({ ...validProduct, department: "ROBOTS" }).success).toBe(false);
  });
  it("gives friendly messages", () => {
    const parsed = createProductSchema.safeParse({ ...validProduct, category: "" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(firstIssue(parsed.error)).toBe("Category is required.");
    const missing = createProductSchema.safeParse({ ...validProduct, name: undefined });
    expect(missing.success).toBe(false);
    if (!missing.success) expect(firstIssue(missing.error)).toMatch(/name/);
  });
});

describe("update schemas", () => {
  it("allows partial product updates but not empty ones", () => {
    expect(updateProductSchema.safeParse({ name: "New name" }).success).toBe(true);
    expect(updateProductSchema.safeParse({ status: "ARCHIVED" }).success).toBe(true);
    expect(updateProductSchema.safeParse({}).success).toBe(false);
    expect(updateProductSchema.safeParse({ status: "DELETED" }).success).toBe(false);
  });
  it("validates variant updates", () => {
    expect(updateVariantSchema.safeParse({ salePrice: "6000" }).success).toBe(true);
    expect(updateVariantSchema.safeParse({ salePrice: "0" }).success).toBe(false);
    expect(updateVariantSchema.safeParse({ barcode: null }).success).toBe(true);
    expect(updateVariantSchema.safeParse({ barcode: "" }).success).toBe(true);
    expect(updateVariantSchema.safeParse({ barcode: "ab" }).success).toBe(false);
    expect(updateVariantSchema.safeParse({}).success).toBe(false);
  });
  it("requires at least one variant when adding", () => {
    expect(addVariantsSchema.safeParse({ variants: [] }).success).toBe(false);
  });
});

describe("blankToNull", () => {
  it("turns empty text into null", () => {
    expect(blankToNull("")).toBeNull();
    expect(blankToNull("   ")).toBeNull();
    expect(blankToNull(undefined)).toBeNull();
    expect(blankToNull(" Leather ")).toBe("Leather");
  });
});
