import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import WorkspaceLayout from "../workspace-layout";
import AccountClient from "./account-client";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <WorkspaceLayout active="account" user={user}>
    <div className="management-page">
      <div className="management-heading">
        <div>
          <div className="eyebrow">My account</div>
          <h1>{user.name}</h1>
          <p>{user.email} · {user.role.name === "OWNER" ? "Owner" : user.role.name.replaceAll("_", " ")}</p>
        </div>
      </div>
      <AccountClient />
    </div>
  </WorkspaceLayout>;
}
