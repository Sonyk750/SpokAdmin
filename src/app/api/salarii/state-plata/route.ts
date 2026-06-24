import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { calculeazaSalariu, zileLucratoareDefault } from "@/lib/calcul-salariu"

export async function GET(req: NextRequest) {
  const session = await auth()
  const orgId   = session?.user?.organizationId
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 })

  const sp          = req.nextUrl.searchParams
  const asociatieId = sp.get("asociatieId") ?? undefined
  const luna        = sp.get("luna")  ? parseInt(sp.get("luna")!)  : undefined
  const an          = sp.get("an")    ? parseInt(sp.get("an")!)    : undefined

  const liste = await db.statPlata.findMany({
    where: {
      organizationId: orgId,
      ...(asociatieId && { asociatieId }),
      ...(luna        && { luna }),
      ...(an          && { an }),
    },
    include: { randuri: { include: { angajat: { select: { id: true, nume: true, prenume: true, functie: true } } } } },
    orderBy: [{ an: "desc" }, { luna: "desc" }],
  })

  return NextResponse.json(liste)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const orgId   = session?.user?.organizationId
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 })

  const body = await req.json()
  const { asociatieId, luna, an } = body

  if (!asociatieId || !luna || !an) {
    return NextResponse.json({ error: "Câmpuri obligatorii lipsă" }, { status: 400 })
  }

  const asoc = await db.asociatie.findFirst({ where: { id: asociatieId, organizationId: orgId } })
  if (!asoc) return NextResponse.json({ error: "Asociație negăsită" }, { status: 404 })

  const existing = await db.statPlata.findUnique({ where: { asociatieId_luna_an: { asociatieId, luna, an } } })
  if (existing) return NextResponse.json({ error: `Există deja un stat pentru ${luna}/${an}` }, { status: 409 })

  const angajati = await db.angajat.findMany({
    where: { asociatieId, organizationId: orgId, isActive: true },
  })

  if (angajati.length === 0) {
    return NextResponse.json({ error: "Nu există angajați activi pentru această asociație" }, { status: 400 })
  }

  const zileDefault = zileLucratoareDefault(luna, an)

  const randuri = angajati.map(a => {
    const rez = calculeazaSalariu({
      salariuBrut:        a.salariuBrut,
      zileLucratoareLuna: zileDefault,
      zileLucrate:        zileDefault,
      oreSupliment:       0,
      deducere:           a.deducerePersonala,
      altRetineri:        0,
      normaDeLucru:       a.normaDeLucru,
    })
    return {
      angajatId:    a.id,
      zileLucrate:  zileDefault,
      zileLibere:   0,
      oreSupliment: 0,
      salariuBrut:  rez.salariuBrut,
      deducere:     a.deducerePersonala,
      cas:          rez.cas,
      cass:         rez.cass,
      impozit:      rez.impozit,
      altRetineri:  0,
      cam:          rez.cam,
      salariuNet:   rez.salariuNet,
    }
  })

  const totalBrut    = randuri.reduce((s, r) => s + r.salariuBrut, 0)
  const totalNet     = randuri.reduce((s, r) => s + r.salariuNet,  0)
  const totalCas     = randuri.reduce((s, r) => s + r.cas,         0)
  const totalCass    = randuri.reduce((s, r) => s + r.cass,        0)
  const totalImpozit = randuri.reduce((s, r) => s + r.impozit,     0)
  const totalCam     = randuri.reduce((s, r) => s + r.cam,         0)

  const stat = await db.statPlata.create({
    data: {
      organizationId: orgId,
      asociatieId,
      luna,
      an,
      totalBrut:    Math.round(totalBrut    * 100) / 100,
      totalNet:     Math.round(totalNet     * 100) / 100,
      totalCas:     Math.round(totalCas     * 100) / 100,
      totalCass:    Math.round(totalCass    * 100) / 100,
      totalImpozit: Math.round(totalImpozit * 100) / 100,
      totalCam:     Math.round(totalCam     * 100) / 100,
      randuri: { create: randuri },
    },
    include: { randuri: { include: { angajat: { select: { id: true, nume: true, prenume: true, functie: true } } } } },
  })

  return NextResponse.json(stat, { status: 201 })
}
