import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import StatePlataClient from "./StatePlataClient"

export const metadata = { title: "State de plată" }

export default async function StateDePlataPage() {
  const session = await auth()
  if (!session?.user?.organizationId) redirect("/login")
  const now = new Date()
  return <StatePlataClient defaultLuna={now.getMonth() + 1} defaultAn={now.getFullYear()} />
}
