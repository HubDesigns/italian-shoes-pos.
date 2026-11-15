import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authorize, isUniqueViolation, jsonError, readBody, uniqueMessage } from "@/lib/api";
import { blankToNull, updateProductSchema } from "@/lib/catalog";
import { findOrCreateBrand, findOrCreateCategory } from "@/lib/catalog-db";

type Context = { params: Promise<{ id: string }> };

/** Edit product details or archive/reactivate it. Only the fields sent are changed. */
export async function PATCH(request: NextRequest, context: Context) {
  const auth = await authorize("inventory.manage");
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const { id } = await context.params;

  const body = await readBody(request, updateProductSchema);
  if ("response" in body) return body.response;
  const input = body.data;

  const existing = await prisma.product.findFirst({
    where: { id, organizationId: user.organizationId },
    include: { brand: { select: { name: true } }, category: { select: { name: true } } },
  });
  if (!existing) return jsonError("Product not found.", 404);

  try {
    await prisma.$transaction(async (tx) => {
      const data: Prisma.ProductUncheckedUpdateInput = {};
      const previous: Record<string, unknown> = {};
      const next: Record<string, unknown> = {};

      if (input.name !== undefined) { data.name = input.name; previous.name = existing.name; next.name = input.name; }
      if (input.department !== undefined) { data.department = input.department; previous.department = existing.department; next.department = input.department; }
      if (input.sizeSystem !== undefined) { data.sizeSystem = input.sizeSystem; previous.sizeSystem = existing.sizeSystem; next.sizeSystem = input.sizeSystem; }
      if (input.upperMaterial !== undefined) { data.upperMaterial = blankToNull(input.upperMaterial); previous.upperMaterial = existing.upperMaterial; next.upperMaterial = data.upperMaterial; }
      if (input.soleMaterial !== undefined) { data.soleMaterial = blankToNull(input.soleMaterial); previous.soleMaterial = existing.soleMaterial; next.soleMaterial = data.soleMaterial; }
      if (input.closure !== undefined) { data.closure = blankToNull(input.closure); previous.closure = existing.closure; next.closure = data.closure; }
      if (input.season !== undefined) { data.season = blankToNull(input.season); previous.season = existing.season; next.season = data.season; }
      if (input.description !== undefined) { data.description = blankToNull(input.description); previous.description = existing.description; next.description = data.description; }
      if (input.heelHeightMm !== undefined) { data.heelHeightMm = input.heelHeightMm; previous.heelHeightMm = existing.heelHeightMm; next.heelHeightMm = input.heelHeightMm; }
      if (input.status !== undefined) { data.status = input.status; previous.status = existing.status; next.status = input.status; }
      if (input.brand !== undefined) {
        const name = blankToNull(input.brand);
        data.brandId = name ? await findOrCreateBrand(tx, user.organizationId, name) : null;
        previous.brand = existing.brand?.name ?? null;
        next.brand = name;
      }
      if (input.category !== undefined) {
        data.categoryId = await findOrCreateCategory(tx, user.organizationId, input.category);
        previous.category = existing.category.name;
        next.category = input.category;
      }

      await tx.product.update({ where: { id }, data });
      const archived = input.status !== undefined && input.status !== existing.status;
      await tx.auditLog.create({
        data: {
          organizationId: user.organizationId,
          actorUserId: user.id,
          action: archived ? (input.status === "ARCHIVED" ? "PRODUCT_ARCHIVED" : "PRODUCT_REACTIVATED") : "PRODUCT_UPDATED",
          entityType: "Product",
          entityId: id,
          previousData: previous as Prisma.InputJsonObject,
          newData: next as Prisma.InputJsonObject,
        },
      });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isUniqueViolation(error)) return NextResponse.json({ error: uniqueMessage(error) }, { status: 409 });
    throw error;
  }
}
