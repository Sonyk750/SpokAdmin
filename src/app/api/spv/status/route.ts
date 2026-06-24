import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ connected: false })

  const token = await db.spvToken.findUnique({ where: { userId: session.user.id } })
  if (!token || (!token.accessToken && !token.refreshToken)) {
    return NextResponse.json({ connected: false })
  }

  const expired = token.expiresAt ? token.expiresAt < new Date() : false

  return NextResponse.json({
    connected:  true,
    expired,
    expiresAt:  token.expiresAt,
    hasRefresh: !!token.refreshToken,
  })
}
