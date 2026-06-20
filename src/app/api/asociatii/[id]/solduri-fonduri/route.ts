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

  const { solduriFonduri } = await req.json() as {
    solduriFonduri: { apartamentId: string; fondId: string; sold: string }[];
  };

  for (const s of solduriFonduri) {
    if (!s.apartamentId || !s.fondId) continue;
    const sold = parseFloat(s.sold) || 0;

    await db.fondApartament.upsert({
      where:  { apartamentId_fondId: { apartamentId: s.apartamentId, fondId: s.fondId } },
      update: { sold },
      create: {
        apartamentId: s.apartamentId,
        asociatieId:  id,
        fondId:       s.fondId,
        sold,
        restanta:     0,
      },
    });
  }

  await db.asociatie.update({ where: { id }, data: { wizardStep: 7 } });

  return NextResponse.json({ ok: true });
}
