import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeOwner, jsonError } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: Context) {
  const auth = await authorizeOwner();
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const branchIds = Array.isArray(body?.branchIds) ? [...new Set(body.branchIds.filter((value: unknown) => typeof value === "string"))] as string[] : null;
  if (!branchIds || branchIds.length === 0) return jsonError("Assign at least one branch.", 400);
  const member = await prisma.user.findFirst({
    where: { id, organizationId: user.organizationId },
    select: { id: true, name: true, branchAssignments: { select: { branchId: true } } },
  });
  if (!member || member.id === user.id) return jsonError("Staff member not found.", 404);
  const branches = await prisma.branch.findMany({ where: { id: { in: branchIds }, organizationId: user.organizationId, status: "ACTIVE" }, select: { id: true } });
  if (branches.length !== branchIds.length) return jsonError("One or more selected branches are invalid or inactive.", 400);
  await prisma.$transaction(async (tx) => {
    await tx.userBranch.deleteMany({ where: { userId: id } });
    await tx.userBranch.createMany({ data: branchIds.map((branchId, index) => ({ userId: id, branchId, isPrimary: index === 0 })) });
    await writeAudit(tx, {
      organizationId: user.organizationId, actorUserId: user.id, action: "STAFF_BRANCH_ACCESS_UPDATED", entityType: "User", entityId: id,
      previousData: { branchIds: member.branchAssignments.map((item) => item.branchId) }, newData: { branchIds }, request,
    });
  });
  return NextResponse.json({ ok: true });
}
