import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(req: NextRequest) {
  const session = await auth()
  const orgId   = session?.user?.organizationId
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 })

  const angajatId = req.nextUrl.searchParams.get("angajatId")
  if (!angajatId) return NextResponse.json([], { status: 200 })

  const angajat = await db.angajat.findFirst({ where: { id: angajatId, organizationId: orgId } })
  if (!angajat) return NextResponse.json({ error: "Negăsit" }, { status: 404 })

  const list = await db.coasigurat.findMany({
    where:   { angajatId },
    orderBy: { nume: "asc" },
  })
  return NextResponse.json(list)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const orgId   = session?.user?.organizationId
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 })

  const { angajatId, nume, prenume, cnp, relatie } = await req.json()
  if (!angajatId || !nume) return NextResponse.json({ error: "angajatId și nume sunt obligatorii" }, { status: 400 })

  const angajat = await db.angajat.findFirst({ where: { id: angajatId, organizationId: orgId } })
  if (!angajat) return NextResponse.json({ error: "Angajat negăsit" }, { status: 404 })

  const c = await db.coasigurat.create({
    data: { angajatId, nume, prenume: prenume || null, cnp: cnp || null, relatie: relatie || null },
  })
  return NextResponse.json(c, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  const orgId   = session?.user?.organizationId
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 })

  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id lipsă" }, { status: 400 })

  const c = await db.coasigurat.findUnique({ where: { id }, include: { angajat: true } })
  if (!c || c.angajat.organizationId !== orgId) return NextResponse.json({ error: "Negăsit" }, { status: 404 })

  await db.coasigurat.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
