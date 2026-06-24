import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const orgId   = session?.user?.organizationId
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 })

  const { id } = await params
  const existing = await db.angajat.findFirst({ where: { id, organizationId: orgId } })
  if (!existing) return NextResponse.json({ error: "Angajat negăsit" }, { status: 404 })

  const body = await req.json()
  const { nume, prenume, cnp, functie, tipContract, dataAngajare, dataIncetare,
          salariuBrut, deducerePersonala, normaDeLucru, contBancar, banca,
          email, telefon, isActive } = body

  const angajat = await db.angajat.update({
    where: { id },
    data: {
      ...(nume              !== undefined && { nume }),
      ...(prenume           !== undefined && { prenume:           prenume || null }),
      ...(cnp               !== undefined && { cnp:               cnp || null }),
      ...(functie           !== undefined && { functie:           functie || null }),
      ...(tipContract       !== undefined && { tipContract }),
      ...(dataAngajare      !== undefined && { dataAngajare:      dataAngajare ? new Date(dataAngajare) : null }),
      ...(dataIncetare      !== undefined && { dataIncetare:      dataIncetare ? new Date(dataIncetare) : null }),
      ...(salariuBrut       !== undefined && { salariuBrut:       parseFloat(salariuBrut) || 0 }),
      ...(deducerePersonala !== undefined && { deducerePersonala: parseFloat(deducerePersonala) || 0 }),
      ...(normaDeLucru      !== undefined && { normaDeLucru:      parseFloat(normaDeLucru) || 8 }),
      ...(contBancar        !== undefined && { contBancar:        contBancar || null }),
      ...(banca             !== undefined && { banca:             banca || null }),
      ...(email             !== undefined && { email:             email || null }),
      ...(telefon           !== undefined && { telefon:           telefon || null }),
      ...(isActive          !== undefined && { isActive }),
    },
  })

  return NextResponse.json(angajat)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const orgId   = session?.user?.organizationId
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 })

  const { id } = await params
  const existing = await db.angajat.findFirst({ where: { id, organizationId: orgId } })
  if (!existing) return NextResponse.json({ error: "Angajat negăsit" }, { status: 404 })

  // Soft delete — păstrăm istoricul în state de plată
  await db.angajat.update({ where: { id }, data: { isActive: false } })

  return NextResponse.json({ success: true })
}
