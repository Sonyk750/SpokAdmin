import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { calculeazaSalariu } from "@/lib/calcul-salariu"

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  const orgId   = session?.user?.organizationId
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 })

  const { id } = await params
  const stat = await db.statPlata.findFirst({
    where: { id, organizationId: orgId },
    include: {
      randuri: {
        include: { angajat: { select: { id: true, nume: true, prenume: true, functie: true, contBancar: true, banca: true } } },
        orderBy: { angajat: { nume: "asc" } },
      },
    },
  })

  if (!stat) return NextResponse.json({ error: "Stat negăsit" }, { status: 404 })
  return NextResponse.json(stat)
}

// Actualizare rând individual (zileLucrate, oreSupliment, altRetineri) + recalcul
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  const orgId   = session?.user?.organizationId
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 })

  const { id } = await params
  const stat = await db.statPlata.findFirst({
    where: { id, organizationId: orgId },
    include: { randuri: { include: { angajat: true } } },
  })
  if (!stat) return NextResponse.json({ error: "Stat negăsit" }, { status: 404 })
  if (stat.status !== "draft") return NextResponse.json({ error: "Statul nu mai poate fi modificat" }, { status: 400 })

  const body = await req.json()

  // body.randuri: [{ id, zileLucrate, zileLibere, oreSupliment, altRetineri, zileLucratoareLuna }]
  if (Array.isArray(body.randuri)) {
    for (const upd of body.randuri) {
      const rand = stat.randuri.find(r => r.id === upd.id)
      if (!rand) continue

      const rez = calculeazaSalariu({
        salariuBrut:        rand.angajat.salariuBrut,
        zileLucratoareLuna: upd.zileLucratoareLuna ?? 22,
        zileLucrate:        upd.zileLucrate        ?? rand.zileLucrate,
        oreSupliment:       upd.oreSupliment       ?? rand.oreSupliment,
        deducere:           rand.deducere,
        altRetineri:        upd.altRetineri         ?? rand.altRetineri,
        normaDeLucru:       rand.angajat.normaDeLucru,
      })

      await db.statPlataRand.update({
        where: { id: rand.id },
        data: {
          zileLucrate:  upd.zileLucrate  ?? rand.zileLucrate,
          zileLibere:   upd.zileLibere   ?? rand.zileLibere,
          oreSupliment: upd.oreSupliment ?? rand.oreSupliment,
          altRetineri:  upd.altRetineri  ?? rand.altRetineri,
          salariuBrut:  rez.salariuBrut,
          cas:          rez.cas,
          cass:         rez.cass,
          impozit:      rez.impozit,
          cam:          rez.cam,
          salariuNet:   rez.salariuNet,
        },
      })
    }
  }

  // Actualizare status (draft → semnat → platit)
  if (body.status && ["draft", "semnat", "platit"].includes(body.status)) {
    await db.statPlata.update({ where: { id }, data: { status: body.status } })
  }

  // Recalcul totaluri
  const randuriActualizate = await db.statPlataRand.findMany({ where: { statPlataId: id } })
  const r2 = (v: number) => Math.round(v * 100) / 100

  const updated = await db.statPlata.update({
    where: { id },
    data: {
      totalBrut:    r2(randuriActualizate.reduce((s, r) => s + r.salariuBrut, 0)),
      totalNet:     r2(randuriActualizate.reduce((s, r) => s + r.salariuNet,  0)),
      totalCas:     r2(randuriActualizate.reduce((s, r) => s + r.cas,         0)),
      totalCass:    r2(randuriActualizate.reduce((s, r) => s + r.cass,        0)),
      totalImpozit: r2(randuriActualizate.reduce((s, r) => s + r.impozit,     0)),
      totalCam:     r2(randuriActualizate.reduce((s, r) => s + r.cam,         0)),
    },
    include: {
      randuri: {
        include: { angajat: { select: { id: true, nume: true, prenume: true, functie: true, contBancar: true, banca: true } } },
        orderBy: { angajat: { nume: "asc" } },
      },
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  const orgId   = session?.user?.organizationId
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 })

  const { id } = await params
  const stat = await db.statPlata.findFirst({ where: { id, organizationId: orgId } })
  if (!stat) return NextResponse.json({ error: "Stat negăsit" }, { status: 404 })
  if (stat.status !== "draft") return NextResponse.json({ error: "Doar statul în draft poate fi șters" }, { status: 400 })

  await db.statPlata.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
