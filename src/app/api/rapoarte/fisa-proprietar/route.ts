import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/mobile-auth";
import { db } from "@/lib/db";

function detaliiIncasare(pozitiiJson: string | null, avansJson: string | null): string {
  const parts: string[] = [];
  try {
    const poz = pozitiiJson ? JSON.parse(pozitiiJson) : [];
    if (Array.isArray(poz)) for (const p of poz) if (p?.denumire) parts.push(p.denumire);
  } catch { /* ignore */ }
  try {
    const av = avansJson ? JSON.parse(avansJson) : null;
    if (Array.isArray(av)) for (const a of av) if (a?.denumire) parts.push(a.denumire);
  } catch { /* ignore */ }
  return parts.join(", ");
}

// Fișă proprietar — extras pe apartament: solduri, încasări, liste de plată.
export async function GET(req: NextRequest) {
  const user = await getApiUser(req);
  const orgId = user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const asociatieId  = searchParams.get("asociatieId");
  const apartamentId = searchParams.get("apartamentId");
  const dataStart    = searchParams.get("dataStart");
  const dataEnd      = searchParams.get("dataEnd");
  if (!asociatieId || !apartamentId || !dataStart || !dataEnd)
    return NextResponse.json({ error: "Parametri lipsă" }, { status: 400 });

  const ap = await db.apartament.findFirst({
    where: { id: apartamentId, asociatieId, organizationId: orgId },
    select: {
      id: true, numar: true,
      proprietari: { where: { isMain: true }, include: { proprietar: { select: { nume: true, prenume: true, telefon: true, email: true } } }, take: 1 },
      solduri: { select: { restantaIntretinere: true, intretinereCurenta: true } },
      fonduri: { select: { restanta: true } },
    },
  });
  if (!ap) return NextResponse.json({ error: "Apartament negăsit" }, { status: 404 });

  const start = new Date(dataStart);
  const end   = new Date(dataEnd + "T23:59:59");

  const [incasari, listeAp] = await Promise.all([
    db.incasare.findMany({
      where:  { apartamentId, organizationId: orgId, data: { gte: start, lte: end } },
      orderBy: [{ data: "asc" }, { createdAt: "asc" }],
      select: { id: true, data: true, serie: true, numarDocument: true, sumaIncasata: true, tipPlata: true, pozitiiJson: true, avansJson: true },
    }),
    db.listaLunaApartament.findMany({
      where:  { apartamentId },
      select: { id: true, totalLuna: true, totalDePlata: true, achitat: true, rest: true, lista: { select: { luna: true, an: true } } },
    }),
  ]);

  const p = ap.proprietari[0]?.proprietar;
  const sold = ap.solduri[0];
  const restInt = (sold?.restantaIntretinere ?? 0) + (sold?.intretinereCurenta ?? 0);
  const restFond = ap.fonduri.reduce((s, f) => s + (f.restanta ?? 0), 0);
  const totalRestanta = restInt + restFond;

  const liste = listeAp
    .map(l => ({ id: l.id, luna: l.lista?.luna ?? 0, an: l.lista?.an ?? 0, totalLuna: l.totalLuna, totalDePlata: l.totalDePlata, achitat: l.achitat, rest: l.rest }))
    .sort((a, b) => a.an - b.an || a.luna - b.luna);

  const incasariRows = incasari.map(i => ({
    id: i.id, data: i.data.toISOString(), document: `${i.serie} ${i.numarDocument}`,
    tipPlata: i.tipPlata, suma: i.sumaIncasata, detalii: detaliiIncasare(i.pozitiiJson, i.avansJson),
    soldInainte: 0,
  }));
  let soldDupa = totalRestanta;
  for (let i = incasariRows.length - 1; i >= 0; i--) {
    const soldInainte = soldDupa + incasariRows[i].suma;
    incasariRows[i].soldInainte = soldInainte;
    soldDupa = soldInainte;
  }

  return NextResponse.json({
    proprietar: {
      nume:    p ? [p.prenume, p.nume].filter(Boolean).join(" ") : "",
      telefon: p?.telefon ?? null,
      email:   p?.email ?? null,
      numarAp: ap.numar,
    },
    restantaIntretinere: restInt,
    restantaFonduri:     restFond,
    totalRestanta,
    incasari: incasariRows,
    liste,
  });
}
