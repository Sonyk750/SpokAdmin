import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Contribuțiile către un fond dintr-o încasare (pozițiile cu tip "fond" + avans repartizat pe fond)
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

// Registru fonduri — mișcările unui fond: contribuții încasate + transferuri între fonduri.
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
  if (!asociatieId || !fondId || !dataStart || !dataEnd)
    return NextResponse.json({ error: "Parametri lipsă" }, { status: 400 });

  const fond = await db.fondAsociatie.findFirst({
    where:  { id: fondId, asociatieId, asociatie: { organizationId: orgId } },
    select: { id: true, name: true },
  });
  if (!fond) return NextResponse.json({ error: "Fond negăsit" }, { status: 404 });

  // Sold acumulat de bază (din inițializare) — punct de pornire
  const baseAgg = await db.fondApartament.aggregate({
    where: { asociatieId, fondId, ...(apartamentId ? { apartamentId } : {}) },
    _sum:  { sold: true },
  });
  const baseSold = baseAgg._sum.sold ?? 0;

  const start = new Date(dataStart);
  const end   = new Date(dataEnd + "T23:59:59");

  const incasariWhere = { asociatieId, organizationId: orgId, ...(apartamentId ? { apartamentId } : {}) };
  const [incasari, transferuri] = await Promise.all([
    db.incasare.findMany({
      where:  incasariWhere,
      select: { id: true, data: true, serie: true, numarDocument: true, nrApartament: true, proprietarNume: true, pozitiiJson: true, avansJson: true, createdAt: true },
    }),
    apartamentId ? Promise.resolve([]) : db.transferFond.findMany({
      where:  { asociatieId, organizationId: orgId, OR: [{ dinFondId: fondId }, { inFondId: fondId }] },
      select: { id: true, data: true, suma: true, dinFondId: true, dinFondName: true, inFondId: true, inFondName: true, notes: true, createdAt: true },
    }),
  ]);

  // Sold inițial la începutul perioadei = bază + contribuții + transferuri (înainte de start)
  let soldInitial = baseSold;
  for (const i of incasari) if (i.data < start) soldInitial += contribFond(i.pozitiiJson, i.avansJson, fondId);
  for (const t of transferuri) if (t.data < start) soldInitial += (t.inFondId === fondId ? t.suma : 0) - (t.dinFondId === fondId ? t.suma : 0);

  type Op = {
    id: string; data: string; fel: "contributie" | "transfer";
    document: string; detalii: string; intrare: number; iesire: number;
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
    fondName: fond.name,
    soldInitial,
    operatiuni: ops.map(({ _dataMs, _createdMs, ...o }) => o),
  });
}
