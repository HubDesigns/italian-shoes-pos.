import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import ResetOwnerForm from "./reset-owner-form";

export default async function ResetOwnerPage() {
  if (await getCurrentUser()) redirect("/account");
  return <ResetOwnerForm />;
}
