import { NextRequest, NextResponse } from "next/server"
import { createHmac } from "crypto"
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

    const payload = JSON.stringify({ userId: session.user.id, organizationId: session.user.organizationId, ts: Date.now() })
    const sig     = createHmac("sha256", process.env.AUTH_SECRET!).update(payload).digest("hex")
    const state   = Buffer.from(JSON.stringify({ payload, sig })).toString("base64")

    const params = new URLSearchParams({
      response_type:      "code",
      client_id:          clientId,
      redirect_uri:       redirectUri,
      scope,
      state,
      token_content_type: "jwt",
    })

    const finalUrl = `${authUrl}?${params.toString()}`
    console.log("SPV connect → redirect_uri:", redirectUri, "auth_url:", authUrl)
    return NextResponse.redirect(finalUrl)
  } catch (e) {
    console.error("SPV connect error:", e)
    return NextResponse.redirect(`${origin}/spv/conectare?spv_error=server_error`)
  }
}
