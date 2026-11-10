import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (user.role.name !== "OWNER") return NextResponse.json({ error: "Only the Owner can edit branches." }, { status: 403 });
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const existing = await prisma.branch.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!existing) return NextResponse.json({ error: "Branch not found." }, { status: 404 });
  const data = {
    code: String(body?.code ?? existing.code).trim().toUpperCase(),
    name: String(body?.name ?? existing.name).trim(),
    address: body?.address === undefined ? existing.address : String(body.address).trim() || null,
    city: body?.city === undefined ? existing.city : String(body.city).trim() || null,
    phone: body?.phone === undefined ? existing.phone : String(body.phone).trim() || null,
    status: body?.status === "INACTIVE" ? "INACTIVE" as const : "ACTIVE" as const,
  };
  if (!data.code || !data.name) return NextResponse.json({ error: "Branch code and name are required." }, { status: 400 });
  const branch = await prisma.$transaction(async (tx) => {
    const updated = await tx.branch.update({ where: { id }, data });
    await tx.auditLog.create({ data: { organizationId: user.organizationId, branchId: id, actorUserId: user.id, action: "BRANCH_UPDATED", entityType: "Branch", entityId: id, previousData: { code: existing.code, name: existing.name, status: existing.status }, newData: data } });
    return updated;
  });
  return NextResponse.json({ branch });
}

export async function DELETE(_request: NextRequest, context: Context) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (user.role.name !== "OWNER") return NextResponse.json({ error: "Only the Owner can archive branches." }, { status: 403 });
  const { id } = await context.params;
  const existing = await prisma.branch.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!existing) return NextResponse.json({ error: "Branch not found." }, { status: 404 });
  if (existing.status === "INACTIVE") return NextResponse.json({ error: "This branch is already archived." }, { status: 400 });
  await prisma.$transaction(async (tx) => {
    await tx.branch.update({ where: { id }, data: { status: "INACTIVE" } });
    await tx.auditLog.create({ data: { organizationId: user.organizationId, branchId: id, actorUserId: user.id, action: "BRANCH_ARCHIVED", entityType: "Branch", entityId: id, previousData: { status: existing.status }, newData: { status: "INACTIVE" }, reason: "Archived by Owner" } });
  });
  return NextResponse.json({ ok: true });
}
