import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url)
  const code  = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")

  const redirectBase = `${origin}/spv/conectare`

  if (error) return NextResponse.redirect(`${redirectBase}?spv_error=${error}`)
  if (!code || !state) return NextResponse.redirect(`${redirectBase}?spv_error=invalid_callback`)

  let userId = ""
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64").toString())
    userId = decoded.userId
  } catch {
    return NextResponse.redirect(`${redirectBase}?spv_error=invalid_state`)
  }

  if (!userId) return NextResponse.redirect(`${redirectBase}?spv_error=invalid_state`)

  try {
    const tokenRes = await fetch(process.env.SPV_TOKEN_URL!, {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    new URLSearchParams({
        grant_type:    "authorization_code",
        code,
        redirect_uri:  process.env.SPV_REDIRECT_URI!,
        client_id:     process.env.SPV_CLIENT_ID!,
        client_secret: process.env.SPV_CLIENT_SECRET!,
      }),
    })

    const tok = await tokenRes.json()
    if (!tok.access_token && !tok.refresh_token) {
      console.error("SPV token error:", tok)
      return NextResponse.redirect(`${redirectBase}?spv_error=token_failed`)
    }

    const expiresAt = tok.expires_in
      ? new Date(Date.now() + (tok.expires_in - 60) * 1000)
      : null

    await db.spvToken.upsert({
      where:  { userId },
      update: { accessToken: tok.access_token ?? null, refreshToken: tok.refresh_token ?? null, expiresAt },
      create: { userId, accessToken: tok.access_token ?? null, refreshToken: tok.refresh_token ?? null, expiresAt },
    })

    return NextResponse.redirect(`${redirectBase}?spv_success=1`)
  } catch (e) {
    console.error("SPV callback error:", e)
    return NextResponse.redirect(`${redirectBase}?spv_error=server_error`)
  }
}
