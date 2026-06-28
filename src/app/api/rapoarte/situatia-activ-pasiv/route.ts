import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPerioadaCurenta } from "@/lib/perioada";

// ─── Situaţia soldurilor elementelor de activ şi pasiv (Legea 196/2018) ──────────
// Fotografie la o dată ("la data întocmirii"). Partea I (Activ) = Partea II (Pasiv);
// diferenţa de rotunjire echilibrează cele două totaluri.

const r2 = (v: number) => Math.round(v * 100) / 100;
const EPS = 0.01;
const LUNI_SCURT = ["Ian", "Feb", "Mar", "Apr", "Mai", "Iun", "Iul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const lunaLabel = (luna: number, an: number) => `${LUNI_SCURT[(luna - 1) % 12] ?? luna} ${String(an).slice(-2)}`;

// Normalizează un nume de fond (lowercase, fără diacritice) pentru încadrare automată.
function norm(s: string): string {
  return s.toLowerCase()
    .replace(/ă|â/g, "a").replace(/î/g, "i").replace(/ș|ş/g, "s").replace(/ț|ţ/g, "t")
    .replace(/\s+/g, " ").trim();
}
// rulment | reparatii | speciale | alte
function categorieFond(name: string): "rulment" | "reparatii" | "speciale" | "alte" {
  const n = norm(name);
  if (n.includes("rulment")) return "rulment";
  if (n.includes("reparatii")) return "reparatii";        // plural „reparaţii" (fondul general)
  if (n.includes("sume speciale") || n.includes("imbunatatire") || n.includes("confort")) return "speciale";
  return "alte";
}

interface Sub { label: string; valoare: number; }
interface Detaliu { label: string; valoare: number; sub?: Sub[]; }
interface Rand { nr: number; label: string; valoare: number; detalii: Detaliu[]; }

export async function GET(req: NextRequest) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const asociatieId = searchParams.get("asociatieId");
  const dataParam   = searchParams.get("data"); // YYYY-MM-DD; default azi
  if (!asociatieId) return NextResponse.json({ error: "Parametri lipsă" }, { status: 400 });

  const asoc = await db.asociatie.findFirst({
    where:  { id: asociatieId, organizationId: orgId },
    select: {
      id: true, name: true, address: true, city: true, sector: true, cui: true,
      bank: true, iban: true, wizardData: true,
      adminName: true, presedinteName: true, cenzorName: true,
    },
  });
  if (!asoc) return NextResponse.json({ error: "Asociație negăsită" }, { status: 404 });

  const dataIso = dataParam || new Date().toISOString().slice(0, 10);
  const end = new Date(dataIso + "T23:59:59");
  const before = (d: Date) => d <= end;

  // ── wizardData: solduri iniţiale casă/bănci ───────────────────────────────────
  let soldCasaWizard = 0;
  let banci: { name: string; sold: number }[] = [];
  try {
    const wd = asoc.wizardData ? JSON.parse(asoc.wizardData) : {};
    soldCasaWizard = typeof wd.soldCasa === "number" ? wd.soldCasa : parseFloat(wd.soldCasa) || 0;
    if (Array.isArray(wd.banci)) {
      banci = wd.banci.filter((b: any) => b.name)
        .map((b: any) => ({ name: b.name, sold: typeof b.sold === "number" ? b.sold : parseFloat(b.sold) || 0 }));
    }
  } catch { /* ignore */ }
  if (banci.length === 0 && asoc.bank) banci = [{ name: asoc.bank, sold: 0 }];
  const primaryBank = banci[0]?.name ?? null;

  const perioada = await getPerioadaCurenta(asociatieId);

  // ── Interogări ────────────────────────────────────────────────────────────────
  const [apartamente, incasari, plati, transferuri, fonduri, fondApart, transferFond, facturi] = await Promise.all([
    db.apartament.findMany({
      where:   { asociatieId, organizationId: orgId, isActive: true },
      orderBy: { numar: "asc" },
      select: {
        id: true, numar: true,
        proprietari: { where: { isMain: true }, include: { proprietar: { select: { nume: true, prenume: true } } }, take: 1 },
        solduri: { select: { restantaIntretinere: true, intretinereCurenta: true } },
      },
    }),
    db.incasare.findMany({
      where:  { asociatieId, organizationId: orgId },
      select: { data: true, tipPlata: true, sumaIncasata: true, pozitiiJson: true, avansJson: true },
    }),
    db.plata.findMany({
      where:  { factura: { asociatieId, organizationId: orgId } },
      select: { data: true, suma: true, metoda: true, fondId: true },
    }),
    db.transfer.findMany({
      where:  { asociatieId, organizationId: orgId },
      select: { data: true, suma: true, dinCont: true, inCont: true },
    }),
    db.fondAsociatie.findMany({
      where:   { asociatieId, isEnabled: true },
      orderBy: { sortOrder: "asc" },
      select:  { id: true, name: true },
    }),
    db.fondApartament.findMany({
      where:  { asociatieId },
      select: { fondId: true, sold: true },
    }),
    db.transferFond.findMany({
      where:  { asociatieId, organizationId: orgId },
      select: { data: true, suma: true, dinFondId: true, inFondId: true },
    }),
    db.factura.findMany({
      where:  { asociatieId, organizationId: orgId },
      select: {
        valoare: true, serie: true, numar: true, luna: true, an: true,
        dataEmiterii: true, createdAt: true, distribuireJson: true, fondId: true,
        furnizor: { select: { nume: true } },
        plati:        { select: { suma: true, data: true } },
        avansMiscari: { select: { suma: true, createdAt: true } },
      },
    }),
  ]);

  // ════════════════════════ PARTEA I — ACTIV ════════════════════════════════════

  // A1 — Sold în casă (la data)
  let soldCasa = soldCasaWizard;
  for (const i of incasari) if (i.tipPlata === "casa" && before(i.data)) soldCasa += i.sumaIncasata;
  for (const p of plati)    if (p.metoda === "casa"   && before(p.data)) soldCasa -= p.suma;
  for (const t of transferuri) if (before(t.data)) {
    if (t.inCont === "Casă") soldCasa += t.suma;
    if (t.dinCont === "Casă") soldCasa -= t.suma;
  }
  soldCasa = r2(soldCasa);

  // A2 — Sold conturi la bănci (la data) — încasări/plăţi merg pe contul principal
  const bankDet: Detaliu[] = banci.map(b => {
    let s = b.sold;
    if (b.name === primaryBank) {
      for (const i of incasari) if (i.tipPlata === "banca" && before(i.data)) s += i.sumaIncasata;
      for (const p of plati)    if (p.metoda === "banca"   && before(p.data)) s -= p.suma;
    }
    for (const t of transferuri) if (before(t.data)) {
      if (t.inCont === b.name) s += t.suma;
      if (t.dinCont === b.name) s -= t.suma;
    }
    return { label: b.name, valoare: r2(s) };
  });
  const soldBanca = r2(bankDet.reduce((s, d) => s + d.valoare, 0));

  // A3 / A4 / P6 — poziţii proprietari (din soldul curent per apartament)
  const propLabel = (ap: typeof apartamente[number]) => {
    const p = ap.proprietari[0]?.proprietar;
    return p ? [p.prenume, p.nume].filter(Boolean).join(" ") : `Ap. ${ap.numar}`;
  };
  const a3Det: Detaliu[] = [];
  const a4Det: Detaliu[] = [];
  const p6Det: Detaliu[] = [];
  let a3 = 0, a4 = 0, p6 = 0;
  const curLabel = lunaLabel(perioada.luna, perioada.an);
  for (const ap of apartamente) {
    const sold = ap.solduri[0];
    const cur  = r2(sold?.intretinereCurenta ?? 0);
    const old  = r2(sold?.restantaIntretinere ?? 0);
    const nume = propLabel(ap);
    if (cur > EPS) { a3 += cur; a3Det.push({ label: `${ap.numar}. ${nume}`, valoare: cur, sub: [{ label: `Întreţinere ${curLabel}`, valoare: cur }] }); }
    if (old > EPS) { a4 += old; a4Det.push({ label: `${ap.numar}. ${nume}`, valoare: old, sub: [{ label: `Restanţă întreţinere`, valoare: old }] }); }
    const credit = r2(Math.max(0, -cur) + Math.max(0, -old));
    if (credit > EPS) { p6 += credit; p6Det.push({ label: `${ap.numar}. ${nume}`, valoare: credit }); }
  }

  // A6 — Acte de plată pe luna în curs, nerepartizate proprietarilor
  const isEmptyDist = (j: string | null) => {
    if (!j) return true;
    try { const v = JSON.parse(j); const rows = Array.isArray(v) ? v : v?.rows; return !Array.isArray(rows) || rows.length === 0; }
    catch { return true; }
  };
  const a6ByFurn = new Map<string, { total: number; facturi: Sub[] }>();
  let a6 = 0;
  for (const f of facturi) {
    const fdata = f.dataEmiterii ?? f.createdAt;
    if (!before(fdata)) continue;
    if (f.luna !== perioada.luna || f.an !== perioada.an) continue;
    if (f.fondId) continue;                    // acoperită din fond — nu se repartizează
    if (!isEmptyDist(f.distribuireJson)) continue; // deja distribuită
    const furn = f.furnizor?.nume ?? "Furnizor";
    const facNr = [f.serie, f.numar].filter(Boolean).join(" ") || "-";
    const e = a6ByFurn.get(furn) ?? { total: 0, facturi: [] };
    e.total = r2(e.total + f.valoare);
    e.facturi.push({ label: `Factura nr. ${facNr}`, valoare: r2(f.valoare) });
    a6ByFurn.set(furn, e);
    a6 = r2(a6 + f.valoare);
  }
  const a6Det: Detaliu[] = [...a6ByFurn.entries()].sort((x, y) => y[1].total - x[1].total)
    .map(([furn, e]) => ({ label: furn, valoare: e.total, sub: e.facturi }));

  // ════════════════════════ PARTEA II — PASIV ═══════════════════════════════════

  // P1–P4 — Solduri fonduri (la data), încadrate automat după nume
  const baseByFond = new Map<string, number>();
  for (const fa of fondApart) baseByFond.set(fa.fondId, r2((baseByFond.get(fa.fondId) ?? 0) + fa.sold));
  const soldAsocByFond = new Map<string, number>();
  try {
    const wd = asoc.wizardData ? JSON.parse(asoc.wizardData) : {};
    if (Array.isArray(wd.soldFondAsoc)) for (const sf of wd.soldFondAsoc) if (sf.fondId) soldAsocByFond.set(sf.fondId, parseFloat(sf.sold) || 0);
  } catch { /* ignore */ }

  const contribFond = (pozitiiJson: string | null, avansJson: string | null, fondId: string): number => {
    let sum = 0;
    for (const key of ["poz", "av"] as const) {
      try {
        const arr = JSON.parse((key === "poz" ? pozitiiJson : avansJson) || "null");
        if (Array.isArray(arr)) for (const x of arr) if (x?.tip === "fond" && x?.fondId === fondId) sum += Number(x.suma) || 0;
      } catch { /* ignore */ }
    }
    return sum;
  };

  const fondSold = new Map<string, number>();
  for (const f of fonduri) {
    let s = (baseByFond.get(f.id) ?? 0) || (soldAsocByFond.get(f.id) ?? 0);
    for (const i of incasari) if (before(i.data)) s += contribFond(i.pozitiiJson, i.avansJson, f.id);
    for (const p of plati)    if (p.fondId === f.id && before(p.data)) s -= p.suma;
    for (const t of transferFond) if (before(t.data)) { if (t.inFondId === f.id) s += t.suma; if (t.dinFondId === f.id) s -= t.suma; }
    fondSold.set(f.id, r2(s));
  }

  const fondCat = { rulment: [] as Detaliu[], reparatii: [] as Detaliu[], speciale: [] as Detaliu[], alte: [] as Detaliu[] };
  for (const f of fonduri) {
    const val = fondSold.get(f.id) ?? 0;
    fondCat[categorieFond(f.name)].push({ label: f.name, valoare: val });
  }
  const sumDet = (d: Detaliu[]) => r2(d.reduce((s, x) => s + x.valoare, 0));

  // P5 — Furnizori pentru facturi neachitate (rest > 0 la data), per furnizor + factură
  const p5ByFurn = new Map<string, { total: number; facturi: Sub[] }>();
  let p5 = 0;
  for (const f of facturi) {
    const fdata = f.dataEmiterii ?? f.createdAt;
    if (!before(fdata)) continue;
    const acoperit = r2(
      f.plati.filter(p => before(p.data)).reduce((s, p) => s + p.suma, 0) -
      f.avansMiscari.filter(m => before(m.createdAt)).reduce((s, m) => s + m.suma, 0),
    );
    const rest = r2(f.valoare - acoperit);
    if (rest <= EPS) continue;
    const furn = f.furnizor?.nume ?? "Furnizor";
    const facNr = [f.serie, f.numar].filter(Boolean).join(" ") || "-";
    const e = p5ByFurn.get(furn) ?? { total: 0, facturi: [] };
    e.total = r2(e.total + rest);
    e.facturi.push({ label: `Factura nr. ${facNr}`, valoare: rest });
    p5ByFurn.set(furn, e);
    p5 = r2(p5 + rest);
  }
  const p5Det: Detaliu[] = [...p5ByFurn.entries()].sort((x, y) => y[1].total - x[1].total)
    .map(([furn, e]) => ({ label: furn, valoare: e.total, sub: e.facturi }));

  // ── Asamblare ─────────────────────────────────────────────────────────────────
  const activ: Rand[] = [
    { nr: 1, label: "Sold în casă", valoare: soldCasa, detalii: [] },
    { nr: 2, label: "Sold conturi la bănci", valoare: soldBanca, detalii: bankDet },
    { nr: 3, label: "Sume neachitate de proprietarii din asociaţie pentru lista de plată curentă", valoare: r2(a3), detalii: a3Det },
    { nr: 4, label: "Restanţe existente la data întocmirii acestei situaţii", valoare: r2(a4), detalii: a4Det },
    { nr: 5, label: "Debitori, alţii decât membrii asociaţiei", valoare: 0, detalii: [] },
    { nr: 6, label: "Actele de plată pe luna în curs, nerepartizate proprietarilor (facturi de apă, gaze, energie electrică sau termică, de reparaţii neprevăzute, state de salarii, indemnizaţii, premii etc.)", valoare: a6, detalii: a6Det },
    { nr: 7, label: "Acte de plăţi pentru cheltuielile aferente fondurilor de reparaţii, speciale, de penalizări care nu au fost încă scăzute din fondurile respective", valoare: 0, detalii: [] },
  ];
  const totalActiv = r2(activ.reduce((s, r) => s + r.valoare, 0));

  const pasivBase: Rand[] = [
    { nr: 1, label: "Sold fond de rulment", valoare: sumDet(fondCat.rulment), detalii: fondCat.rulment },
    { nr: 2, label: "Sold fond de reparaţii", valoare: sumDet(fondCat.reparatii), detalii: fondCat.reparatii },
    { nr: 3, label: "Sold fond sume speciale", valoare: sumDet(fondCat.speciale), detalii: fondCat.speciale },
    { nr: 4, label: "Soldul altor fonduri legal stabilite (de penalizări, de cheltuieli administrative, de recuperări debite etc.)", valoare: sumDet(fondCat.alte), detalii: fondCat.alte },
    { nr: 5, label: "Furnizori pentru facturi neachitate (utilităţi, servicii, livrări, prestaţii, lucrări etc.)", valoare: p5, detalii: p5Det },
    { nr: 6, label: "Creditori diverşi", valoare: r2(p6), detalii: p6Det },
  ];
  const totalPasivBase = r2(pasivBase.reduce((s, r) => s + r.valoare, 0));
  const rotunjiri = r2(totalActiv - totalPasivBase);
  const pasiv: Rand[] = [...pasivBase, { nr: 7, label: "Diferenţe din rotunjiri", valoare: rotunjiri, detalii: [] }];
  const totalPasiv = r2(totalPasivBase + rotunjiri);

  return NextResponse.json({
    asoc: {
      name: asoc.name, address: asoc.address, city: asoc.city, sector: asoc.sector, cui: asoc.cui,
      bank: asoc.bank, iban: asoc.iban,
      adminName: asoc.adminName, presedinteName: asoc.presedinteName, cenzorName: asoc.cenzorName,
    },
    data: dataIso,
    activ, pasiv, totalActiv, totalPasiv,
  });
}
