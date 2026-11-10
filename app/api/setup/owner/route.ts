import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSessionToken, sessionCookieName } from "@/lib/auth";

const permissions = [
  ["dashboard.view", "View dashboard"],
  ["sales.view", "View POS and sales"],
  ["sales.create", "Create sales"],
  ["inventory.view", "View inventory"],
  ["inventory.manage", "Manage inventory"],
  ["expenses.view", "View expenses"],
  ["expenses.manage", "Manage expenses"],
  ["reports.view", "View branch reports"],
  ["staff.view", "View staff"],
  ["branch.manage", "Create and archive branches"],
  ["permissions.manage", "Manage roles and permissions"],
  ["settings.manage", "Manage business settings"],
] as const;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const setupSecret = String(body?.setupSecret ?? "");
  if (!process.env.OWNER_SETUP_SECRET || setupSecret !== process.env.OWNER_SETUP_SECRET) {
    return NextResponse.json({ error: "The setup key is incorrect. Check OWNER_SETUP_SECRET in your local .env file." }, { status: 403 });
  }

  const name = String(body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const organizationName = String(body?.organizationName ?? "Italian Shoes").trim();
  if (!name || !email || password.length < 10 || !organizationName) {
    return NextResponse.json({ error: "Enter your name, organization, valid email and a password of at least 10 characters." }, { status: 400 });
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      if (await tx.user.count() > 0) throw new Error("SETUP_ALREADY_COMPLETED");
      const organization = await tx.organization.create({ data: { name: organizationName } });
      const permissionRows = await Promise.all(permissions.map(([key, description]) =>
        tx.permission.create({ data: { key, description } })
      ));
      const ownerRole = await tx.role.create({
        data: {
          organizationId: organization.id, name: "OWNER", description: "Full business control", isSystem: true,
          permissions: { create: permissionRows.map((permission) => ({ permissionId: permission.id })) },
        },
      });
      const passwordHash = await bcrypt.hash(password, 12);
      const owner = await tx.user.create({
        data: { organizationId: organization.id, roleId: ownerRole.id, name, email, passwordHash, status: "ACTIVE" },
      });
      const managerRole = await tx.role.create({ data: { organizationId: organization.id, name: "BRANCH_MANAGER", description: "Access limited by Owner permissions", isSystem: true } });
      const managerDefaults = permissionRows.filter((permission) => ["dashboard.view", "sales.view", "sales.create", "inventory.view", "reports.view"].includes(permission.key));
      await tx.rolePermission.createMany({ data: managerDefaults.map((permission) => ({ roleId: managerRole.id, permissionId: permission.id })) });
      return owner;
    }, { maxWait: 10000, timeout: 20000 });

    const response = NextResponse.json({ ok: true });
    response.cookies.set(sessionCookieName(), await createSessionToken(created.id), {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 12,
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.message === "SETUP_ALREADY_COMPLETED") {
      return NextResponse.json({ error: "Initial setup has already been completed. Please sign in." }, { status: 409 });
    }
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json({ error: "That email address is already registered." }, { status: 409 });
    }
    throw error;
  }
}
