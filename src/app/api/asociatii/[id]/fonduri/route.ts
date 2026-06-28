import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

function contribFond(pozitiiJson: string | null, avansJson: string | null, fondId: string): number {
  let sum = 0;
  try {
    const poz = pozitiiJson ? JSON.parse(pozitiiJson) : [];
    if (Array.isArray(poz)) for (const p of poz) if (p?.tip === "fond" && p?.fondId === fondId) sum += Number(p.suma) || 0;
  } catch { /* ignore */ }
  try {
    const av = avansJson ? JSON.parse(avansJson) : null;
    if (Array.isArray(av)) for (const a of av) if (a?.tip === "fond" && a?.fondId === fondId) sum += Number(a.suma) || 0;
  } catch { /* ignore */ }
  return sum;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = session.user.organizationId;
  const { id } = await params;
  const asociatie = await db.asociatie.findFirst({
    where:  { id, organizationId: orgId },
    select: { id: true, wizardData: true },
  });
  if (!asociatie) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const fonduri = await db.fondAsociatie.findMany({
    where:   { asociatieId: id, isEnabled: true },
    orderBy: { sortOrder: "asc" },
    select:  { id: true, name: true },
  });
  if (fonduri.length === 0) return NextResponse.json([]);

  const fondIds = fonduri.map(f => f.id);

  // 1. Sold inițial per apartament
  const soldAgg = await db.fondApartament.groupBy({
    by: ["fondId"],
    where: { asociatieId: id, fondId: { in: fondIds } },
    _sum:  { sold: true },
  });
  const soldByFond = new Map(soldAgg.map(r => [r.fondId, r._sum.sold ?? 0]));

  // 2. soldFondAsoc din wizardData (fallback pentru fonduri fără date per-apartament)
  const soldAsocByFond = new Map<string, number>();
  try {
    const wd = asociatie.wizardData ? JSON.parse(asociatie.wizardData) : {};
    if (Array.isArray(wd.soldFondAsoc)) {
      for (const sf of wd.soldFondAsoc) {
        if (sf.fondId) soldAsocByFond.set(sf.fondId, parseFloat(sf.sold) || 0);
      }
    }
  } catch { /* ignore */ }

  // 3. Contribuții din încasări (ce au plătit proprietarii la fond)
  const apIds = (await db.apartament.findMany({
    where:  { asociatieId: id, organizationId: orgId, isActive: true },
    select: { id: true },
  })).map(a => a.id);

  const incasari = apIds.length
    ? await db.incasare.findMany({
        where:  { apartamentId: { in: apIds }, organizationId: orgId },
        select: { pozitiiJson: true, avansJson: true },
      })
    : [];

  const contribByFond = new Map<string, number>();
  for (const inc of incasari) {
    for (const fondId of fondIds) {
      const c = contribFond(inc.pozitiiJson, inc.avansJson, fondId);
      if (c) contribByFond.set(fondId, (contribByFond.get(fondId) ?? 0) + c);
    }
  }

  // 4. Plăți efectuate DIN fond
  const platiAgg = await db.plata.groupBy({
    by:    ["fondId"],
    where: { fondId: { in: fondIds }, factura: { asociatieId: id } },
    _sum:  { suma: true },
  });
  const platiByFond = new Map(platiAgg.map(r => [r.fondId!, r._sum.suma ?? 0]));

  // 4b. Facturi ALOCATE pe fond (acoperite din fond, nedistribuite) — reduc soldul fondului
  const facturiAgg = await db.factura.groupBy({
    by:    ["fondId"],
    where: { fondId: { in: fondIds }, asociatieId: id, organizationId: orgId },
    _sum:  { valoare: true },
  });
  const facturiByFond = new Map(facturiAgg.map(r => [r.fondId!, r._sum.valoare ?? 0]));

  // 5. Sold curent = inițial + contribuții - plăți din fond - facturi alocate pe fond
  const result = fonduri.map(f => {
    const initial = (soldByFond.get(f.id) ?? 0) || (soldAsocByFond.get(f.id) ?? 0);
    const contrib = contribByFond.get(f.id) ?? 0;
    const plati   = platiByFond.get(f.id) ?? 0;
    const facturi = facturiByFond.get(f.id) ?? 0;
    return { id: f.id, name: f.name, sold: initial + contrib - plati - facturi };
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const asociatie = await db.asociatie.findFirst({
    where: { id, organizationId: session.user.organizationId },
  });
  if (!asociatie) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { fonduri } = await req.json() as {
    fonduri: { id?: string; name: string; isEnabled: boolean; sortOrder: number }[];
  };

  // Upsert fonds with known IDs (preserves FondApartament links via cascade),
  // create new ones without IDs. Then delete only fonds removed from the list.
  const savedIds: string[] = [];

  for (const f of fonduri) {
    if (f.id) {
      await db.fondAsociatie.upsert({
        where:  { id: f.id },
        update: { name: f.name, isEnabled: f.isEnabled, sortOrder: f.sortOrder },
        create: { id: f.id, asociatieId: id, name: f.name, isEnabled: f.isEnabled, sortOrder: f.sortOrder },
      });
      savedIds.push(f.id);
    } else {
      const created = await db.fondAsociatie.create({
        data: { asociatieId: id, name: f.name, isEnabled: f.isEnabled, sortOrder: f.sortOrder },
      });
      savedIds.push(created.id);
    }
  }

  // Only delete fonduri that were explicitly removed by the user
  if (savedIds.length > 0) {
    await db.fondAsociatie.deleteMany({
      where: { asociatieId: id, id: { notIn: savedIds } },
    });
  } else {
    await db.fondAsociatie.deleteMany({ where: { asociatieId: id } });
  }

  const saved = await db.fondAsociatie.findMany({
    where:   { asociatieId: id },
    orderBy: { sortOrder: "asc" },
  });

  await db.asociatie.update({ where: { id }, data: { wizardStep: 5 } });

  return NextResponse.json({ fonduri: saved });
}
