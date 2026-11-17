import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeOwner, isUniqueViolation, jsonError, readBody } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { hashPassword } from "@/lib/passwords";
import { ensureSystemRoles, OWNER_ROLE } from "@/lib/roles";
import { createStaffSchema } from "@/lib/validation";

const staffSelect = {
  id: true, name: true, email: true, status: true,
  role: { select: { id: true, name: true } },
  branchAssignments: { select: { branch: { select: { id: true, name: true, status: true } } } },
} as const;

export async function GET() {
  const auth = await authorizeOwner();
  if ("response" in auth) return auth.response;
  const { user } = auth;
  await prisma.$transaction((tx) => ensureSystemRoles(tx, user.organizationId));
  const [staff, roles] = await Promise.all([
    prisma.user.findMany({ where: { organizationId: user.organizationId, id: { not: user.id } }, orderBy: { name: "asc" }, select: staffSelect }),
    prisma.role.findMany({ where: { organizationId: user.organizationId, name: { not: OWNER_ROLE } }, orderBy: { name: "asc" }, select: { id: true, name: true, description: true } }),
  ]);
  return NextResponse.json({ staff, roles });
}

export async function POST(request: NextRequest) {
  const auth = await authorizeOwner();
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const body = await readBody(request, createStaffSchema);
  if ("response" in body) return body.response;
  const { name, email, password, roleId } = body.data;
  const branchIds = [...new Set(body.data.branchIds)];

  const role = await prisma.role.findFirst({ where: { id: roleId, organizationId: user.organizationId } });
  if (!role || role.name === OWNER_ROLE) return jsonError("Select a valid non-owner role.", 400);
  const branches = await prisma.branch.findMany({ where: { id: { in: branchIds }, organizationId: user.organizationId, status: "ACTIVE" }, select: { id: true } });
  if (branches.length !== branchIds.length) return jsonError("One or more selected branches are invalid or inactive.", 400);

  try {
    const passwordHash = await hashPassword(password);
    const created = await prisma.$transaction(async (tx) => {
      const member = await tx.user.create({
        data: {
          organizationId: user.organizationId, roleId, name, email, passwordHash, status: "ACTIVE", passwordChangedAt: new Date(),
          branchAssignments: { create: branchIds.map((branchId, index) => ({ branchId, isPrimary: index === 0 })) },
        },
        select: staffSelect,
      });
      await writeAudit(tx, {
        organizationId: user.organizationId, actorUserId: user.id, action: "STAFF_CREATED", entityType: "User", entityId: member.id,
        newData: { name, email, role: role.name, branchIds }, request,
      });
      return member;
    });
    return NextResponse.json({ staff: created }, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) return jsonError("This email address is already registered.", 409);
    throw error;
  }
}
