import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Neautorizat" }, { status: 401 })

  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Lipsește id" }, { status: 400 })

  const token = await db.spvToken.findUnique({ where: { userId: session.user.id } })
  if (!token?.accessToken) return NextResponse.json({ error: "SPV neconectat" }, { status: 401 })

  const res = await fetch(
    `https://api.anaf.ro/prod/FCTEL/rest/descarcare?id=${encodeURIComponent(id)}`,
    { headers: { Authorization: `Bearer ${token.accessToken}`, Connection: "close" } }
  )

  if (!res.ok) {
    return NextResponse.json({ error: `ANAF ${res.status}` }, { status: 502 })
  }

  const buf = await res.arrayBuffer()
  return new NextResponse(buf, {
    headers: {
      "Content-Type":        "application/zip",
      "Content-Disposition": `attachment; filename="factura_${id}.zip"`,
    },
  })
}
