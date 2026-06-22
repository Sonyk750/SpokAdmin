import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Registru casă — toate operațiunile prin casă (încasări numerar + plăți numerar)
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

  const asoc = await db.asociatie.findFirst({
    where:  { id: asociatieId, organizationId: orgId },
    select: { id: true, wizardData: true },
  });
  if (!asoc) return NextResponse.json({ error: "Asociație negăsită" }, { status: 404 });

  // Sold casă inițial (din inițializare)
  let soldCasaWizard = 0;
  try {
    const wd = asoc.wizardData ? JSON.parse(asoc.wizardData) : {};
    soldCasaWizard = typeof wd.soldCasa === "number" ? wd.soldCasa : parseFloat(wd.soldCasa) || 0;
  } catch { /* ignore */ }

  const start = new Date(dataStart);
  const end   = new Date(dataEnd + "T23:59:59");

  // Intrări: încasări prin casă
  const incasari = await db.incasare.findMany({
    where:  { asociatieId, organizationId: orgId, tipPlata: "casa" },
    select: {
      id: true, data: true, serie: true, numarDocument: true,
      nrApartament: true, proprietarNume: true, sumaIncasata: true, createdAt: true,
    },
  });

  // Ieșiri: plăți facturi prin casă
  const plati = await db.plata.findMany({
    where:  { metoda: "casa", factura: { asociatieId, organizationId: orgId } },
    select: {
      id: true, data: true, suma: true, notes: true, createdAt: true,
      factura: { select: { serie: true, numar: true, furnizor: { select: { nume: true } } } },
    },
  });

  // Sold la începutul perioadei = sold inițial + intrări - ieșiri (toate înainte de start)
  const incBefore  = incasari.filter(i => i.data < start).reduce((s, i) => s + i.sumaIncasata, 0);
  const platBefore = plati   .filter(p => p.data < start).reduce((s, p) => s + p.suma, 0);
  const soldInitial = soldCasaWizard + incBefore - platBefore;

  type Op = {
    id: string; data: string; fel: "incasare" | "plata";
    document: string; detalii: string; intrare: number; iesire: number;
    _dataMs: number; _createdMs: number;
  };
  const ops: Op[] = [];

  for (const i of incasari) {
    if (i.data < start || i.data > end) continue;
    ops.push({
      id: i.id, data: i.data.toISOString(), fel: "incasare",
      document: `${i.serie} ${i.numarDocument}`,
      detalii:  `Ap. ${i.nrApartament}${i.proprietarNume ? " — " + i.proprietarNume : ""}`,
      intrare:  i.sumaIncasata, iesire: 0,
      _dataMs: i.data.getTime(), _createdMs: i.createdAt.getTime(),
    });
  }
  for (const p of plati) {
    if (p.data < start || p.data > end) continue;
    const furn  = p.factura?.furnizor?.nume ?? "Furnizor";
    const facNr = [p.factura?.serie, p.factura?.numar].filter(Boolean).join(" ");
    ops.push({
      id: p.id, data: p.data.toISOString(), fel: "plata",
      document: facNr || "Factură",
      detalii:  `${furn}${p.notes ? " — " + p.notes : ""}`,
      intrare:  0, iesire: p.suma,
      _dataMs: p.data.getTime(), _createdMs: p.createdAt.getTime(),
    });
  }

  ops.sort((a, b) => a._dataMs - b._dataMs || a._createdMs - b._createdMs);

  return NextResponse.json({
    soldInitial,
    operatiuni: ops.map(({ _dataMs, _createdMs, ...o }) => o),
  });
}
