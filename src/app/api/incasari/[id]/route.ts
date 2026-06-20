import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { id } = await params;
  const incasare = await db.incasare.findFirst({
    where: { id, organizationId: orgId },
  });
  if (!incasare) return NextResponse.json({ error: "Încasare negăsită" }, { status: 404 });

  const pozitii: { tip: string; suma: number; fondId?: string }[] =
    incasare.pozitiiJson ? JSON.parse(incasare.pozitiiJson) : [];

  // Reverse the payments (storno)
  for (const p of pozitii) {
    if (!p.suma || p.suma <= 0) continue;
    if (p.tip === "intretinere_curenta") {
      await db.soldApartament.updateMany({
        where: { apartamentId: incasare.apartamentId },
        data:  { intretinereCurenta: { increment: p.suma } },
      });
    } else if (p.tip === "intretinere") {
      await db.soldApartament.updateMany({
        where: { apartamentId: incasare.apartamentId },
        data:  { restantaIntretinere: { increment: p.suma } },
      });
    } else if (p.tip === "fond" && p.fondId) {
      await db.fondApartament.updateMany({
        where: { apartamentId: incasare.apartamentId, fondId: p.fondId },
        data:  { restanta: { increment: p.suma } },
      });
    }
  }

  await db.incasare.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
