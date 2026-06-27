import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET — istoricul citirilor pe apartament(e), într-o perioadă (lună/an start–end).
export async function GET(req: NextRequest) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const asociatieId  = sp.get("asociatieId");
  const apartamentId = sp.get("apartamentId"); // gol/"all" = toate
  const lunaStart = parseInt(sp.get("lunaStart") ?? "1");
  const anStart   = parseInt(sp.get("anStart")   ?? "");
  const lunaEnd   = parseInt(sp.get("lunaEnd")   ?? "12");
  const anEnd     = parseInt(sp.get("anEnd")     ?? "");

  if (!asociatieId || isNaN(anStart) || isNaN(anEnd))
    return NextResponse.json({ error: "Parametri lipsă" }, { status: 400 });

  const asoc = await db.asociatie.findFirst({ where: { id: asociatieId, organizationId: orgId }, select: { id: true } });
  if (!asoc) return NextResponse.json({ error: "Asociație negăsită" }, { status: 404 });

  const keyStart = anStart * 100 + lunaStart;
  const keyEnd   = anEnd   * 100 + lunaEnd;

  const contoare = await db.contor.findMany({
    where: {
      asociatieId, organizationId: orgId, isActive: true,
      ...(apartamentId && apartamentId !== "all" ? { apartamentId } : {}),
    },
    select: {
      id: true, tip: true, locatie: true, denumire: true, numarSerie: true,
      apartament: {
        select: {
          id: true, numar: true,
          proprietari: { where: { isMain: true }, include: { proprietar: { select: { nume: true, prenume: true } } }, take: 1 },
        },
      },
      citiri: {
        where:  { an: { gte: anStart, lte: anEnd } },
        select: { luna: true, an: true, valoare: true, valoarePrev: true, consum: true, dataCitire: true, sursa: true },
        orderBy: [{ an: "asc" }, { luna: "asc" }],
      },
    },
  });

  const byAp = new Map<string, { apartamentId: string; numar: string; proprietar: string; contoare: any[] }>();

  for (const c of contoare) {
    const citiri = c.citiri
      .filter(r => { const k = r.an * 100 + r.luna; return k >= keyStart && k <= keyEnd; })
      .map(r => ({
        luna: r.luna, an: r.an,
        indexVechi: r.valoarePrev ?? 0,
        indexNou: r.valoare,
        consum: r.consum ?? Math.max(0, r.valoare - (r.valoarePrev ?? 0)),
        data: r.dataCitire ? r.dataCitire.toISOString() : null,
        sursa: r.sursa,
      }));

    const apId = c.apartament?.id ?? "";
    const apNumar = c.apartament?.numar ?? "—";
    const prop = c.apartament?.proprietari[0]?.proprietar;
    const propNume = prop ? [prop.prenume, prop.nume].filter(Boolean).join(" ") : "";

    if (!byAp.has(apId)) byAp.set(apId, { apartamentId: apId, numar: apNumar, proprietar: propNume, contoare: [] });
    byAp.get(apId)!.contoare.push({
      contorId: c.id, tip: c.tip, locatie: c.locatie, denumire: c.denumire, numarSerie: c.numarSerie ?? "",
      citiri,
      totalConsum: citiri.reduce((s, x) => s + x.consum, 0),
    });
  }

  const apartamente = [...byAp.values()].sort((a, b) =>
    (parseInt(a.numar) || 0) - (parseInt(b.numar) || 0) || a.numar.localeCompare(b.numar));

  return NextResponse.json({ apartamente });
}
