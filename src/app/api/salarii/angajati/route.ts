import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(req: NextRequest) {
  const session = await auth()
  const orgId   = session?.user?.organizationId
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 })

  const sp          = req.nextUrl.searchParams
  const asociatieId = sp.get("asociatieId") ?? undefined
  const includeInactive = sp.get("all") === "true"

  const angajati = await db.angajat.findMany({
    where: {
      organizationId: orgId,
      ...(asociatieId      && { asociatieId }),
      ...(includeInactive  ? {} : { isActive: true }),
    },
    orderBy: [{ nume: "asc" }, { prenume: "asc" }],
  })

  return NextResponse.json(angajati)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const orgId   = session?.user?.organizationId
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 })

  const body = await req.json()
  const { asociatieId, nume, prenume, cnp, functie, tipContract,
          dataAngajare, salariuBrut, deducerePersonala, normaDeLucru,
          contBancar, banca, email, telefon } = body

  if (!asociatieId || !nume) {
    return NextResponse.json({ error: "Câmpuri obligatorii lipsă (asociatieId, nume)" }, { status: 400 })
  }

  const asoc = await db.asociatie.findFirst({ where: { id: asociatieId, organizationId: orgId } })
  if (!asoc) return NextResponse.json({ error: "Asociație negăsită" }, { status: 404 })

  const angajat = await db.angajat.create({
    data: {
      organizationId:    orgId,
      asociatieId,
      nume,
      prenume:           prenume          || null,
      cnp:               cnp              || null,
      functie:           functie          || null,
      tipContract:       tipContract      || "CIM",
      dataAngajare:      dataAngajare     ? new Date(dataAngajare) : null,
      salariuBrut:       parseFloat(salariuBrut)        || 0,
      deducerePersonala: parseFloat(deducerePersonala)  || 0,
      normaDeLucru:      parseFloat(normaDeLucru)       || 8,
      contBancar:        contBancar       || null,
      banca:             banca            || null,
      email:             email            || null,
      telefon:           telefon          || null,
    },
  })

  return NextResponse.json(angajat, { status: 201 })
}
