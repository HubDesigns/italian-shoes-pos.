import { notFound, redirect } from "next/navigation";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import WorkspaceLayout from "../../workspace-layout";
import ProductDetail, { type ProductInfo, type VariantRow } from "./product-detail";

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user, "inventory.view")) redirect("/");
  const canManage = hasPermission(user, "inventory.manage");
  const { id } = await params;

  const product = await prisma.product.findFirst({
    where: { id, organizationId: user.organizationId },
    include: {
      brand: { select: { name: true } },
      category: { select: { name: true } },
      variants: { orderBy: [{ color: "asc" }, { size: "asc" }] },
    },
  });
  if (!product) notFound();

  const [brands, categories] = canManage
    ? await Promise.all([
      prisma.brand.findMany({ where: { organizationId: user.organizationId }, orderBy: { name: "asc" }, select: { name: true } }),
      prisma.category.findMany({ where: { organizationId: user.organizationId }, orderBy: { name: "asc" }, select: { name: true } }),
    ])
    : [[], []];

  const info: ProductInfo = {
    id: product.id,
    articleCode: product.articleCode,
    name: product.name,
    brand: product.brand?.name ?? null,
    category: product.category.name,
    department: product.department,
    sizeSystem: product.sizeSystem,
    upperMaterial: product.upperMaterial,
    soleMaterial: product.soleMaterial,
    closure: product.closure,
    season: product.season,
    heelHeightMm: product.heelHeightMm,
    description: product.description,
    status: product.status,
  };

  // Cost prices are only sent to people allowed to manage inventory, not merely hidden in the page.
  const variants: VariantRow[] = product.variants.map((variant) => ({
    id: variant.id,
    sku: variant.sku,
    barcode: variant.barcode,
    color: variant.color,
    size: variant.size.toString(),
    costPrice: canManage ? variant.costPrice.toString() : null,
    salePrice: variant.salePrice.toString(),
    status: variant.status,
  }));

  return <WorkspaceLayout active="products" user={user}>
    <ProductDetail product={info} variants={variants} canManage={canManage} brands={brands.map((item) => item.name)} categories={categories.map((item) => item.name)} />
  </WorkspaceLayout>;
}
