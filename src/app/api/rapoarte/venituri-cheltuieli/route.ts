import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const CAT_LABEL: Record<string, string> = {
  utilitati: "Utilități", reparatii: "Reparații", intretinere: "Întreținere",
  administrare: "Administrare", salubritate: "Salubritate", curatenie: "Curățenie",
  alte: "Altele", altele: "Altele",
};

// Venituri și cheltuieli — raport sintetic pe perioadă.
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

  const start = new Date(dataStart);
  const end   = new Date(dataEnd + "T23:59:59");

  const [incasari, plati] = await Promise.all([
    db.incasare.findMany({
      where:  { asociatieId, organizationId: orgId, data: { gte: start, lte: end } },
      select: { sumaIncasata: true, pozitiiJson: true, avansJson: true },
    }),
    db.plata.findMany({
      where:  { factura: { asociatieId, organizationId: orgId }, data: { gte: start, lte: end } },
      select: { suma: true, factura: { select: { categorie: true } } },
    }),
  ]);

  // ── Venituri (din încasări) ──
  const venituriMap = new Map<string, number>();
  const add = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v);
  let totalVenituri = 0, parsedVen = 0;

  for (const i of incasari) {
    totalVenituri += i.sumaIncasata;
    try {
      const poz = i.pozitiiJson ? JSON.parse(i.pozitiiJson) : [];
      if (Array.isArray(poz)) for (const p of poz) {
        const s = Number(p?.suma) || 0; if (s <= 0) continue;
        const label = p?.tip === "fond" ? (p?.denumire || "Fonduri")
          : String(p?.tip ?? "").startsWith("intretinere") ? "Întreținere"
          : (p?.denumire || "Altele");
        add(venituriMap, label, s); parsedVen += s;
      }
    } catch { /* ignore */ }
    try {
      const av = i.avansJson ? JSON.parse(i.avansJson) : null;
      if (Array.isArray(av)) for (const a of av) {
        const s = Number(a?.suma) || 0; if (s <= 0) continue;
        const label = a?.tip === "fond" ? (a?.denumire || "Fonduri") : "Întreținere";
        add(venituriMap, label, s); parsedVen += s;
      }
    } catch { /* ignore */ }
  }
  const remainder = totalVenituri - parsedVen;
  if (remainder > 0.01) add(venituriMap, "Altele", remainder);

  // ── Cheltuieli (din plăți facturi) ──
  const cheltuieliMap = new Map<string, number>();
  let totalCheltuieli = 0;
  for (const p of plati) {
    totalCheltuieli += p.suma;
    const cat = p.factura?.categorie ?? null;
    const label = cat ? (CAT_LABEL[cat.toLowerCase()] ?? cat) : "Altele";
    add(cheltuieliMap, label, p.suma);
  }

  const toRows = (m: Map<string, number>) => [...m.entries()].map(([label, suma]) => ({ label, suma })).sort((a, b) => b.suma - a.suma);

  return NextResponse.json({
    venituri:        toRows(venituriMap),
    totalVenituri,
    cheltuieli:      toRows(cheltuieliMap),
    totalCheltuieli,
    rezultat:        totalVenituri - totalCheltuieli,
  });
}
