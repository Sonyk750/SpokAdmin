import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import OpBugetStatClient from "./OpBugetStatClient"

export const metadata = { title: "OP Buget de stat" }

export default async function OpBugetStatPage() {
  const session = await auth()
  if (!session?.user?.organizationId) redirect("/login")
  const now = new Date()
  return <OpBugetStatClient defaultLuna={now.getMonth() + 1} defaultAn={now.getFullYear()} />
}
