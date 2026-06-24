import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Neautorizat" }, { status: 401 })

  return NextResponse.json({
    redirectUri: process.env.SPV_REDIRECT_URI || "",
    authUrl:     process.env.SPV_AUTH_URL     || "",
    appUrl:      process.env.NEXTAUTH_URL      || "",
  })
}
