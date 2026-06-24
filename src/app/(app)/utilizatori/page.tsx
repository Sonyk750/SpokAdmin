import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { isSuperAdmin, canManageOrg } from "@/lib/roles"
import UtilizatoriClient from "./UtilizatoriClient"

export const metadata = { title: "Utilizatori — Administrare Asociații" }

export default async function UtilizatoriPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { role, orgRole } = session.user

  if (!isSuperAdmin(role) && !canManageOrg(role, orgRole)) {
    redirect("/dashboard")
  }

  return <UtilizatoriClient userRole={role} orgRole={orgRole ?? null} />
}
