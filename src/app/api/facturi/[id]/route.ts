import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { recomputeFacturaStatus } from "@/lib/avans-furnizor";

const r2 = (v: number) => Math.round(v * 100) / 100;
const EPS = 0.01;

async function getFactura(id: string, orgId: string) {
  return db.factura.findFirst({ where: { id, organizationId: orgId } });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { id } = await params;
  const factura = await getFactura(id, orgId);
  if (!factura) return NextResponse.json({ error: "Factură negăsită." }, { status: 404 });

  const body = await req.json() as {
    furnizorId?:   string | null;
    furnizorNume?: string;
    serie?:        string;
    numar?:        string;
    valoare?:      number;
    tva?:          number;
    dataEmiterii?: string | null;
    dataScadenta?: string | null;
    luna?:         number | null;
    an?:           number | null;
    categorie?:    string | null;
    notes?:        string | null;
    status?:       string;
  };

  // Resolve furnizor by name if needed
  let furnizorId = body.furnizorId;
  if (furnizorId === undefined && body.furnizorNume !== undefined) {
    if (body.furnizorNume.trim()) {
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
    } else {
      furnizorId = null;
    }
  }

  const updated = await db.factura.update({
    where: { id },
    data: {
      ...(furnizorId !== undefined && { furnizorId }),
      ...(body.serie        !== undefined && { serie:        body.serie?.trim() || null }),
      ...(body.numar        !== undefined && { numar:        body.numar?.trim() || null }),
      ...(body.valoare      !== undefined && { valoare:      body.valoare }),
      ...(body.tva          !== undefined && { tva:          body.tva }),
      ...(body.dataEmiterii !== undefined && { dataEmiterii: body.dataEmiterii ? new Date(body.dataEmiterii) : null }),
      ...(body.dataScadenta !== undefined && { dataScadenta: body.dataScadenta ? new Date(body.dataScadenta) : null }),
      ...(body.luna         !== undefined && { luna:         body.luna }),
      ...(body.an           !== undefined && { an:           body.an }),
      ...(body.categorie    !== undefined && { categorie:    body.categorie }),
      ...(body.notes        !== undefined && { notes:        body.notes?.trim() || null }),
      ...(body.status       !== undefined && { status:       body.status }),
    },
    include: {
      furnizor:  { select: { id: true, nume: true } },
      asociatie: { select: { id: true, name: true } },
      plati:     { select: { suma: true } },
    },
  });

  // Dacă valoarea s-a schimbat (și clientul nu a impus un status explicit),
  // recalculează statusul în funcție de plăți/avans.
  if (body.valoare !== undefined && body.status === undefined) {
    await recomputeFacturaStatus(db, id);
  }

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { id } = await params;
  const factura = await db.factura.findFirst({
    where:  { id, organizationId: orgId },
    select: {
      id: true,
      avansMiscari: { select: { id: true, suma: true, avansId: true, avans: { select: { sold: true } } } },
    },
  });
  if (!factura) return NextResponse.json({ error: "Factură negăsită." }, { status: 404 });

  // O depunere generată de această factură nu poate fi anulată dacă avansul
  // respectiv a fost deja consumat pe altă factură.
  for (const m of factura.avansMiscari) {
    if (m.suma > 0 && r2(m.avans.sold) < r2(m.suma) - EPS) {
      return NextResponse.json(
        { error: "Nu se poate șterge: supraplata acestei facturi a generat un avans deja folosit pe altă factură." },
        { status: 409 },
      );
    }
  }

  // Net delta per avans (poate avea mai multe mișcări pe același avans).
  const deltaByAvans = new Map<string, { sold: number; delta: number }>();
  for (const m of factura.avansMiscari) {
    const cur = deltaByAvans.get(m.avansId) ?? { sold: m.avans.sold, delta: 0 };
    cur.delta += m.suma; // depunere (+) și consum (−)
    deltaByAvans.set(m.avansId, cur);
  }

  await db.$transaction(async (tx) => {
    // Reversează efectul asupra soldului: scade depunerile, readaugă consumurile.
    for (const [avansId, { sold, delta }] of deltaByAvans) {
      await tx.avansFurnizor.update({ where: { id: avansId }, data: { sold: r2(sold - delta) } });
    }
    await tx.factura.delete({ where: { id } }); // plăți + mișcări cascade/SetNull
  });

  return NextResponse.json({ ok: true });
}
