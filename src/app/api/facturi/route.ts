import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { computeAcoperit, consumaAvansPeFactura } from "@/lib/avans-furnizor";

const r2 = (v: number) => Math.round(v * 100) / 100;

export async function GET(req: NextRequest) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const sp          = req.nextUrl.searchParams;
  const asociatieId = sp.get("asociatieId") ?? undefined;
  const status      = sp.get("status")      ?? undefined;
  const luna        = sp.get("luna")  ? parseInt(sp.get("luna")!)  : undefined;
  const an          = sp.get("an")    ? parseInt(sp.get("an")!)    : undefined;

  const facturi = await db.factura.findMany({
    where: {
      organizationId: orgId,
      ...(asociatieId && { asociatieId }),
      ...(status      && { status }),
      ...(luna        && { luna }),
      ...(an          && { an }),
    },
    include: {
      furnizor:     { select: { id: true, nume: true } },
      asociatie:    { select: { id: true, name: true } },
      plati:        { select: { suma: true } },
      avansMiscari: { select: { suma: true } },
    },
    orderBy: [{ an: "desc" }, { luna: "desc" }, { createdAt: "desc" }],
  });

  // Atașează acoperit/rest calculat (plăți numerar − mișcări avans).
  const withRest = facturi.map(f => {
    const acoperit = computeAcoperit(f.plati, f.avansMiscari);
    return { ...f, acoperit, rest: r2(f.valoare - acoperit) };
  });

  return NextResponse.json(withRest);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const body = await req.json() as {
    asociatieId:  string;
    furnizorId?:  string;
    furnizorNume?: string;
    serie?:        string;
    numar?:        string;
    valoare:       number;
    tva?:          number;
    dataEmiterii?: string;
    dataScadenta?: string;
    luna?:         number;
    an?:           number;
    categorie?:    string;
    notes?:        string;
  };

  if (!body.asociatieId) return NextResponse.json({ error: "Asociația este obligatorie." }, { status: 400 });
  if (!body.valoare || body.valoare <= 0) return NextResponse.json({ error: "Valoarea trebuie să fie pozitivă." }, { status: 400 });

  // Verify asociatie belongs to org
  const asociatie = await db.asociatie.findFirst({
    where: { id: body.asociatieId, organizationId: orgId },
    select: { id: true },
  });
  if (!asociatie) return NextResponse.json({ error: "Asociație invalidă." }, { status: 400 });

  // Resolve furnizor: use existing id, or create by name
  let furnizorId = body.furnizorId ?? null;
  if (!furnizorId && body.furnizorNume?.trim()) {
    const existing = await db.furnizor.findFirst({
      where: { organizationId: orgId, nume: body.furnizorNume.trim() },
      select: { id: true },
    });
    if (existing) {
      furnizorId = existing.id;
    } else {
      const nou = await db.furnizor.create({
        data: { organizationId: orgId, nume: body.furnizorNume.trim() },
        select: { id: true },
      });
      furnizorId = nou.id;
    }
  }

  const { factura, avansAplicat } = await db.$transaction(async (tx) => {
    const created = await tx.factura.create({
      data: {
        organizationId: orgId,
        asociatieId:    body.asociatieId,
        furnizorId:     furnizorId,
        serie:          body.serie?.trim()  || null,
        numar:          body.numar?.trim()  || null,
        valoare:        body.valoare,
        tva:            body.tva ?? 0,
        dataEmiterii:   body.dataEmiterii ? new Date(body.dataEmiterii) : null,
        dataScadenta:   body.dataScadenta ? new Date(body.dataScadenta) : null,
        luna:           body.luna ?? null,
        an:             body.an   ?? null,
        categorie:      body.categorie || null,
        notes:          body.notes?.trim() || null,
      },
      select: { id: true, organizationId: true, asociatieId: true, furnizorId: true },
    });

    // Consumă automat avansul disponibil la acest furnizor.
    const aplicat = await consumaAvansPeFactura(tx, created);

    const full = await tx.factura.findUnique({
      where: { id: created.id },
      include: {
        furnizor:     { select: { id: true, nume: true } },
        asociatie:    { select: { id: true, name: true } },
        plati:        { select: { suma: true } },
        avansMiscari: { select: { suma: true } },
      },
    });
    return { factura: full!, avansAplicat: aplicat };
  });

  const acoperit = computeAcoperit(factura.plati, factura.avansMiscari);
  return NextResponse.json(
    { ...factura, acoperit, rest: r2(factura.valoare - acoperit), avansAplicat },
    { status: 201 },
  );
}
