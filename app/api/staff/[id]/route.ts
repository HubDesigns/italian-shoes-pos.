import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authorizeOwner, jsonError, readBody } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { OWNER_ROLE } from "@/lib/roles";
import { updateStaffSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

/** Rename, change the role of, suspend or reactivate a staff member. Only the fields sent are changed. */
export async function PATCH(request: NextRequest, context: Context) {
  const auth = await authorizeOwner();
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const { id } = await context.params;

  const body = await readBody(request, updateStaffSchema);
  if ("response" in body) return body.response;
  const input = body.data;

  if (id === user.id) return jsonError("You cannot change your own account here. Use My account instead.", 400);
  const member = await prisma.user.findFirst({
    where: { id, organizationId: user.organizationId },
    select: { id: true, name: true, status: true, role: { select: { id: true, name: true } } },
  });
  if (!member || member.role.name === OWNER_ROLE) return jsonError("Staff member not found.", 404);

  const data: Prisma.UserUncheckedUpdateInput = {};
  const previous: Record<string, string> = {};
  const next: Record<string, string> = {};
  let action = "STAFF_UPDATED";

  if (input.name !== undefined && input.name !== member.name) {
    data.name = input.name; previous.name = member.name; next.name = input.name;
  }
  if (input.roleId !== undefined && input.roleId !== member.role.id) {
    const role = await prisma.role.findFirst({ where: { id: input.roleId, organizationId: user.organizationId }, select: { id: true, name: true } });
    if (!role || role.name === OWNER_ROLE) return jsonError("Select a valid non-owner role.", 400);
    data.roleId = role.id; previous.role = member.role.name; next.role = role.name;
    action = "STAFF_ROLE_CHANGED";
  }
  if (input.status !== undefined && input.status !== member.status) {
    data.status = input.status; previous.status = member.status; next.status = input.status;
    // Suspending also ends every session the person has open, so reactivating later does not revive an old one.
    if (input.status === "SUSPENDED") data.sessionVersion = { increment: 1 };
    action = input.status === "SUSPENDED" ? "STAFF_SUSPENDED" : "STAFF_REACTIVATED";
  }
  if (Object.keys(next).length === 0) return NextResponse.json({ ok: true, changed: false });

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data });
    await writeAudit(tx, {
      organizationId: user.organizationId, actorUserId: user.id, action, entityType: "User", entityId: id,
      previousData: previous, newData: next, request,
    });
  });
  return NextResponse.json({ ok: true, changed: true, ...(next.status ? { status: next.status } : {}), ...(next.role ? { role: next.role } : {}) });
}
