import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { computeAcoperit, getAvansSold } from "@/lib/avans-furnizor";

// Fișă furnizor — extras pe furnizor: facturi, plăți, sold curent.
export async function GET(req: NextRequest) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const asociatieId = searchParams.get("asociatieId");
  const furnizorId  = searchParams.get("furnizorId");
  const dataStart   = searchParams.get("dataStart");
  const dataEnd     = searchParams.get("dataEnd");
  if (!asociatieId || !furnizorId || !dataStart || !dataEnd)
    return NextResponse.json({ error: "Parametri lipsă" }, { status: 400 });

  const furnizor = await db.furnizor.findFirst({
    where:  { id: furnizorId, organizationId: orgId },
    select: { id: true, nume: true, cui: true, telefon: true, email: true },
  });
  if (!furnizor) return NextResponse.json({ error: "Furnizor negăsit" }, { status: 404 });

  const start = new Date(dataStart);
  const end   = new Date(dataEnd + "T23:59:59");

  // Toate facturile furnizorului în asociație (cu plățile lor) — pentru sold all-time
  const facturiAll = await db.factura.findMany({
    where:  { furnizorId, asociatieId, organizationId: orgId },
    select: { id: true, serie: true, numar: true, valoare: true, status: true, categorie: true, dataEmiterii: true, createdAt: true,
      plati:        { select: { id: true, suma: true, data: true, metoda: true } },
      avansMiscari: { select: { suma: true } } },
  });

  let allFacturat = 0, allPlatit = 0;
  for (const f of facturiAll) {
    allFacturat += f.valoare;
    for (const p of f.plati) allPlatit += p.suma; // numerar real (avansul se anulează în sold)
  }
  const soldCurent = allFacturat - allPlatit;
  const avansSold  = await getAvansSold(db, asociatieId, furnizorId);

  // Facturi în perioadă (după data emiterii sau, în lipsă, data creării)
  const facturiPerioada = facturiAll
    .map(f => {
      const dataEff = f.dataEmiterii ?? f.createdAt;
      const platit = computeAcoperit(f.plati, f.avansMiscari);
      return { id: f.id, data: dataEff, document: [f.serie, f.numar].filter(Boolean).join(" ") || "—", categorie: f.categorie, valoare: f.valoare, platit, rest: Math.round((f.valoare - platit) * 100) / 100, status: f.status };
    })
    .filter(f => f.data >= start && f.data <= end)
    .sort((a, b) => a.data.getTime() - b.data.getTime());

  // Plăți în perioadă
  const plati = facturiAll.flatMap(f =>
    f.plati.filter(p => p.data >= start && p.data <= end).map(p => ({
      id: p.id, data: p.data, suma: p.suma, metoda: p.metoda,
      document: [f.serie, f.numar].filter(Boolean).join(" ") || "—",
    }))
  ).sort((a, b) => a.data.getTime() - b.data.getTime());

  return NextResponse.json({
    furnizor: { nume: furnizor.nume, cui: furnizor.cui, telefon: furnizor.telefon, email: furnizor.email },
    totalFacturat: facturiPerioada.reduce((s, f) => s + f.valoare, 0),
    totalPlatit:   plati.reduce((s, p) => s + p.suma, 0),
    soldCurent,
    avansSold,
    facturi: facturiPerioada.map(f => ({ ...f, data: f.data.toISOString() })),
    plati:   plati.map(p => ({ ...p, data: p.data.toISOString() })),
  });
}
