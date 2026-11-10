import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: Context) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (user.role.name !== "OWNER") return NextResponse.json({ error: "Only the Owner can change branch assignments." }, { status: 403 });
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const branchIds = Array.isArray(body?.branchIds) ? [...new Set(body.branchIds.filter((value: unknown) => typeof value === "string"))] as string[] : null;
  if (!branchIds || branchIds.length === 0) return NextResponse.json({ error: "Assign at least one branch." }, { status: 400 });
  const member = await prisma.user.findFirst({ where: { id, organizationId: user.organizationId }, select: { id: true, name: true } });
  if (!member || member.id === user.id) return NextResponse.json({ error: "Staff member not found." }, { status: 404 });
  const branches = await prisma.branch.findMany({ where: { id: { in: branchIds }, organizationId: user.organizationId, status: "ACTIVE" }, select: { id: true } });
  if (branches.length !== branchIds.length) return NextResponse.json({ error: "One or more selected branches are invalid or inactive." }, { status: 400 });
  await prisma.$transaction(async (tx) => {
    await tx.userBranch.deleteMany({ where: { userId: id } });
    await tx.userBranch.createMany({ data: branchIds.map((branchId, index) => ({ userId: id, branchId, isPrimary: index === 0 })) });
    await tx.auditLog.create({ data: { organizationId: user.organizationId, actorUserId: user.id, action: "STAFF_BRANCH_ACCESS_UPDATED", entityType: "User", entityId: id, newData: { branchIds } } });
  });
  return NextResponse.json({ ok: true });
}
