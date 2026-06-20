import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { id } = await params;
  const noReverse = req.nextUrl.searchParams.get("noReverse") === "true";

  const incasare = await db.incasare.findFirst({
    where: { id, organizationId: orgId },
  });
  if (!incasare) return NextResponse.json({ error: "Încasare negăsită" }, { status: 404 });

  if (!noReverse) {
    const pozitii: { tip: string; suma: number; fondId?: string }[] =
      incasare.pozitiiJson ? JSON.parse(incasare.pozitiiJson) : [];

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

    // Reverse avans allocations
    const avansItems: { tip: string; suma: number; fondId?: string }[] =
      incasare.avansJson ? JSON.parse(incasare.avansJson) : [];

    for (const a of avansItems) {
      if (!a.suma || a.suma <= 0) continue;
      if (a.tip === "intretinere") {
        await db.soldApartament.updateMany({
          where: { apartamentId: incasare.apartamentId },
          data:  { intretinereCurenta: { increment: a.suma } },
        });
      } else if (a.tip === "fond" && a.fondId) {
        await db.fondApartament.updateMany({
          where: { apartamentId: incasare.apartamentId, fondId: a.fondId },
          data:  { restanta: { increment: a.suma } },
        });
      }
    }
  }

  await db.incasare.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { id } = await params;
  const incasare = await db.incasare.findFirst({
    where: { id, organizationId: orgId },
  });
  if (!incasare) return NextResponse.json({ error: "Încasare negăsită" }, { status: 404 });

  const { data, serie, numarDocument, tipDocument, tipPlata, observatii } = await req.json();

  const updated = await db.incasare.update({
    where: { id },
    data: {
      ...(data        ? { data: new Date(data) } : {}),
      ...(serie       !== undefined ? { serie }        : {}),
      ...(numarDocument !== undefined ? { numarDocument: Number(numarDocument) } : {}),
      ...(tipDocument !== undefined ? { tipDocument }  : {}),
      ...(tipPlata    !== undefined ? { tipPlata }     : {}),
      ...(observatii  !== undefined ? { observatii }   : {}),
    },
  });

  return NextResponse.json({ ok: true, id: updated.id });
}
