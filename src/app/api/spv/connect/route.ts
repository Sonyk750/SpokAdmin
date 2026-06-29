import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const origin = new URL(req.url).origin

  try {
    const session = await auth()
    if (!session?.user?.id || !session.user.organizationId) {
      return NextResponse.redirect(`${origin}/login`)
    }

    const clientId    = process.env.SPV_CLIENT_ID
    const redirectUri = process.env.SPV_REDIRECT_URI
    const authUrl     = process.env.SPV_AUTH_URL
    const scope       = process.env.SPV_SCOPE || "efactura"

    if (!clientId || !redirectUri || !authUrl) {
      console.error("SPV env vars missing:", { clientId: !!clientId, redirectUri: !!redirectUri, authUrl: !!authUrl })
      return NextResponse.redirect(`${origin}/spv/conectare?spv_error=config_missing`)
    }

    const state = Buffer.from(JSON.stringify({
      userId:         session.user.id,
      organizationId: session.user.organizationId,
    })).toString("base64")

    const params = new URLSearchParams({
      response_type:      "code",
      client_id:          clientId,
      redirect_uri:       redirectUri,
      scope,
      state,
      token_content_type: "jwt",
    })

    return NextResponse.redirect(`${authUrl}?${params.toString()}`)
  } catch (e) {
    console.error("SPV connect error:", e)
    return NextResponse.redirect(`${origin}/spv/conectare?spv_error=server_error`)
  }
}
