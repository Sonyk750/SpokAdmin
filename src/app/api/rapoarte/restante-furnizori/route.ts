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

  const furnizoriAsoc = await db.furnizorAsociatie.findMany({
    where: { asociatieId },
    select: {
      furnizor: {
        select: {
          id: true, nume: true, cui: true, telefon: true,
          facturi: {
            where: { asociatieId },
            select: {
              valoare: true,
              plati: { select: { suma: true } },
            },
          },
        },
      },
    },
  });

  const rows = furnizoriAsoc.map(fa => {
    const f = fa.furnizor;
    let totalFacturat = 0;
    let totalPlatit   = 0;
    for (const fct of f.facturi) {
      totalFacturat += fct.valoare;
      for (const p of fct.plati) totalPlatit += p.suma;
    }
    const sold = Math.round((totalFacturat - totalPlatit) * 100) / 100;
    return { id: f.id, nume: f.nume, cui: f.cui, telefon: f.telefon, totalFacturat, totalPlatit, sold };
  }).filter(r => Math.abs(r.sold) > 0.009);

  rows.sort((a, b) => b.sold - a.sold);

  return NextResponse.json(rows);
}
