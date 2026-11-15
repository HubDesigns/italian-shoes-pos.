import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authorize, isUniqueViolation, jsonError, readBody, uniqueMessage } from "@/lib/api";
import { blankToNull, updateVariantSchema } from "@/lib/catalog";

type Context = { params: Promise<{ id: string }> };

/** Change a variant's prices, barcode or status. Price changes are recorded with the old and new value. */
export async function PATCH(request: NextRequest, context: Context) {
  const auth = await authorize("inventory.manage");
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const { id } = await context.params;

  const body = await readBody(request, updateVariantSchema);
  if ("response" in body) return body.response;
  const input = body.data;

  const existing = await prisma.productVariant.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!existing) return jsonError("Variant not found.", 404);

  const data: Prisma.ProductVariantUncheckedUpdateInput = {};
  const previous: Record<string, unknown> = {};
  const next: Record<string, unknown> = {};
  if (input.costPrice !== undefined) { data.costPrice = input.costPrice; previous.costPrice = existing.costPrice.toString(); next.costPrice = input.costPrice; }
  if (input.salePrice !== undefined) { data.salePrice = input.salePrice; previous.salePrice = existing.salePrice.toString(); next.salePrice = input.salePrice; }
  if (input.barcode !== undefined) { data.barcode = blankToNull(input.barcode); previous.barcode = existing.barcode; next.barcode = data.barcode; }
  if (input.status !== undefined) { data.status = input.status; previous.status = existing.status; next.status = input.status; }

  try {
    const variant = await prisma.$transaction(async (tx) => {
      const updated = await tx.productVariant.update({
        where: { id },
        data,
        select: { id: true, sku: true, barcode: true, color: true, size: true, costPrice: true, salePrice: true, status: true },
      });
      await tx.auditLog.create({
        data: {
          organizationId: user.organizationId,
          actorUserId: user.id,
          action: "VARIANT_UPDATED",
          entityType: "ProductVariant",
          entityId: id,
          previousData: { sku: existing.sku, ...previous } as Prisma.InputJsonObject,
          newData: next as Prisma.InputJsonObject,
        },
      });
      return updated;
    });
    return NextResponse.json({
      variant: { ...variant, size: variant.size.toString(), costPrice: variant.costPrice.toString(), salePrice: variant.salePrice.toString() },
    });
  } catch (error) {
    if (isUniqueViolation(error)) return NextResponse.json({ error: uniqueMessage(error) }, { status: 409 });
    throw error;
  }
}
