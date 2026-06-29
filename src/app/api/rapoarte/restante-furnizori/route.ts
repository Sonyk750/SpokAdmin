import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const asociatieId = req.nextUrl.searchParams.get("asociatieId");
  if (!asociatieId) return NextResponse.json({ error: "Parametri lipsă" }, { status: 400 });

  const asoc = await db.asociatie.findFirst({ where: { id: asociatieId, organizationId: orgId }, select: { id: true } });
  if (!asoc) return NextResponse.json({ error: "Asociație negăsită" }, { status: 404 });

  // Toate facturile asociației cu furnizori (indiferent de status sau perioadă)
  const facturi = await db.factura.findMany({
    where: { asociatieId, organizationId: orgId, furnizorId: { not: null } },
    select: {
      furnizorId: true,
      valoare: true,
      plati: { select: { suma: true } },
    },
  });

  // Furnizorii legați de asociație
  const furnizoriAsoc = await db.furnizorAsociatie.findMany({
    where: { asociatieId },
    select: {
      furnizor: { select: { id: true, nume: true, cui: true, telefon: true } },
    },
  });

  // Sold per furnizor
  const soldMap = new Map<string, { facturat: number; platit: number }>();
  for (const f of facturi) {
    if (!f.furnizorId) continue;
    const entry = soldMap.get(f.furnizorId) ?? { facturat: 0, platit: 0 };
    entry.facturat += f.valoare;
    for (const p of f.plati) entry.platit += p.suma;
    soldMap.set(f.furnizorId, entry);
  }

  const rows = furnizoriAsoc.map(fa => {
    const f    = fa.furnizor;
    const s    = soldMap.get(f.id) ?? { facturat: 0, platit: 0 };
    const sold = Math.round((s.facturat - s.platit) * 100) / 100;
    return { id: f.id, nume: f.nume, cui: f.cui, telefon: f.telefon, totalFacturat: s.facturat, totalPlatit: s.platit, sold };
  }).filter(r => Math.abs(r.sold) > 0.009);

  rows.sort((a, b) => b.sold - a.sold);

  return NextResponse.json(rows);
}
