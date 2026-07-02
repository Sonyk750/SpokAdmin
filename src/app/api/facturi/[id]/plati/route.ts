import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { computeAcoperit, recomputeFacturaStatus, depuneAvans, getAvansSold, consumaAvansPeFacturileFurnizorului } from "@/lib/avans-furnizor";

const r2 = (v: number) => Math.round(v * 100) / 100;
const EPS = 0.01;
const METODE = ["casa", "banca", "online"];

// ── GET: istoricul plăților + mișcările de avans ale facturii ─────────────────
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { id } = await params;
  const factura = await db.factura.findFirst({
    where:  { id, organizationId: orgId },
    select: {
      id: true, valoare: true, status: true, furnizorId: true, asociatieId: true,
      serie: true, numar: true, dataEmiterii: true,
      plati:        { select: { id: true, suma: true, data: true, metoda: true, fondName: true, notes: true, idTranzactie: true, serieCh: true, nrCh: true }, orderBy: { data: "asc" } },
      avansMiscari: { select: { id: true, suma: true, tip: true, data: true, notes: true, plataId: true }, orderBy: { data: "asc" } },
    },
  });
  if (!factura) return NextResponse.json({ error: "Factură negăsită." }, { status: 404 });

  const acoperit = computeAcoperit(factura.plati, factura.avansMiscari);
  const restCurent = r2(factura.valoare - acoperit);

  const avansSold = factura.furnizorId
    ? await getAvansSold(db, factura.asociatieId, factura.furnizorId)
    : 0;

  // Total datorat furnizorului = restul tuturor facturilor neachitate ale aceluiași furnizor,
  // plus lista individuală a acestor restanțe (folosită pentru alegerea manuală în modalul de plată).
  let totalDatoratFurnizor = restCurent;
  let restante: { id: string; serie: string | null; numar: string | null; valoare: number; rest: number; dataEmiterii: string | null; isCurrent: boolean }[] =
    restCurent > EPS
      ? [{ id: factura.id, serie: factura.serie, numar: factura.numar, valoare: factura.valoare, rest: restCurent, dataEmiterii: factura.dataEmiterii?.toISOString() ?? null, isCurrent: true }]
      : [];

  if (factura.furnizorId) {
    const alteFacturi = await db.factura.findMany({
      where: {
        furnizorId:  factura.furnizorId,
        asociatieId: factura.asociatieId,
        id:          { not: factura.id },
        organizationId: orgId,
      },
      select: {
        id: true, serie: true, numar: true, valoare: true, dataEmiterii: true,
        plati:        { select: { suma: true } },
        avansMiscari: { select: { suma: true } },
      },
    });
    const alteRestante = alteFacturi
      .map(f => ({
        id: f.id, serie: f.serie, numar: f.numar, valoare: f.valoare,
        rest: r2(f.valoare - computeAcoperit(f.plati, f.avansMiscari)),
        dataEmiterii: f.dataEmiterii?.toISOString() ?? null, isCurrent: false,
      }))
      .filter(f => f.rest > EPS);
    const alteRest = alteRestante.reduce((s, f) => s + f.rest, 0);
    totalDatoratFurnizor = r2(restCurent + alteRest);

    restante = restante.concat(alteRestante).sort((a, b) => {
      const da = a.dataEmiterii ? new Date(a.dataEmiterii).getTime() : 0;
      const db_ = b.dataEmiterii ? new Date(b.dataEmiterii).getTime() : 0;
      return da - db_;
    });
  }

  return NextResponse.json({
    valoare:  factura.valoare,
    acoperit,
    rest:     restCurent,
    status:   factura.status,
    avansSold,
    totalDatoratFurnizor,
    restante,
    plati:        factura.plati.map(p => ({ ...p, data: p.data.toISOString() })),
    avansMiscari: factura.avansMiscari.map(m => ({ ...m, data: m.data.toISOString() })),
  });
}

// ── POST: înregistrează o plată; surplusul devine avans la furnizor ───────────
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as { suma?: number; metoda?: string; fondId?: string | null; data?: string | null; notes?: string | null; idTranzactie?: string | null; serieCh?: string | null; nrCh?: number | null };

  const suma = Number(body.suma);
  if (!suma || isNaN(suma) || suma <= 0)
    return NextResponse.json({ error: "Suma trebuie să fie un număr pozitiv." }, { status: 400 });
  const metoda = (body.metoda ?? "banca").toLowerCase();
  if (!METODE.includes(metoda))
    return NextResponse.json({ error: "Metodă de plată invalidă." }, { status: 400 });

  const factura = await db.factura.findFirst({
    where:  { id, organizationId: orgId },
    select: {
      id: true, organizationId: true, asociatieId: true, furnizorId: true, valoare: true,
      plati:        { select: { suma: true } },
      avansMiscari: { select: { suma: true } },
    },
  });
  if (!factura) return NextResponse.json({ error: "Factură negăsită." }, { status: 404 });

  // Fondul din care se plătește (opțional) — trebuie să aparțină asociației.
  let fondId: string | null = null;
  let fondName: string | null = null;
  if (body.fondId) {
    const fond = await db.fondAsociatie.findFirst({
      where:  { id: body.fondId, asociatieId: factura.asociatieId },
      select: { id: true, name: true },
    });
    if (!fond) return NextResponse.json({ error: "Fond invalid." }, { status: 400 });
    fondId = fond.id; fondName = fond.name;
  }

  const acoperit = computeAcoperit(factura.plati, factura.avansMiscari);
  const rest     = r2(factura.valoare - acoperit);
  const surplus  = r2(suma - rest);

  if (surplus > EPS && !factura.furnizorId)
    return NextResponse.json(
      { error: "Plata depășește restul facturii. Atribuie un furnizor facturii pentru a înregistra surplusul ca avans." },
      { status: 400 },
    );

  const result = await db.$transaction(async (tx) => {
    const plata = await tx.plata.create({
      data: {
        facturaId:    factura.id,
        suma:         r2(suma),
        metoda,
        fondId,
        fondName,
        data:         body.data ? new Date(body.data) : new Date(),
        notes:        body.notes?.trim() || null,
        idTranzactie: metoda === "banca" ? (body.idTranzactie?.trim() || null) : null,
        serieCh:      metoda === "casa"  ? (body.serieCh?.trim() || null) : null,
        nrCh:         metoda === "casa"  ? (body.nrCh ?? null) : null,
      },
      select: { id: true },
    });

    if (surplus > EPS && factura.furnizorId) {
      await depuneAvans(
        tx,
        { organizationId: factura.organizationId, asociatieId: factura.asociatieId, furnizorId: factura.furnizorId },
        surplus,
        factura.id,
        metoda,
        plata.id,
        "Supraplată factură",
      );
      // Aplică surplusul automat pe celelalte facturi neachitate ale furnizorului
      await consumaAvansPeFacturileFurnizorului(tx, {
        organizationId: factura.organizationId,
        asociatieId:    factura.asociatieId,
        furnizorId:     factura.furnizorId,
      });
    }

    const summary   = await recomputeFacturaStatus(tx, factura.id);
    const avansSold = factura.furnizorId ? await getAvansSold(tx, factura.asociatieId, factura.furnizorId) : 0;
    return { plataId: plata.id, surplus: surplus > EPS ? surplus : 0, ...summary, avansSold };
  });

  return NextResponse.json(result, { status: 201 });
}
