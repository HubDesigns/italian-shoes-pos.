import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorize, isUniqueViolation, jsonError, readBody, uniqueMessage } from "@/lib/api";
import { addVariantsSchema, finalizeVariants } from "@/lib/catalog";

type Context = { params: Promise<{ id: string }> };

/** Add more colours/sizes to an existing product. */
export async function POST(request: NextRequest, context: Context) {
  const auth = await authorize("inventory.manage");
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const { id } = await context.params;

  const body = await readBody(request, addVariantsSchema);
  if ("response" in body) return body.response;

  const product = await prisma.product.findFirst({
    where: { id, organizationId: user.organizationId },
    select: { id: true, articleCode: true, status: true },
  });
  if (!product) return jsonError("Product not found.", 404);
  if (product.status !== "ACTIVE") return jsonError("Reactivate this product before adding variants.", 400);

  const variants = finalizeVariants(product.articleCode, body.data.variants);
  try {
    await prisma.$transaction(async (tx) => {
      await tx.productVariant.createMany({
        data: variants.map((variant) => ({
          organizationId: user.organizationId,
          productId: product.id,
          sku: variant.sku,
          barcode: variant.barcode,
          color: variant.color,
          size: variant.size,
          costPrice: variant.costPrice,
          salePrice: variant.salePrice,
        })),
      });
      await tx.auditLog.create({
        data: {
          organizationId: user.organizationId,
          actorUserId: user.id,
          action: "VARIANTS_ADDED",
          entityType: "Product",
          entityId: product.id,
          newData: { count: variants.length, skus: variants.map((variant) => variant.sku) },
        },
      });
    });
    return NextResponse.json({ ok: true, added: variants.length }, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) return NextResponse.json({ error: uniqueMessage(error) }, { status: 409 });
    throw error;
  }
}
