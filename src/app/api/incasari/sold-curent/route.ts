import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/mobile-auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const user = await getApiUser(req);
  const orgId = user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const apartamentId = searchParams.get("apartamentId");
  const asociatieId  = searchParams.get("asociatieId");

  if (!apartamentId || !asociatieId)
    return NextResponse.json({ error: "Parametri lipsă" }, { status: 400 });

  const ap = await db.apartament.findFirst({
    where: { id: apartamentId, asociatieId, organizationId: orgId },
    include: {
      proprietari: { where: { isMain: true }, include: { proprietar: { select: { nume: true, prenume: true } } }, take: 1 },
      solduri: { select: { restantaIntretinere: true, intretinereCurenta: true } },
      fonduri: { select: { fondId: true, restanta: true } },
    },
  });
  if (!ap) return NextResponse.json({ error: "Apartament negăsit" }, { status: 404 });

  const fonduri = await db.fondAsociatie.findMany({
    where: { asociatieId, isEnabled: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });

  const sold = ap.solduri[0];
  const prop = ap.proprietari[0]?.proprietar;

  return NextResponse.json({
    numar:               ap.numar,
    proprietarNume:      prop ? [prop.prenume, prop.nume].filter(Boolean).join(" ") || prop.nume : null,
    restantaIntretinere: sold?.restantaIntretinere ?? 0,
    intretinereCurenta:  sold?.intretinereCurenta  ?? 0,
    fonduri: fonduri.map(f => ({
      id:       f.id,
      name:     f.name,
      restanta: ap.fonduri.find(fa => fa.fondId === f.id)?.restanta ?? 0,
    })),
  });
}
