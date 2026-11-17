import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { getCurrentUser, hasPermission, type CurrentUser } from "@/lib/auth";
import { firstIssue } from "@/lib/catalog";

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

type Authorized = { user: CurrentUser } | { response: NextResponse };

/** Signed-in user who holds the permission (the Owner always does). Checked on the server for every call. */
export async function authorize(permission: string): Promise<Authorized> {
  const user = await getCurrentUser();
  if (!user) return { response: jsonError("Please sign in.", 401) };
  if (!hasPermission(user, permission)) return { response: jsonError("You do not have permission to do that.", 403) };
  return { user };
}

/** Signed-in Owner only. Used for staff, role and account administration. */
export async function authorizeOwner(): Promise<Authorized> {
  const user = await getCurrentUser();
  if (!user) return { response: jsonError("Please sign in.", 401) };
  if (user.role.name !== "OWNER") return { response: jsonError("Only the Owner can do that.", 403) };
  return { user };
}

/** Reads the JSON body and validates it; failures come back as a ready-to-return 400 response. */
export async function readBody<T>(request: Request, schema: ZodType<T>): Promise<{ data: T } | { response: NextResponse }> {
  const raw = await request.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { response: jsonError(firstIssue(parsed.error), 400) };
  return { data: parsed.data };
}

/** True for Prisma's unique-constraint error (P2002). */
export function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";
}

/** Plain-words message for whichever unique rule was broken. */
export function uniqueMessage(error: unknown) {
  const target = (error as { meta?: { target?: unknown } }).meta?.target;
  const text = Array.isArray(target) ? target.join(",") : String(target ?? "");
  if (/sku/i.test(text)) return "One of those SKUs is already used by another variant.";
  if (/barcode/i.test(text)) return "One of those barcodes is already used by another variant.";
  if (/articleCode/i.test(text)) return "A product with that article code already exists.";
  if (/color|size/i.test(text)) return "That colour and size already exists for this product.";
  return "That value is already in use.";
}
