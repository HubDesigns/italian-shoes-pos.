import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import BranchesClient from "./branches-client";
import WorkspaceLayout from "../workspace-layout";

export default async function BranchesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const branches = await prisma.branch.findMany({
    where: { organizationId: user.organizationId, ...(user.role.name === "OWNER" ? {} : { status: "ACTIVE", userAssignments: { some: { userId: user.id } } }) },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    select: { id: true, code: true, name: true, address: true, city: true, phone: true, status: true },
  });
  return <WorkspaceLayout active="branches" user={user}><BranchesClient initialBranches={branches} owner={user.role.name === "OWNER"}/></WorkspaceLayout>;
}
