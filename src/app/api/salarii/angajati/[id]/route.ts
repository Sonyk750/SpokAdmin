import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

function parseFields(body: any) {
  const d: any = {}
  const str  = (v: any) => (v !== undefined ? (v || null) : undefined)
  const bool = (v: any) => (v !== undefined ? Boolean(v) : undefined)
  const num  = (v: any, def: number) => (v !== undefined ? parseFloat(v) || def : undefined)
  const dt   = (v: any) => (v !== undefined ? (v ? new Date(v) : null) : undefined)

  const map: Record<string, () => any> = {
    nome:                () => body.nume,
    prenume:             () => str(body.prenume),
    cnp:                 () => str(body.cnp),
    adresa:              () => str(body.adresa),
    judet:               () => str(body.judet),
    mentiuni:            () => str(body.mentiuni),
    tipContract:         () => body.tipContract,
    functie:             () => str(body.functie),
    detaliiFunctie:      () => str(body.detaliiFunctie),
    nivelStudii:         () => str(body.nivelStudii),
    nrContract:          () => str(body.nrContract),
    normaDeLucru:        () => num(body.normaDeLucru, 8),
    dataAngajare:        () => dt(body.dataAngajare),
    dataIntrareVigoare:  () => dt(body.dataIntrareVigoare),
    dataIncetare:        () => dt(body.dataIncetare),
    modIncetare:         () => str(body.modIncetare),
    salariuBrut:         () => num(body.salariuBrut, 0),
    bonuriMasa:          () => num(body.bonuriMasa, 0),
    deducerePersonala:   () => num(body.deducerePersonala, 0),
    functiaDeBase:       () => bool(body.functiaDeBase),
    cassCasMinimEconomie:() => bool(body.cassCasMinimEconomie),
    singurulVenit:       () => bool(body.singurulVenit),
    pensionar:           () => bool(body.pensionar),
    invaliditate:        () => body.invaliditate,
    gradHandicap:        () => body.gradHandicap,
    platesteCASS:        () => bool(body.platesteCASS),
    cassMinimEconomie:   () => bool(body.cassMinimEconomie),
    platestePensie:      () => bool(body.platestePensie),
    platesteImpozit:     () => bool(body.platesteImpozit),
    impozitBazaBrut:     () => bool(body.impozitBazaBrut),
    asocSanatate:        () => bool(body.asocSanatate),
    asocSomaj:           () => bool(body.asocSomaj),
    asocPensie:          () => bool(body.asocPensie),
    asocConcedii:        () => bool(body.asocConcedii),
    asocFondRisc:        () => bool(body.asocFondRisc),
    asocCAM:             () => bool(body.asocCAM),
    contBancar:          () => str(body.contBancar),
    banca:               () => str(body.banca),
    email:               () => str(body.email),
    telefon:             () => str(body.telefon),
    isActive:            () => bool(body.isActive),
  }

  for (const [key, fn] of Object.entries(map)) {
    const realKey = key === "nome" ? "nume" : key
    const val = fn()
    if (val !== undefined) d[realKey] = val
  }
  return d
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const orgId   = session?.user?.organizationId
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 })

  const { id } = await params
  const existing = await db.angajat.findFirst({ where: { id, organizationId: orgId } })
  if (!existing) return NextResponse.json({ error: "Angajat negăsit" }, { status: 404 })

  const body = await req.json()
  const data = parseFields(body)

  const angajat = await db.angajat.update({ where: { id }, data })
  return NextResponse.json(angajat)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const orgId   = session?.user?.organizationId
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 })

  const { id } = await params
  const existing = await db.angajat.findFirst({ where: { id, organizationId: orgId } })
  if (!existing) return NextResponse.json({ error: "Angajat negăsit" }, { status: 404 })

  await db.angajat.update({ where: { id }, data: { isActive: false } })
  return NextResponse.json({ success: true })
}
