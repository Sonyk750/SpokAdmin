import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { recomputeFacturaStatus, getAvansSold } from "@/lib/avans-furnizor";

const r2 = (v: number) => Math.round(v * 100) / 100;
const EPS = 0.01;

// ── DELETE: anulează o plată (și reversează avansul generat de ea) ─────────────
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; plataId: string }> }) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { id, plataId } = await params;

  const plata = await db.plata.findFirst({
    where:  { id: plataId, facturaId: id, factura: { organizationId: orgId } },
    select: {
      id: true, suma: true,
      factura: { select: { id: true, asociatieId: true, furnizorId: true } },
      avansMiscari: { select: { id: true, suma: true, avansId: true, avans: { select: { sold: true } } } },
    },
  });
  if (!plata) return NextResponse.json({ error: "Plată negăsită." }, { status: 404 });

  // Depunerile de avans generate de această plată trebuie să fie încă disponibile.
  for (const m of plata.avansMiscari) {
    if (r2(m.avans.sold) < r2(m.suma) - EPS) {
      return NextResponse.json(
        { error: "Nu se poate anula: surplusul acestei plăți a generat un avans deja folosit pe altă factură. Anulează întâi factura care a consumat avansul." },
        { status: 409 },
      );
    }
  }

  const result = await db.$transaction(async (tx) => {
    // Reversează depunerile de avans (scade soldul, șterge mișcările)
    for (const m of plata.avansMiscari) {
      await tx.avansFurnizor.update({ where: { id: m.avansId }, data: { sold: r2(m.avans.sold - m.suma) } });
      await tx.avansFurnizorMiscare.delete({ where: { id: m.id } });
    }
    await tx.plata.delete({ where: { id: plata.id } });

    const summary   = await recomputeFacturaStatus(tx, plata.factura.id);
    const avansSold = plata.factura.furnizorId
      ? await getAvansSold(tx, plata.factura.asociatieId, plata.factura.furnizorId)
      : 0;
    return { ...summary, avansSold };
  });

  return NextResponse.json(result);
}
