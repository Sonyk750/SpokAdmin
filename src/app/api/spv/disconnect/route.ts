import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Neautorizat" }, { status: 401 })

  await db.spvToken.deleteMany({ where: { userId: session.user.id } })

  return NextResponse.json({ success: true })
}
