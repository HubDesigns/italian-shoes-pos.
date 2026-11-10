import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PermissionsClient from "./permissions-client";
import WorkspaceLayout from "../workspace-layout";

export default async function StaffPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role.name !== "OWNER") redirect("/");
  const [roles, staff, branches] = await Promise.all([
    prisma.role.findMany({ where: { organizationId: user.organizationId }, orderBy: [{ name: "asc" }], select: { id: true, name: true, description: true, permissions: { select: { permission: { select: { key: true, description: true } } } } } }),
    prisma.user.findMany({ where: { organizationId: user.organizationId, id: { not: user.id } }, orderBy: { name: "asc" }, select: { id: true, name: true, email: true, status: true, role: { select: { id: true, name: true } }, branchAssignments: { select: { branch: { select: { id: true, name: true, status: true } } } } } }),
    prisma.branch.findMany({ where: { organizationId: user.organizationId, status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return <WorkspaceLayout active="staff" user={user}><PermissionsClient initialRoles={roles} initialStaff={staff} branches={branches}/></WorkspaceLayout>;
}
