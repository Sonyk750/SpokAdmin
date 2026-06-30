import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/plati?asociatieId=X&dataStart=Y&dataEnd=Z&metoda=M
export async function GET(req: NextRequest) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const sp          = req.nextUrl.searchParams;
  const asociatieId = sp.get("asociatieId") ?? undefined;
  const metoda      = sp.get("metoda")      ?? undefined;
  const dataStart   = sp.get("dataStart");
  const dataEnd     = sp.get("dataEnd");

  const plati = await db.plata.findMany({
    where: {
      factura: { organizationId: orgId, ...(asociatieId && { asociatieId }) },
      ...(metoda && { metoda }),
      ...(dataStart && dataEnd && {
        data: {
          gte: new Date(dataStart),
          lte: new Date(dataEnd + "T23:59:59"),
        },
      }),
    },
    select: {
      id: true, suma: true, data: true, metoda: true,
      fondId: true, fondName: true,
      notes: true, idTranzactie: true, serieCh: true, nrCh: true,
      facturaId: true,
      factura: {
        select: {
          id: true, serie: true, numar: true,
          furnizor:  { select: { id: true, nume: true } },
          asociatie: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { data: "desc" },
  });

  return NextResponse.json(plati.map(p => ({
    ...p,
    data: p.data.toISOString(),
  })));
}
