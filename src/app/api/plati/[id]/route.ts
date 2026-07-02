import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { recomputeFacturaStatus, getAvansSold } from "@/lib/avans-furnizor";
import { resolveAccess } from "@/lib/access";

const r2 = (v: number) => Math.round(v * 100) / 100;
const EPS = 0.01;
const METODE = ["casa", "banca", "online"];

// ── PUT: editează o plată ──────────────────────────────────────────────────────
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as {
    suma?: number; metoda?: string; data?: string; notes?: string | null;
    idTranzactie?: string | null; serieCh?: string | null; nrCh?: number | null;
  };

  const plata = await db.plata.findFirst({
    where:  { id, OR: [{ factura: { organizationId: orgId } }, { facturaId: null, organizationId: orgId }] },
    select: {
      id: true, facturaId: true, asociatieId: true,
      factura: { select: { asociatieId: true, furnizorId: true } },
    },
  });
  if (!plata) return NextResponse.json({ error: "Plată negăsită." }, { status: 404 });
  const asociatieId = plata.factura?.asociatieId ?? plata.asociatieId!;

  const access = await resolveAccess(session!.user as any, asociatieId);
  if (!access.isAdmin) return NextResponse.json({ error: "Nu ai dreptul să editezi plăți." }, { status: 403 });

  const suma = body.suma != null ? Number(body.suma) : undefined;
  if (suma !== undefined && (isNaN(suma) || suma <= 0))
    return NextResponse.json({ error: "Suma trebuie să fie un număr pozitiv." }, { status: 400 });

  const metoda = body.metoda?.toLowerCase();
  if (metoda && !METODE.includes(metoda))
    return NextResponse.json({ error: "Metodă de plată invalidă." }, { status: 400 });

  await db.plata.update({
    where: { id },
    data: {
      ...(suma   !== undefined && { suma: r2(suma) }),
      ...(metoda && { metoda }),
      ...(body.data  && { data: new Date(body.data) }),
      notes:        body.notes?.trim() || null,
      idTranzactie: metoda === "banca" || (!metoda && body.idTranzactie !== undefined)
        ? (body.idTranzactie?.trim() || null) : undefined,
      serieCh: metoda === "casa" || (!metoda && body.serieCh !== undefined)
        ? (body.serieCh?.trim() || null) : undefined,
      nrCh: metoda === "casa" || (!metoda && body.nrCh !== undefined)
        ? (body.nrCh ?? null) : undefined,
    },
  });

  if (plata.facturaId) await recomputeFacturaStatus(db, plata.facturaId);

  return NextResponse.json({ ok: true });
}

// ── DELETE: anulează o plată (și reversează avansul generat de ea) ─────────────
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { id } = await params;

  const plata = await db.plata.findFirst({
    where:  { id, OR: [{ factura: { organizationId: orgId } }, { facturaId: null, organizationId: orgId }] },
    select: {
      id: true, suma: true, facturaId: true, asociatieId: true, furnizorId: true,
      factura: { select: { id: true, asociatieId: true, furnizorId: true } },
      avansMiscari: { select: { id: true, suma: true, avansId: true, avans: { select: { sold: true } } } },
    },
  });
  if (!plata) return NextResponse.json({ error: "Plată negăsită." }, { status: 404 });
  const asociatieId = plata.factura?.asociatieId ?? plata.asociatieId!;
  const furnizorId  = plata.factura?.furnizorId ?? plata.furnizorId ?? null;

  const access = await resolveAccess(session!.user as any, asociatieId);
  if (!access.isAdmin) return NextResponse.json({ error: "Nu ai dreptul să ștergi plăți." }, { status: 403 });

  for (const m of plata.avansMiscari) {
    if (r2(m.avans.sold) < r2(m.suma) - EPS) {
      return NextResponse.json(
        { error: "Nu se poate anula: surplusul acestei plăți a generat un avans deja folosit pe altă factură. Anulează întâi factura care a consumat avansul." },
        { status: 409 },
      );
    }
  }

  const result = await db.$transaction(async (tx) => {
    for (const m of plata.avansMiscari) {
      await tx.avansFurnizor.update({ where: { id: m.avansId }, data: { sold: r2(m.avans.sold - m.suma) } });
      await tx.avansFurnizorMiscare.delete({ where: { id: m.id } });
    }
    await tx.plata.delete({ where: { id: plata.id } });
    const summary   = plata.facturaId ? await recomputeFacturaStatus(tx, plata.facturaId) : null;
    const avansSold = furnizorId ? await getAvansSold(tx, asociatieId, furnizorId) : 0;
    return { ...summary, avansSold };
  });

  return NextResponse.json(result);
}
