import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isSuperAdmin, canManageOrg } from "@/lib/roles";
import DrepturiClient from "./DrepturiClient";

export const metadata = { title: "Drepturi & roluri — Administrare Asociații" };

export default async function DrepturiPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { role, orgRole } = session.user;
  if (!isSuperAdmin(role) && !canManageOrg(role, orgRole)) {
    redirect("/dashboard");
  }

  return <DrepturiClient />;
}
