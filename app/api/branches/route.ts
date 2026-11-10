import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const isBusinessOwner = user.role.name === "OWNER";
  const branches = await prisma.branch.findMany({
    where: {
      organizationId: user.organizationId,
      ...(isBusinessOwner ? {} : { userAssignments: { some: { userId: user.id } } }),
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    select: { id: true, code: true, name: true, address: true, city: true, phone: true, status: true, createdAt: true },
  });
  return NextResponse.json({ branches });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (user.role.name !== "OWNER") return NextResponse.json({ error: "Only the Owner can create branches." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const code = String(body?.code ?? "").trim().toUpperCase();
  const name = String(body?.name ?? "").trim();
  if (!code || !name) return NextResponse.json({ error: "Branch code and branch name are required." }, { status: 400 });
  try {
    const branch = await prisma.$transaction(async (tx) => {
      const created = await tx.branch.create({
        data: { organizationId: user.organizationId, code, name, address: String(body?.address ?? "").trim() || null, city: String(body?.city ?? "").trim() || null, phone: String(body?.phone ?? "").trim() || null },
      });
      await tx.auditLog.create({ data: { organizationId: user.organizationId, branchId: created.id, actorUserId: user.id, action: "BRANCH_CREATED", entityType: "Branch", entityId: created.id, newData: { code, name } } });
      return created;
    });
    return NextResponse.json({ branch }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) return NextResponse.json({ error: "That branch code is already in use." }, { status: 409 });
    throw error;
  }
}
