import { redirect } from "next/navigation";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import WorkspaceLayout from "../workspace-layout";
import ProductsClient, { type ProductRow } from "./products-client";

export default async function ProductsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user, "inventory.view")) redirect("/");

  const products = await prisma.product.findMany({
    where: { organizationId: user.organizationId },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    select: {
      id: true, articleCode: true, name: true, department: true, sizeSystem: true, status: true,
      brand: { select: { name: true } },
      category: { select: { name: true } },
      variants: { select: { color: true, size: true, salePrice: true, status: true } },
    },
  });

  const rows: ProductRow[] = products.map((product) => {
    const active = product.variants.filter((variant) => variant.status === "ACTIVE");
    const prices = active.map((variant) => Number(variant.salePrice));
    return {
      id: product.id,
      articleCode: product.articleCode,
      name: product.name,
      brand: product.brand?.name ?? null,
      category: product.category.name,
      department: product.department,
      sizeSystem: product.sizeSystem,
      status: product.status,
      variantCount: active.length,
      colorCount: new Set(active.map((variant) => variant.color)).size,
      minPrice: prices.length ? Math.min(...prices) : null,
      maxPrice: prices.length ? Math.max(...prices) : null,
    };
  });

  return <WorkspaceLayout active="products" user={user}>
    <ProductsClient rows={rows} canManage={hasPermission(user, "inventory.manage")} />
  </WorkspaceLayout>;
}
