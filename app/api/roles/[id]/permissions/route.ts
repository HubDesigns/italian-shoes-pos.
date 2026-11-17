import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeOwner, jsonError } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

type Context = { params: Promise<{ id: string }> };
const ownerOnlyKeys = new Set(["branch.manage", "permissions.manage", "settings.manage"]);

export async function PATCH(request: NextRequest, context: Context) {
  const auth = await authorizeOwner();
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const keys = Array.isArray(body?.permissionKeys) ? [...new Set(body.permissionKeys.filter((key: unknown) => typeof key === "string"))] as string[] : null;
  if (!keys) return jsonError("A permissionKeys array is required.", 400);
  const role = await prisma.role.findFirst({
    where: { id, organizationId: user.organizationId },
    select: { id: true, name: true, permissions: { select: { permission: { select: { key: true } } } } },
  });
  if (!role) return jsonError("Role not found.", 404);
  if (role.name === "OWNER") return jsonError("Owner permissions cannot be reduced from this screen.", 400);
  if (keys.some((key) => ownerOnlyKeys.has(key))) return jsonError("Branch administration, permission management and business settings are Owner-only.", 403);
  const permissions = await prisma.permission.findMany({ where: { key: { in: keys } }, select: { id: true, key: true } });
  if (permissions.length !== keys.length) return jsonError("One or more permission keys are invalid.", 400);
  const previousKeys = role.permissions.map((item) => item.permission.key).sort();
  await prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { roleId: id } });
    if (permissions.length) await tx.rolePermission.createMany({ data: permissions.map((permission) => ({ roleId: id, permissionId: permission.id })) });
    await writeAudit(tx, {
      organizationId: user.organizationId, actorUserId: user.id, action: "ROLE_PERMISSIONS_UPDATED", entityType: "Role", entityId: id,
      previousData: { role: role.name, permissionKeys: previousKeys }, newData: { role: role.name, permissionKeys: [...keys].sort() }, request,
    });
  });
  return NextResponse.json({ ok: true, permissionKeys: keys });
}
