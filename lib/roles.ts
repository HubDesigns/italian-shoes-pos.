import type { Prisma } from "@prisma/client";

/* -------------------------------------------------------------------------
 * The permissions and starter roles every business gets.
 * The Owner can change what each non-owner role may do on the Staff screen.
 * ----------------------------------------------------------------------- */

export const SYSTEM_PERMISSIONS = [
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

export const OWNER_ROLE = "OWNER";

export const STARTER_ROLES: { name: string; description: string; permissions: string[] }[] = [
  {
    name: "BRANCH_MANAGER",
    description: "Runs a branch: sells, checks stock and reads branch reports",
    permissions: ["dashboard.view", "sales.view", "sales.create", "inventory.view", "reports.view"],
  },
  {
    name: "CASHIER",
    description: "Counter staff: sells and looks up products",
    permissions: ["sales.view", "sales.create", "inventory.view"],
  },
  {
    name: "WAREHOUSE",
    description: "Stock room: receives and manages inventory",
    permissions: ["dashboard.view", "inventory.view", "inventory.manage"],
  },
];

/**
 * Makes sure the permissions and starter roles exist. Safe to run any number of times, and safe if two
 * requests run it at once. Roles that already exist keep whatever permissions the Owner gave them;
 * only missing roles are created with their defaults. The Owner role is topped up with any new permission.
 * This lets a business that was set up earlier receive newly added roles without any manual step.
 */
export async function ensureSystemRoles(tx: Prisma.TransactionClient, organizationId: string) {
  await tx.permission.createMany({
    data: SYSTEM_PERMISSIONS.map(([key, description]) => ({ key, description })),
    skipDuplicates: true,
  });
  const permissions = await tx.permission.findMany({ select: { id: true, key: true } });
  const idByKey = new Map(permissions.map((permission) => [permission.key, permission.id]));

  const existing = await tx.role.findMany({ where: { organizationId }, select: { name: true } });
  const have = new Set(existing.map((role) => role.name));

  const wanted = [
    { name: OWNER_ROLE, description: "Full business control", permissions: SYSTEM_PERMISSIONS.map(([key]) => key as string) },
    ...STARTER_ROLES,
  ];
  const missing = wanted.filter((role) => !have.has(role.name));
  if (missing.length > 0) {
    await tx.role.createMany({
      data: missing.map((role) => ({ organizationId, name: role.name, description: role.description, isSystem: true })),
      skipDuplicates: true,
    });
  }

  const roles = await tx.role.findMany({ where: { organizationId, name: { in: wanted.map((role) => role.name) } }, select: { id: true, name: true } });
  const roleByName = new Map(roles.map((role) => [role.name, role.id]));

  const rows: { roleId: string; permissionId: string }[] = [];
  for (const role of wanted) {
    const roleId = roleByName.get(role.name);
    // Newly created roles get their defaults; the Owner role is always topped up to the full list.
    if (!roleId || (have.has(role.name) && role.name !== OWNER_ROLE)) continue;
    for (const key of role.permissions) {
      const permissionId = idByKey.get(key);
      if (permissionId) rows.push({ roleId, permissionId });
    }
  }
  if (rows.length > 0) await tx.rolePermission.createMany({ data: rows, skipDuplicates: true });
}
