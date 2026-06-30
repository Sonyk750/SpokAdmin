import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Registru plăți — toate plățile către furnizori în perioadă.
export async function GET(req: NextRequest) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const asociatieId = searchParams.get("asociatieId");
  const dataStart   = searchParams.get("dataStart");
  const dataEnd     = searchParams.get("dataEnd");
  if (!asociatieId || !dataStart || !dataEnd)
    return NextResponse.json({ error: "Parametri lipsă" }, { status: 400 });

  const asoc = await db.asociatie.findFirst({ where: { id: asociatieId, organizationId: orgId }, select: { id: true } });
  if (!asoc) return NextResponse.json({ error: "Asociație negăsită" }, { status: 404 });

  const plati = await db.plata.findMany({
    where: {
      factura: { asociatieId, organizationId: orgId },
      data:    { gte: new Date(dataStart), lte: new Date(dataEnd + "T23:59:59") },
    },
    orderBy: [{ data: "asc" }, { createdAt: "asc" }],
    select: {
      id: true, data: true, suma: true, metoda: true, notes: true,
      idTranzactie: true, serieCh: true, nrCh: true,
      factura: { select: { serie: true, numar: true, categorie: true, furnizor: { select: { nume: true } } } },
    },
  });

  return NextResponse.json(plati.map(p => ({
    id:           p.id,
    data:         p.data.toISOString(),
    document:     [p.factura?.serie, p.factura?.numar].filter(Boolean).join(" ") || "—",
    furnizor:     p.factura?.furnizor?.nume ?? "—",
    categorie:    p.factura?.categorie ?? null,
    metoda:       p.metoda,
    suma:         p.suma,
    notes:        p.notes,
    idTranzactie: p.idTranzactie ?? null,
    serieCh:      p.serieCh ?? null,
    nrCh:         p.nrCh ?? null,
  })));
}
