import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/mobile-auth";
import { db } from "@/lib/db";
import { resolveAccess } from "@/lib/access";

export async function GET(req: NextRequest) {
  const user = await getApiUser(req);
  const orgId = user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const asociatieId = searchParams.get("asociatieId");
  const luna        = searchParams.get("luna");
  const an          = searchParams.get("an");

  if (!asociatieId) return NextResponse.json({ error: "Parametri lipsă" }, { status: 400 });

  const access = await resolveAccess(user, asociatieId);

  const dataStart = searchParams.get("dataStart");
  const dataEnd   = searchParams.get("dataEnd");

  const where: Record<string, unknown> = { asociatieId, organizationId: orgId };
  // Userii restricționați (ex. casier) văd doar chitanțele emise de ei.
  if (!access.isAdmin) where.createdById = user!.id;
  if (dataStart || dataEnd) {
    where.data = {
      ...(dataStart ? { gte: new Date(dataStart) } : {}),
      ...(dataEnd   ? { lte: new Date(dataEnd + "T23:59:59") } : {}),
    };
  } else if (luna && an) {
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
  const user = await getApiUser(req);
  const orgId = user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const body = await req.json();
  const { asociatieId, apartamentId, tipDocument, tipPlata, data, pozitii, avansRepartizat, observatii, serieOverride, nrDocManual } = body;

  if (!asociatieId || !apartamentId || !Array.isArray(pozitii) || pozitii.length === 0)
    return NextResponse.json({ error: "Date incomplete" }, { status: 400 });

  const access = await resolveAccess(user, asociatieId);
  if (!access.isAdmin && !access.perms.chit_add)
    return NextResponse.json({ error: "Nu ai dreptul să emiți chitanțe" }, { status: 403 });
  // Userii restricționați pot emite doar prin casă.
  const tipPlataEff = access.isAdmin ? (tipPlata || "casa") : "casa";

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

  // Numărul de chitanță se atribuie DOAR pentru plăți prin casă
  let serie: string | null = null;
  let numarDocument: number | null = null;

  if (tipPlataEff === "casa") {
    let serieRec = await db.incasareSerie.findUnique({ where: { asociatieId } });
    if (!serieRec) {
      serieRec = await db.incasareSerie.create({
        data: { asociatieId, organizationId: orgId, serie: "CH", urmatorulNumar: 1 },
      });
    }
    serie = serieOverride || serieRec.serie;
    numarDocument = nrDocManual || serieRec.urmatorulNumar;
    if (!nrDocManual) {
      await db.incasareSerie.update({
        where: { asociatieId },
        data:  { urmatorulNumar: { increment: 1 } },
      });
    }
  }

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

  // Apply avans repartition to solduri
  const avansItems: { tip: string; fondId?: string; denumire: string; suma: number }[] =
    Array.isArray(avansRepartizat) ? avansRepartizat : [];

  for (const a of avansItems) {
    if (!a.suma || a.suma <= 0) continue;
    if (a.tip === "intretinere") {
      await db.soldApartament.upsert({
        where:  { apartamentId },
        update: { intretinereCurenta: { decrement: a.suma } },
        create: { apartamentId, asociatieId, intretinereCurenta: -a.suma, restantaIntretinere: 0 },
      });
    } else if (a.tip === "fond" && a.fondId) {
      await db.fondApartament.updateMany({
        where: { apartamentId, fondId: a.fondId },
        data:  { restanta: { decrement: a.suma } },
      });
    }
  }

  const totalSelectat = pozitii.reduce((s: number, p: any) => s + (p.suma || 0), 0);
  const totalAvans    = avansItems.reduce((s, a) => s + a.suma, 0);
  const sumaIncasata  = totalSelectat + totalAvans;

  const incasare = await db.incasare.create({
    data: {
      organizationId: orgId,
      asociatieId,
      apartamentId,
      nrApartament:   ap.numar,
      proprietarNume,
      serie,
      numarDocument,
      tipDocument:    tipDocument || "chitanta",
      data:           data ? new Date(data) : new Date(),
      tipPlata:       tipPlataEff,
      sumaIncasata,
      totalSelectat,
      avansJson:      avansItems.length > 0 ? JSON.stringify(avansItems) : null,
      pozitiiJson:    JSON.stringify(pozitii),
      observatii:     observatii || null,
      createdById:    user!.id,
    },
  });

  return NextResponse.json({ incasare: { ...incasare, data: incasare.data.toISOString(), createdAt: incasare.createdAt.toISOString() } });
}
