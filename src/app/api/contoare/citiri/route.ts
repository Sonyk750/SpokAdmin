import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET — contoarele asociației pentru luna/an, cu index vechi (din ultima citire) și index nou (dacă există)
export async function GET(req: NextRequest) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const asociatieId = searchParams.get("asociatieId");
  const luna = parseInt(searchParams.get("luna") ?? "");
  const an   = parseInt(searchParams.get("an") ?? "");
  if (!asociatieId || isNaN(luna) || isNaN(an))
    return NextResponse.json({ error: "Parametri lipsă" }, { status: 400 });

  const asoc = await db.asociatie.findFirst({ where: { id: asociatieId, organizationId: orgId }, select: { id: true } });
  if (!asoc) return NextResponse.json({ error: "Asociație negăsită" }, { status: 404 });

  const contoare = await db.contor.findMany({
    where:  { asociatieId, organizationId: orgId, isActive: true },
    select: {
      id: true, tip: true, locatie: true, denumire: true, numarSerie: true,
      apartament: { select: { id: true, numar: true } },
      citiri: { select: { luna: true, an: true, valoare: true, valoarePrev: true } },
    },
  });

  const before = (c: { luna: number; an: number }) => c.an < an || (c.an === an && c.luna < luna);

  const byAp = new Map<string, { apartamentId: string; numar: string; contoare: any[] }>();
  for (const c of contoare) {
    const existing = c.citiri.find(x => x.luna === luna && x.an === an);
    const prev = c.citiri.filter(before).sort((a, b) => b.an - a.an || b.luna - a.luna)[0];
    const indexVechi = existing?.valoarePrev ?? prev?.valoare ?? 0;
    const indexNou = existing ? existing.valoare : null;

    const apNumar = c.apartament?.numar ?? "—";
    const apId = c.apartament?.id ?? "";
    if (!byAp.has(apNumar)) byAp.set(apNumar, { apartamentId: apId, numar: apNumar, contoare: [] });
    byAp.get(apNumar)!.contoare.push({
      contorId: c.id, tip: c.tip, locatie: c.locatie, denumire: c.denumire, numarSerie: c.numarSerie ?? "",
      indexVechi, indexNou,
    });
  }

  const apartamente = [...byAp.values()].sort((a, b) =>
    (parseInt(a.numar) || 0) - (parseInt(b.numar) || 0) || a.numar.localeCompare(b.numar));

  return NextResponse.json({ apartamente });
}

// POST — salvează citirile (upsert pe contor/luna/an)
export async function POST(req: NextRequest) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const body = await req.json();
  const { asociatieId, luna, an, citiri } = body as {
    asociatieId?: string; luna?: number; an?: number;
    citiri?: { contorId: string; numarSerie?: string; indexVechi: string | number; indexNou: string | number }[];
  };

  if (!asociatieId || !luna || !an || !Array.isArray(citiri))
    return NextResponse.json({ error: "Date incomplete" }, { status: 400 });

  const asoc = await db.asociatie.findFirst({ where: { id: asociatieId, organizationId: orgId }, select: { id: true } });
  if (!asoc) return NextResponse.json({ error: "Asociație negăsită" }, { status: 404 });

  // contoarele valide ale asociației (securitate)
  const contoareIds = new Set((await db.contor.findMany({
    where: { asociatieId, organizationId: orgId }, select: { id: true },
  })).map(c => c.id));

  let salvate = 0;
  for (const r of citiri) {
    if (!contoareIds.has(r.contorId)) continue;
    const vechi = typeof r.indexVechi === "number" ? r.indexVechi : parseFloat(String(r.indexVechi)) || 0;
    const nouRaw = typeof r.indexNou === "number" ? r.indexNou : parseFloat(String(r.indexNou));
    const serie = r.numarSerie?.toString().trim();

    if (serie) await db.contor.update({ where: { id: r.contorId }, data: { numarSerie: serie } });

    // dacă nu s-a introdus index nou, nu salvăm citirea
    if (isNaN(nouRaw)) continue;

    await db.citireContor.upsert({
      where:  { contorId_luna_an: { contorId: r.contorId, luna, an } },
      update: { valoare: nouRaw, valoarePrev: vechi, consum: Math.max(0, nouRaw - vechi), sursa: "manual" },
      create: { contorId: r.contorId, valoare: nouRaw, valoarePrev: vechi, consum: Math.max(0, nouRaw - vechi), luna, an, sursa: "manual" },
    });
    salvate++;
  }

  return NextResponse.json({ ok: true, salvate });
}
