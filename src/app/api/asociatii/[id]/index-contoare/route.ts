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

  const { indecsi } = await req.json() as {
    indecsi: { contorId: string; numarSerie?: string; indexVechi: string; indexNou: string }[];
  };

  const now  = new Date();
  const luna = now.getMonth() + 1;
  const an   = now.getFullYear();

  for (const r of indecsi) {
    const vechi = parseFloat(r.indexVechi) || 0;
    const nou   = parseFloat(r.indexNou)   || 0;

    // Salvăm seria pe contor dacă a fost introdusă
    if (r.numarSerie?.trim()) {
      await db.contor.update({
        where: { id: r.contorId },
        data:  { numarSerie: r.numarSerie.trim() },
      });
    }

    if (vechi === 0 && nou === 0) continue;

    await db.citireContor.upsert({
      where:  { contorId_luna_an: { contorId: r.contorId, luna, an } },
      update: { valoare: nou, valoarePrev: vechi, consum: Math.max(0, nou - vechi), sursa: "manual" },
      create: { contorId: r.contorId, valoare: nou, valoarePrev: vechi, consum: Math.max(0, nou - vechi), luna, an, sursa: "manual" },
    });
  }

  await db.asociatie.update({ where: { id }, data: { wizardStep: 9 } });

  return NextResponse.json({ ok: true });
}
