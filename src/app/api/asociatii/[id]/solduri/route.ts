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

  const { solduri } = await req.json() as {
    solduri: {
      apartamentId:        string;
      restantaIntretinere: string;
      restantaCurenta:     string;
    }[];
  };

  for (const s of solduri) {
    if (!s.apartamentId) continue;
    const restanta  = parseFloat(s.restantaIntretinere) || 0;
    const curenta   = parseFloat(s.restantaCurenta)     || 0;

    await db.soldApartament.upsert({
      where:  { apartamentId: s.apartamentId },
      update: { restantaIntretinere: restanta, intretinereCurenta: curenta },
      create: {
        apartamentId:        s.apartamentId,
        asociatieId:         id,
        restantaIntretinere: restanta,
        intretinereCurenta:  curenta,
      },
    });
  }

  await db.asociatie.update({ where: { id }, data: { wizardStep: 4 } });

  return NextResponse.json({ ok: true });
}
