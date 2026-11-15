import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorize, isUniqueViolation, readBody, uniqueMessage } from "@/lib/api";
import { blankToNull, createProductSchema, finalizeVariants } from "@/lib/catalog";
import { findOrCreateBrand, findOrCreateCategory } from "@/lib/catalog-db";

/** Create a product together with all of its colour/size variants in one transaction. */
export async function POST(request: NextRequest) {
  const auth = await authorize("inventory.manage");
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const body = await readBody(request, createProductSchema);
  if ("response" in body) return body.response;
  const input = body.data;
  const variants = finalizeVariants(input.articleCode, input.variants);

  try {
    const product = await prisma.$transaction(async (tx) => {
      const brandName = blankToNull(input.brand);
      const brandId = brandName ? await findOrCreateBrand(tx, user.organizationId, brandName) : null;
      const categoryId = await findOrCreateCategory(tx, user.organizationId, input.category);
      const created = await tx.product.create({
        data: {
          organizationId: user.organizationId,
          articleCode: input.articleCode,
          name: input.name,
          brandId,
          categoryId,
          department: input.department,
          sizeSystem: input.sizeSystem,
          upperMaterial: blankToNull(input.upperMaterial),
          soleMaterial: blankToNull(input.soleMaterial),
          closure: blankToNull(input.closure),
          heelHeightMm: input.heelHeightMm ?? null,
          season: blankToNull(input.season),
          description: blankToNull(input.description),
          variants: {
            create: variants.map((variant) => ({
              organizationId: user.organizationId,
              sku: variant.sku,
              barcode: variant.barcode,
              color: variant.color,
              size: variant.size,
              costPrice: variant.costPrice,
              salePrice: variant.salePrice,
            })),
          },
        },
        select: { id: true },
      });
      await tx.auditLog.create({
        data: {
          organizationId: user.organizationId,
          actorUserId: user.id,
          action: "PRODUCT_CREATED",
          entityType: "Product",
          entityId: created.id,
          newData: { articleCode: input.articleCode, name: input.name, variantCount: variants.length },
        },
      });
      return created;
    }, { maxWait: 10000, timeout: 30000 });
    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) return NextResponse.json({ error: uniqueMessage(error) }, { status: 409 });
    throw error;
  }
}
