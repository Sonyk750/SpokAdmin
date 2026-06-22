import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Registru bancă — operațiunile prin contul bancar selectat.
// Notă: Încasările/plățile rețin doar "banca" generic (nu contul exact),
// deci se atribuie contului principal (primul din listă). Transferurile sunt
// atribuite precis după numele contului.
export async function GET(req: NextRequest) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const asociatieId = searchParams.get("asociatieId");
  const cont        = searchParams.get("cont");
  const dataStart   = searchParams.get("dataStart");
  const dataEnd     = searchParams.get("dataEnd");
  if (!asociatieId || !cont || !dataStart || !dataEnd)
    return NextResponse.json({ error: "Parametri lipsă" }, { status: 400 });

  const asoc = await db.asociatie.findFirst({
    where:  { id: asociatieId, organizationId: orgId },
    select: { id: true, bank: true, wizardData: true },
  });
  if (!asoc) return NextResponse.json({ error: "Asociație negăsită" }, { status: 404 });

  // Conturile bancare + soldurile inițiale (din inițializare)
  let banci: { name: string; sold: number }[] = [];
  try {
    const wd = asoc.wizardData ? JSON.parse(asoc.wizardData) : {};
    if (Array.isArray(wd.banci)) {
      banci = wd.banci
        .filter((b: any) => b.name)
        .map((b: any) => ({ name: b.name, sold: typeof b.sold === "number" ? b.sold : parseFloat(b.sold) || 0 }));
    }
  } catch { /* ignore */ }
  if (banci.length === 0 && asoc.bank) banci = [{ name: asoc.bank, sold: 0 }];

  const primaryBank = banci[0]?.name ?? null;
  const isPrimary   = cont === primaryBank;
  const soldBancaWizard = banci.find(b => b.name === cont)?.sold ?? 0;

  const start = new Date(dataStart);
  const end   = new Date(dataEnd + "T23:59:59");

  // Încasări / plăți prin bancă — doar pentru contul principal
  const incasari = isPrimary
    ? await db.incasare.findMany({
        where:  { asociatieId, organizationId: orgId, tipPlata: "banca" },
        select: { id: true, data: true, serie: true, numarDocument: true, nrApartament: true, proprietarNume: true, sumaIncasata: true, createdAt: true },
      })
    : [];
  const plati = isPrimary
    ? await db.plata.findMany({
        where:  { metoda: "banca", factura: { asociatieId, organizationId: orgId } },
        select: { id: true, data: true, suma: true, notes: true, createdAt: true,
          factura: { select: { serie: true, numar: true, furnizor: { select: { nume: true } } } } },
      })
    : [];

  // Transferuri care implică acest cont
  const transferuri = await db.transfer.findMany({
    where:  { asociatieId, organizationId: orgId, OR: [{ dinCont: cont }, { inCont: cont }] },
    select: { id: true, data: true, suma: true, dinCont: true, inCont: true, notes: true, createdAt: true },
  });

  const incBefore  = incasari.filter(i => i.data < start).reduce((s, i) => s + i.sumaIncasata, 0);
  const platBefore = plati   .filter(p => p.data < start).reduce((s, p) => s + p.suma, 0);
  const trfBefore  = transferuri
    .filter(t => t.data < start)
    .reduce((s, t) => s + (t.inCont === cont ? t.suma : 0) - (t.dinCont === cont ? t.suma : 0), 0);
  const soldInitial = soldBancaWizard + incBefore - platBefore + trfBefore;

  type Op = {
    id: string; data: string; fel: "incasare" | "plata" | "transfer";
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
  for (const t of transferuri) {
    if (t.data < start || t.data > end) continue;
    const inThis = t.inCont === cont;
    ops.push({
      id: t.id, data: t.data.toISOString(), fel: "transfer",
      document: "Transfer",
      detalii:  inThis ? `Din ${t.dinCont}${t.notes ? " — " + t.notes : ""}` : `Către ${t.inCont}${t.notes ? " — " + t.notes : ""}`,
      intrare:  inThis ? t.suma : 0,
      iesire:   inThis ? 0 : t.suma,
      _dataMs: t.data.getTime(), _createdMs: t.createdAt.getTime(),
    });
  }

  ops.sort((a, b) => a._dataMs - b._dataMs || a._createdMs - b._createdMs);

  return NextResponse.json({
    soldInitial,
    isPrimary,
    operatiuni: ops.map(({ _dataMs, _createdMs, ...o }) => o),
  });
}
