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
      ...(asociatieId     && { asociatieId }),
      ...(includeInactive ? {} : { isActive: true }),
    },
    include: {
      persoaneIntretinere: true,
      coasigurati:         true,
    },
    orderBy: [{ nume: "asc" }, { prenume: "asc" }],
  })

  return NextResponse.json(angajati)
}

function parseAngajat(body: any, orgId?: string) {
  return {
    ...(orgId && { organizationId: orgId }),
    nume:                 body.nume              || undefined,
    prenume:              body.prenume           || null,
    cnp:                  body.cnp               || null,
    adresa:               body.adresa            || null,
    judet:                body.judet             || null,
    mentiuni:             body.mentiuni          || null,
    tipContract:          body.tipContract       || "CIM",
    functie:              body.functie           || null,
    detaliiFunctie:       body.detaliiFunctie    || null,
    nivelStudii:          body.nivelStudii       || null,
    nrContract:           body.nrContract        || null,
    normaDeLucru:         body.normaDeLucru      != null ? parseFloat(body.normaDeLucru) : undefined,
    dataAngajare:         body.dataAngajare      ? new Date(body.dataAngajare)      : null,
    dataIntrareVigoare:   body.dataIntrareVigoare ? new Date(body.dataIntrareVigoare) : null,
    dataIncetare:         body.dataIncetare      ? new Date(body.dataIncetare)      : null,
    modIncetare:          body.modIncetare       || null,
    salariuBrut:          body.salariuBrut       != null ? parseFloat(body.salariuBrut)       : undefined,
    bonuriMasa:           body.bonuriMasa        != null ? parseFloat(body.bonuriMasa)        : undefined,
    deducerePersonala:    body.deducerePersonala != null ? parseFloat(body.deducerePersonala) : undefined,
    functiaDeBase:        body.functiaDeBase     != null ? Boolean(body.functiaDeBase)     : undefined,
    cassCasMinimEconomie: body.cassCasMinimEconomie != null ? Boolean(body.cassCasMinimEconomie) : undefined,
    singurulVenit:        body.singurulVenit     != null ? Boolean(body.singurulVenit)     : undefined,
    pensionar:            body.pensionar         != null ? Boolean(body.pensionar)         : undefined,
    invaliditate:         body.invaliditate      || undefined,
    gradHandicap:         body.gradHandicap      || undefined,
    platesteCASS:         body.platesteCASS      != null ? Boolean(body.platesteCASS)      : undefined,
    cassMinimEconomie:    body.cassMinimEconomie != null ? Boolean(body.cassMinimEconomie) : undefined,
    platestePensie:       body.platestePensie    != null ? Boolean(body.platestePensie)    : undefined,
    platesteImpozit:      body.platesteImpozit   != null ? Boolean(body.platesteImpozit)   : undefined,
    impozitBazaBrut:      body.impozitBazaBrut   != null ? Boolean(body.impozitBazaBrut)   : undefined,
    asocSanatate:         body.asocSanatate      != null ? Boolean(body.asocSanatate)      : undefined,
    asocSomaj:            body.asocSomaj         != null ? Boolean(body.asocSomaj)         : undefined,
    asocPensie:           body.asocPensie        != null ? Boolean(body.asocPensie)        : undefined,
    asocConcedii:         body.asocConcedii      != null ? Boolean(body.asocConcedii)      : undefined,
    asocFondRisc:         body.asocFondRisc      != null ? Boolean(body.asocFondRisc)      : undefined,
    asocCAM:              body.asocCAM           != null ? Boolean(body.asocCAM)           : undefined,
    contBancar:           body.contBancar        || null,
    banca:                body.banca             || null,
    email:                body.email             || null,
    telefon:              body.telefon           || null,
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const orgId   = session?.user?.organizationId
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 })

  const body = await req.json()
  const { asociatieId } = body

  if (!asociatieId || !body.nume) {
    return NextResponse.json({ error: "Câmpuri obligatorii lipsă (asociatieId, nume)" }, { status: 400 })
  }

  const asoc = await db.asociatie.findFirst({ where: { id: asociatieId, organizationId: orgId } })
  if (!asoc) return NextResponse.json({ error: "Asociație negăsită" }, { status: 404 })

  const angajat = await db.angajat.create({
    data: { asociatieId, ...parseAngajat(body, orgId) } as any,
  })

  return NextResponse.json(angajat, { status: 201 })
}
