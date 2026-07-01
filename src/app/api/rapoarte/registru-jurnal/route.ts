import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/mobile-auth";
import { db } from "@/lib/db";

const CASA = "Casă";

// Registru-jurnal de încasări și plăți — toate operațiunile cronologic,
// cu încasări/plăți separate pe numerar (casă) și bancă.
// Transferurile casă↔bancă apar ca operațiuni pereche (ies dintr-un cont, intră în altul).
export async function GET(req: NextRequest) {
  const user = await getApiUser(req);
  const orgId = user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const asociatieId = searchParams.get("asociatieId");
  const dataStart   = searchParams.get("dataStart");
  const dataEnd     = searchParams.get("dataEnd");
  if (!asociatieId || !dataStart || !dataEnd)
    return NextResponse.json({ error: "Parametri lipsă" }, { status: 400 });

  const asoc = await db.asociatie.findFirst({
    where:  { id: asociatieId, organizationId: orgId },
    select: { id: true, bank: true, wizardData: true },
  });
  if (!asoc) return NextResponse.json({ error: "Asociație negăsită" }, { status: 404 });

  // Solduri inițiale numerar / bancă (din inițializare)
  let soldCasa = 0;
  let soldBanci = 0;
  try {
    const wd = asoc.wizardData ? JSON.parse(asoc.wizardData) : {};
    soldCasa = typeof wd.soldCasa === "number" ? wd.soldCasa : parseFloat(wd.soldCasa) || 0;
    if (Array.isArray(wd.banci)) {
      soldBanci = wd.banci.reduce((s: number, b: any) =>
        s + (typeof b.sold === "number" ? b.sold : parseFloat(b.sold) || 0), 0);
    }
  } catch { /* ignore */ }

  const start = new Date(dataStart);
  const end   = new Date(dataEnd + "T23:59:59");

  const [incasari, plati, transferuri] = await Promise.all([
    db.incasare.findMany({
      where:  { asociatieId, organizationId: orgId },
      select: { id: true, data: true, serie: true, numarDocument: true, nrApartament: true, proprietarNume: true, sumaIncasata: true, tipPlata: true, createdAt: true },
    }),
    db.plata.findMany({
      where:  { factura: { asociatieId, organizationId: orgId } },
      select: { id: true, data: true, suma: true, metoda: true, notes: true, createdAt: true,
        factura: { select: { serie: true, numar: true, furnizor: { select: { nume: true } } } } },
    }),
    db.transfer.findMany({
      where:  { asociatieId, organizationId: orgId },
      select: { id: true, data: true, suma: true, dinCont: true, inCont: true, notes: true, createdAt: true },
    }),
  ]);

  const isCasaInc  = (t: string) => t === "casa";        // restul (banca/online) = bancă
  const isCasaPlata = (m: string) => m === "casa";

  // Solduri la începutul perioadei (sold inițial + mișcări înainte de start)
  let initNum = soldCasa, initBanca = soldBanci;
  for (const i of incasari) if (i.data < start) (isCasaInc(i.tipPlata) ? (initNum += i.sumaIncasata) : (initBanca += i.sumaIncasata));
  for (const p of plati)    if (p.data < start) (isCasaPlata(p.metoda) ? (initNum -= p.suma) : (initBanca -= p.suma));
  for (const t of transferuri) if (t.data < start) {
    if (t.dinCont === CASA) initNum -= t.suma; else initBanca -= t.suma;
    if (t.inCont  === CASA) initNum += t.suma; else initBanca += t.suma;
  }

  type Op = {
    id: string; data: string; fel: "incasare" | "plata" | "transfer";
    document: string; explicatie: string;
    incNum: number; incBanca: number; platiNum: number; platiBanca: number;
    _dataMs: number; _createdMs: number;
  };
  const ops: Op[] = [];

  for (const i of incasari) {
    if (i.data < start || i.data > end) continue;
    const casa = isCasaInc(i.tipPlata);
    ops.push({
      id: i.id, data: i.data.toISOString(), fel: "incasare",
      document: `${i.serie} ${i.numarDocument}`,
      explicatie: `Încasare Ap. ${i.nrApartament}${i.proprietarNume ? " — " + i.proprietarNume : ""}`,
      incNum: casa ? i.sumaIncasata : 0, incBanca: casa ? 0 : i.sumaIncasata,
      platiNum: 0, platiBanca: 0,
      _dataMs: i.data.getTime(), _createdMs: i.createdAt.getTime(),
    });
  }
  for (const p of plati) {
    if (p.data < start || p.data > end) continue;
    const casa = isCasaPlata(p.metoda);
    const furn = p.factura?.furnizor?.nume ?? "Furnizor";
    const facNr = [p.factura?.serie, p.factura?.numar].filter(Boolean).join(" ");
    ops.push({
      id: p.id, data: p.data.toISOString(), fel: "plata",
      document: facNr || "Factură",
      explicatie: `Plată ${furn}${p.notes ? " — " + p.notes : ""}`,
      incNum: 0, incBanca: 0,
      platiNum: casa ? p.suma : 0, platiBanca: casa ? 0 : p.suma,
      _dataMs: p.data.getTime(), _createdMs: p.createdAt.getTime(),
    });
  }
  for (const t of transferuri) {
    if (t.data < start || t.data > end) continue;
    const dinCasa = t.dinCont === CASA;
    const inCasa  = t.inCont  === CASA;
    ops.push({
      id: t.id, data: t.data.toISOString(), fel: "transfer",
      document: "Transfer",
      explicatie: `${t.dinCont} → ${t.inCont}${t.notes ? " — " + t.notes : ""}`,
      incNum:    inCasa  ? t.suma : 0,
      incBanca:  inCasa  ? 0 : t.suma,
      platiNum:  dinCasa ? t.suma : 0,
      platiBanca: dinCasa ? 0 : t.suma,
      _dataMs: t.data.getTime(), _createdMs: t.createdAt.getTime(),
    });
  }

  ops.sort((a, b) => a._dataMs - b._dataMs || a._createdMs - b._createdMs);

  return NextResponse.json({
    soldInitNumerar: initNum,
    soldInitBanca:   initBanca,
    operatiuni: ops.map(({ _dataMs, _createdMs, ...o }) => o),
  });
}
