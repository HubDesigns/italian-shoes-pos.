import type { Prisma } from "@prisma/client";

/** Brand lookups ignore case, so "nike" and "Nike" are the same brand. Creates it when missing. */
export async function findOrCreateBrand(tx: Prisma.TransactionClient, organizationId: string, name: string) {
  const existing = await tx.brand.findFirst({ where: { organizationId, name: { equals: name, mode: "insensitive" } }, select: { id: true } });
  if (existing) return existing.id;
  const created = await tx.brand.create({ data: { organizationId, name }, select: { id: true } });
  return created.id;
}

export async function findOrCreateCategory(tx: Prisma.TransactionClient, organizationId: string, name: string) {
  const existing = await tx.category.findFirst({ where: { organizationId, name: { equals: name, mode: "insensitive" } }, select: { id: true } });
  if (existing) return existing.id;
  const created = await tx.category.create({ data: { organizationId, name }, select: { id: true } });
  return created.id;
}
