import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

function contribFond(pozitiiJson: string | null, avansJson: string | null, fondId: string): number {
  let sum = 0;
  try {
    const poz = pozitiiJson ? JSON.parse(pozitiiJson) : [];
    if (Array.isArray(poz)) for (const p of poz) if (p?.tip === "fond" && p?.fondId === fondId) sum += Number(p.suma) || 0;
  } catch { /* ignore */ }
  try {
    const av = avansJson ? JSON.parse(avansJson) : null;
    if (Array.isArray(av)) for (const a of av) if (a?.tip === "fond" && a?.fondId === fondId) sum += Number(a.suma) || 0;
  } catch { /* ignore */ }
  return sum;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const asociatieId  = searchParams.get("asociatieId");
  const fondId       = searchParams.get("fondId");
  const dataStart    = searchParams.get("dataStart");
  const dataEnd      = searchParams.get("dataEnd");
  const apartamentId = searchParams.get("apartamentId") || null;
  const detaliat     = searchParams.get("detaliat") === "true";

  if (!asociatieId || !fondId || !dataStart || !dataEnd)
    return NextResponse.json({ error: "Parametri lipsă" }, { status: 400 });

  const fond = await db.fondAsociatie.findFirst({
    where:  { id: fondId, asociatieId, asociatie: { organizationId: orgId } },
    select: { id: true, name: true },
  });
  if (!fond) return NextResponse.json({ error: "Fond negăsit" }, { status: 404 });

  const start = new Date(dataStart);
  const end   = new Date(dataEnd + "T23:59:59");

  // ── Mod DETALIAT: sumar per apartament (sold + restanță + contribuții) ───
  if (detaliat) {
    const [apartamente, incasariPerioad] = await Promise.all([
      db.apartament.findMany({
        where:   { asociatieId, organizationId: orgId, isActive: true },
        orderBy: { numar: "asc" },
        select: {
          id: true, numar: true, scara: true,
          proprietari: {
            where:   { isMain: true },
            include: { proprietar: { select: { nume: true, prenume: true } } },
            take:    1,
          },
          fonduri: { where: { fondId } },
        },
      }),
      db.incasare.findMany({
        where:  { asociatieId, organizationId: orgId, data: { gte: start, lte: end } },
        select: { apartamentId: true, pozitiiJson: true, avansJson: true },
      }),
    ]);

    const contribMap = new Map<string, number>();
    for (const i of incasariPerioad) {
      const c = contribFond(i.pozitiiJson, i.avansJson, fondId);
      if (c > 0) contribMap.set(i.apartamentId, (contribMap.get(i.apartamentId) ?? 0) + c);
    }

    return NextResponse.json({
      fondName: fond.name,
      detaliat: apartamente.map(a => {
        const fa   = a.fonduri[0];
        const prop = a.proprietari[0]?.proprietar;
        return {
          apartamentId:       a.id,
          numar:              a.numar,
          scara:              a.scara,
          proprietar:         prop ? `${prop.nume} ${prop.prenume}` : "",
          sold:               fa?.sold     ?? 0,
          restanta:           fa?.restanta ?? 0,
          contributiiPerioda: contribMap.get(a.id) ?? 0,
        };
      }),
    });
  }

  // ── Mod NORMAL sau per APARTAMENT ────────────────────────────────────────
  const baseAgg = await db.fondApartament.aggregate({
    where: { asociatieId, fondId, ...(apartamentId ? { apartamentId } : {}) },
    _sum:  { sold: true },
  });
  const baseSold = baseAgg._sum.sold ?? 0;

  const incasariWhere = { asociatieId, organizationId: orgId, ...(apartamentId ? { apartamentId } : {}) };
  const [incasari, transferuri, fondAp] = await Promise.all([
    db.incasare.findMany({
      where:  incasariWhere,
      select: { id: true, apartamentId: true, data: true, serie: true, numarDocument: true, nrApartament: true, proprietarNume: true, pozitiiJson: true, avansJson: true, createdAt: true },
    }),
    apartamentId ? Promise.resolve([]) : db.transferFond.findMany({
      where:  { asociatieId, organizationId: orgId, OR: [{ dinFondId: fondId }, { inFondId: fondId }] },
      select: { id: true, data: true, suma: true, dinFondId: true, dinFondName: true, inFondId: true, inFondName: true, notes: true, createdAt: true },
    }),
    apartamentId ? db.fondApartament.findFirst({
      where:  { apartamentId, fondId, asociatieId },
      select: { sold: true, restanta: true },
    }) : Promise.resolve(null),
  ]);

  let soldInitial = baseSold;
  for (const i of incasari) if (i.data < start) soldInitial += contribFond(i.pozitiiJson, i.avansJson, fondId);
  for (const t of transferuri) if (t.data < start) soldInitial += (t.inFondId === fondId ? t.suma : 0) - (t.dinFondId === fondId ? t.suma : 0);

  type Op = {
    id: string; data: string; fel: "contributie" | "transfer";
    document: string; detalii: string; intrare: number; iesire: number;
    apartamentId?: string; nrApartament?: string;
    _dataMs: number; _createdMs: number;
  };
  const ops: Op[] = [];

  for (const i of incasari) {
    if (i.data < start || i.data > end) continue;
    const c = contribFond(i.pozitiiJson, i.avansJson, fondId);
    if (c <= 0) continue;
    ops.push({
      id: i.id, data: i.data.toISOString(), fel: "contributie",
      document: `${i.serie} ${i.numarDocument}`,
      detalii:  `Ap. ${i.nrApartament}${i.proprietarNume ? " — " + i.proprietarNume : ""}`,
      intrare: c, iesire: 0,
      apartamentId: i.apartamentId, nrApartament: i.nrApartament,
      _dataMs: i.data.getTime(), _createdMs: i.createdAt.getTime(),
    });
  }
  for (const t of transferuri) {
    if (t.data < start || t.data > end) continue;
    const inThis = t.inFondId === fondId;
    ops.push({
      id: t.id, data: t.data.toISOString(), fel: "transfer",
      document: "Transfer",
      detalii:  inThis ? `Din ${t.dinFondName}${t.notes ? " — " + t.notes : ""}` : `Către ${t.inFondName}${t.notes ? " — " + t.notes : ""}`,
      intrare: inThis ? t.suma : 0,
      iesire:  inThis ? 0 : t.suma,
      _dataMs: t.data.getTime(), _createdMs: t.createdAt.getTime(),
    });
  }

  ops.sort((a, b) => a._dataMs - b._dataMs || a._createdMs - b._createdMs);

  return NextResponse.json({
    fondName:   fond.name,
    soldInitial,
    soldAp:     fondAp?.sold     ?? null,
    restantaAp: fondAp?.restanta ?? null,
    operatiuni: ops.map(({ _dataMs, _createdMs, ...o }) => o),
  });
}
