import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import BranchesClient from "./branches-client";

export default async function BranchesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const branches = await prisma.branch.findMany({
    where: { organizationId: user.organizationId, ...(user.role.name === "OWNER" ? {} : { userAssignments: { some: { userId: user.id } } }) },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    select: { id: true, code: true, name: true, address: true, city: true, phone: true, status: true },
  });
  return <BranchesClient initialBranches={branches} owner={user.role.name === "OWNER"}/>;
}
