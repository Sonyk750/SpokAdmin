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

  const { soldFonduri } = await req.json() as {
    soldFonduri: { apartamentId: string; fondId: string; restanta: string }[];
  };

  for (const s of soldFonduri) {
    if (!s.apartamentId || !s.fondId) continue;
    const restanta = parseFloat(s.restanta) || 0;
    if (restanta === 0) continue; // nu salvăm 0

    await db.fondApartament.upsert({
      where:  { apartamentId_fondId: { apartamentId: s.apartamentId, fondId: s.fondId } },
      update: { restanta },
      create: {
        apartamentId: s.apartamentId,
        asociatieId:  id,
        fondId:       s.fondId,
        restanta,
      },
    });
  }

  await db.asociatie.update({ where: { id }, data: { wizardStep: 6 } });

  return NextResponse.json({ ok: true });
}
