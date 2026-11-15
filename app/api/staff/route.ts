import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (user.role.name !== "OWNER") return NextResponse.json({ error: "Only the Owner can view staff administration." }, { status: 403 });
  const staff = await prisma.user.findMany({
    where: { organizationId: user.organizationId, id: { not: user.id } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, status: true, role: { select: { id: true, name: true } }, branchAssignments: { select: { branch: { select: { id: true, name: true, status: true } } } } },
  });
  return NextResponse.json({ staff });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (user.role.name !== "OWNER") return NextResponse.json({ error: "Only the Owner can create staff accounts." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const roleId = String(body?.roleId ?? "");
  const branchIds = Array.isArray(body?.branchIds) ? [...new Set(body.branchIds.filter((id: unknown) => typeof id === "string"))] as string[] : [];
  if (!name || !email || password.length < 10 || !roleId || branchIds.length === 0) {
    return NextResponse.json({ error: "Enter a name, email, password of at least 10 characters, role and at least one branch." }, { status: 400 });
  }
  const role = await prisma.role.findFirst({ where: { id: roleId, organizationId: user.organizationId } });
  if (!role || role.name === "OWNER") return NextResponse.json({ error: "Select a valid non-owner role." }, { status: 400 });
  const branches = await prisma.branch.findMany({ where: { id: { in: branchIds }, organizationId: user.organizationId, status: "ACTIVE" }, select: { id: true } });
  if (branches.length !== branchIds.length) return NextResponse.json({ error: "One or more selected branches are invalid or inactive." }, { status: 400 });
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const created = await prisma.$transaction(async (tx) => {
      const member = await tx.user.create({
        data: { organizationId: user.organizationId, roleId, name, email, passwordHash, status: "ACTIVE", branchAssignments: { create: branchIds.map((branchId, index) => ({ branchId, isPrimary: index === 0 })) } },
        select: { id: true, name: true, email: true, status: true, role: { select: { id: true, name: true } }, branchAssignments: { select: { branch: { select: { id: true, name: true, status: true } } } } },
      });
      await tx.auditLog.create({ data: { organizationId: user.organizationId, actorUserId: user.id, action: "STAFF_CREATED", entityType: "User", entityId: member.id, newData: { name, email, role: role.name, branchIds } } });
      return member;
    });
    return NextResponse.json({ staff: created }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) return NextResponse.json({ error: "This email address is already registered." }, { status: 409 });
    throw error;
  }
}
