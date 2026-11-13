import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };
const ownerOnlyKeys = new Set(["branch.manage", "permissions.manage", "settings.manage"]);

export async function PATCH(request: NextRequest, context: Context) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (user.role.name !== "OWNER") return NextResponse.json({ error: "Only the Owner can change role permissions." }, { status: 403 });
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const keys = Array.isArray(body?.permissionKeys) ? [...new Set(body.permissionKeys.filter((key: unknown) => typeof key === "string"))] as string[] : null;
  if (!keys) return NextResponse.json({ error: "A permissionKeys array is required." }, { status: 400 });
  const role = await prisma.role.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!role) return NextResponse.json({ error: "Role not found." }, { status: 404 });
  if (role.name === "OWNER") return NextResponse.json({ error: "Owner permissions cannot be reduced from this screen." }, { status: 400 });
  if (keys.some((key) => ownerOnlyKeys.has(key))) return NextResponse.json({ error: "Branch administration, permission management and business settings are Owner-only." }, { status: 403 });
  const permissions = await prisma.permission.findMany({ where: { key: { in: keys } }, select: { id: true, key: true } });
  if (permissions.length !== keys.length) return NextResponse.json({ error: "One or more permission keys are invalid." }, { status: 400 });
  await prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { roleId: id } });
    if (permissions.length) await tx.rolePermission.createMany({ data: permissions.map((permission) => ({ roleId: id, permissionId: permission.id })) });
    await tx.auditLog.create({ data: { organizationId: user.organizationId, actorUserId: user.id, action: "ROLE_PERMISSIONS_UPDATED", entityType: "Role", entityId: id, previousData: {}, newData: { permissionKeys: keys } } });
  });
  return NextResponse.json({ ok: true, permissionKeys: keys });
}
