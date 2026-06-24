import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import AngajatiClient from "./AngajatiClient"

export const metadata = { title: "Angajați" }

export default async function AngajatiPage() {
  const session = await auth()
  if (!session?.user?.organizationId) redirect("/login")
  return <AngajatiClient />
}
