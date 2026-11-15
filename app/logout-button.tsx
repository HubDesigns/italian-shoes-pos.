"use client";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
export default function LogoutButton() {
  const router = useRouter();
  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); router.replace("/login"); router.refresh(); }
  return <button className="logout-button" onClick={logout}><LogOut size={15}/> Sign out</button>;
}
