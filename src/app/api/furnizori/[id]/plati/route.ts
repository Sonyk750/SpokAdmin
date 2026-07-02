import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveAccess } from "@/lib/access";
import { depuneAvans, consumaAvansPeFacturileFurnizorului, getAvansSold } from "@/lib/avans-furnizor";

const r2 = (v: number) => Math.round(v * 100) / 100;
const METODE = ["casa", "banca", "online"];

// ── POST: plată liberă către furnizor (fără factură) — stinge întâi facturile
// restante ale furnizorului, restul rămâne ca avans disponibil ─────────────────
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { id: furnizorId } = await params;
  const body = await req.json() as {
    asociatieId?: string; suma?: number; metoda?: string; data?: string | null;
    notes?: string | null; idTranzactie?: string | null; serieCh?: string | null; nrCh?: number | null;
  };

  const asociatieId = body.asociatieId;
  if (!asociatieId) return NextResponse.json({ error: "Asociație lipsă." }, { status: 400 });

  const suma = Number(body.suma);
  if (!suma || isNaN(suma) || suma <= 0)
    return NextResponse.json({ error: "Suma trebuie să fie un număr pozitiv." }, { status: 400 });
  const metoda = (body.metoda ?? "banca").toLowerCase();
  if (!METODE.includes(metoda))
    return NextResponse.json({ error: "Metodă de plată invalidă." }, { status: 400 });

  const access = await resolveAccess(session!.user as any, asociatieId);
  if (!access.isAdmin) return NextResponse.json({ error: "Nu ai dreptul să înregistrezi plăți." }, { status: 403 });

  const [furnizor, asociatie] = await Promise.all([
    db.furnizor.findFirst({ where: { id: furnizorId, organizationId: orgId }, select: { id: true } }),
    db.asociatie.findFirst({ where: { id: asociatieId, organizationId: orgId }, select: { id: true } }),
  ]);
  if (!furnizor) return NextResponse.json({ error: "Furnizor negăsit." }, { status: 404 });
  if (!asociatie) return NextResponse.json({ error: "Asociație negăsită." }, { status: 404 });

  const result = await db.$transaction(async (tx) => {
    const plata = await tx.plata.create({
      data: {
        facturaId:      null,
        organizationId: orgId,
        asociatieId,
        furnizorId,
        suma:           r2(suma),
        metoda,
        data:           body.data ? new Date(body.data) : new Date(),
        notes:          body.notes?.trim() || null,
        idTranzactie:   metoda === "banca" ? (body.idTranzactie?.trim() || null) : null,
        serieCh:        metoda === "casa"  ? (body.serieCh?.trim() || null) : null,
        nrCh:           metoda === "casa"  ? (body.nrCh ?? null) : null,
      },
      select: { id: true },
    });

    await depuneAvans(
      tx,
      { organizationId: orgId, asociatieId, furnizorId },
      suma,
      null,
      metoda,
      plata.id,
      "Plată avans furnizor",
    );
    // Stinge automat facturile restante ale furnizorului cu avansul depus; restul rămâne disponibil.
    await consumaAvansPeFacturileFurnizorului(tx, { organizationId: orgId, asociatieId, furnizorId });

    const avansSold = await getAvansSold(tx, asociatieId, furnizorId);
    return { plataId: plata.id, avansSold };
  });

  return NextResponse.json(result, { status: 201 });
}
