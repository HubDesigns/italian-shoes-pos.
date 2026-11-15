import { redirect } from "next/navigation";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import WorkspaceLayout from "../../workspace-layout";
import ProductForm from "../product-form";

export default async function NewProductPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user, "inventory.manage")) redirect("/products");
  const [brands, categories] = await Promise.all([
    prisma.brand.findMany({ where: { organizationId: user.organizationId }, orderBy: { name: "asc" }, select: { name: true } }),
    prisma.category.findMany({ where: { organizationId: user.organizationId }, orderBy: { name: "asc" }, select: { name: true } }),
  ]);
  return <WorkspaceLayout active="products" user={user}>
    <div className="management-page">
      <div className="management-heading">
        <div>
          <div className="eyebrow">Product catalog</div>
          <h1>Add a product</h1>
          <p>Enter the shoe once, then generate every colour and size.</p>
        </div>
      </div>
      <ProductForm brands={brands.map((item) => item.name)} categories={categories.map((item) => item.name)} />
    </div>
  </WorkspaceLayout>;
}
