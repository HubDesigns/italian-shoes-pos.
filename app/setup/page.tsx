import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import SetupForm from "./setup-form";

export default async function SetupPage() {
  if (await getCurrentUser()) redirect("/");
  if (await prisma.user.count() > 0) redirect("/login");
  return <SetupForm />;
}
