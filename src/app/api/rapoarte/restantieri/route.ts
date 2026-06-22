import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Restanțieri — apartamentele cu datorii (întreținere + fonduri), situație la zi.
export async function GET(req: NextRequest) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const asociatieId = req.nextUrl.searchParams.get("asociatieId");
  if (!asociatieId) return NextResponse.json({ error: "Parametri lipsă" }, { status: 400 });

  const asoc = await db.asociatie.findFirst({ where: { id: asociatieId, organizationId: orgId }, select: { id: true } });
  if (!asoc) return NextResponse.json({ error: "Asociație negăsită" }, { status: 404 });

  const apartamente = await db.apartament.findMany({
    where:   { asociatieId, isActive: true },
    orderBy: { numar: "asc" },
    select: {
      id: true, numar: true,
      proprietari: { where: { isMain: true }, include: { proprietar: { select: { nume: true, prenume: true, telefon: true } } }, take: 1 },
      solduri: { select: { restantaIntretinere: true, intretinereCurenta: true } },
      fonduri: { select: { restanta: true } },
    },
  });

  const rows = apartamente.map(ap => {
    const p = ap.proprietari[0]?.proprietar;
    const sold = ap.solduri[0];
    const restInt = (sold?.restantaIntretinere ?? 0) + (sold?.intretinereCurenta ?? 0);
    const restFond = ap.fonduri.reduce((s, f) => s + (f.restanta ?? 0), 0);
    const total = restInt + restFond;
    return {
      id:        ap.id,
      numar:     ap.numar,
      proprietar: p ? [p.prenume, p.nume].filter(Boolean).join(" ") : "",
      telefon:   p?.telefon ?? null,
      intretinere: restInt,
      fonduri:   restFond,
      total,
    };
  }).filter(r => r.total > 0.009);

  return NextResponse.json(rows);
}
