import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const asociatieId = searchParams.get("asociatieId");
  const luna        = searchParams.get("luna");
  const an          = searchParams.get("an");

  if (!asociatieId) return NextResponse.json({ error: "Parametri lipsă" }, { status: 400 });

  const where: Record<string, unknown> = { asociatieId, organizationId: orgId };
  if (luna && an) {
    const li = parseInt(luna);
    const ai = parseInt(an);
    where.data = { gte: new Date(ai, li - 1, 1), lt: new Date(ai, li, 1) };
  }

  const incasari = await db.incasare.findMany({
    where,
    orderBy: [{ data: "desc" }, { numarDocument: "desc" }],
  });

  return NextResponse.json(incasari.map(i => ({
    ...i,
    data:      i.data.toISOString(),
    createdAt: i.createdAt.toISOString(),
    pozitii:   i.pozitiiJson ? JSON.parse(i.pozitiiJson) : [],
    avans:     i.avansJson   ? JSON.parse(i.avansJson)   : null,
  })));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const body = await req.json();
  const { asociatieId, apartamentId, tipDocument, tipPlata, data, pozitii, avans, observatii } = body;

  if (!asociatieId || !apartamentId || !Array.isArray(pozitii) || pozitii.length === 0)
    return NextResponse.json({ error: "Date incomplete" }, { status: 400 });

  const asoc = await db.asociatie.findFirst({ where: { id: asociatieId, organizationId: orgId } });
  if (!asoc) return NextResponse.json({ error: "Asociație negăsită" }, { status: 404 });

  const ap = await db.apartament.findFirst({
    where: { id: apartamentId, asociatieId, organizationId: orgId },
    include: {
      proprietari: { where: { isMain: true }, include: { proprietar: { select: { nume: true, prenume: true } } }, take: 1 },
    },
  });
  if (!ap) return NextResponse.json({ error: "Apartament negăsit" }, { status: 404 });

  const proprietarNume = (() => {
    const p = ap.proprietari[0]?.proprietar;
    if (!p) return null;
    return [p.prenume, p.nume].filter(Boolean).join(" ") || p.nume;
  })();

  // Get/create document series
  let serieRec = await db.incasareSerie.findUnique({ where: { asociatieId } });
  if (!serieRec) {
    serieRec = await db.incasareSerie.create({
      data: { asociatieId, organizationId: orgId, serie: "CH", urmatorulNumar: 1 },
    });
  }
  const numarDocument = serieRec.urmatorulNumar;
  await db.incasareSerie.update({
    where: { asociatieId },
    data:  { urmatorulNumar: { increment: 1 } },
  });

  // Apply payments to solduri
  for (const p of pozitii as { tip: string; suma: number; fondId?: string }[]) {
    if (!p.suma || p.suma <= 0) continue;
    if (p.tip === "intretinere_curenta") {
      await db.soldApartament.updateMany({
        where: { apartamentId },
        data:  { intretinereCurenta: { decrement: p.suma } },
      });
    } else if (p.tip === "intretinere") {
      await db.soldApartament.updateMany({
        where: { apartamentId },
        data:  { restantaIntretinere: { decrement: p.suma } },
      });
    } else if (p.tip === "fond" && p.fondId) {
      await db.fondApartament.updateMany({
        where: { apartamentId, fondId: p.fondId },
        data:  { restanta: { decrement: p.suma } },
      });
    }
  }

  const totalSelectat  = pozitii.reduce((s: number, p: any) => s + (p.suma || 0), 0);
  const sumaIncasata   = totalSelectat + (avans?.suma || 0);

  const incasare = await db.incasare.create({
    data: {
      organizationId: orgId,
      asociatieId,
      apartamentId,
      nrApartament:   ap.numar,
      proprietarNume,
      serie:          serieRec.serie,
      numarDocument,
      tipDocument:    tipDocument || "chitanta",
      data:           data ? new Date(data) : new Date(),
      tipPlata:       tipPlata || "casa",
      sumaIncasata,
      totalSelectat,
      avansJson:      avans?.suma > 0 ? JSON.stringify(avans) : null,
      pozitiiJson:    JSON.stringify(pozitii),
      observatii:     observatii || null,
    },
  });

  return NextResponse.json({ incasare: { ...incasare, data: incasare.data.toISOString(), createdAt: incasare.createdAt.toISOString() } });
}
