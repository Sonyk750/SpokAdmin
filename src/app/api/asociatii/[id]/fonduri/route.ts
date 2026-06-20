import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

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
