// GET /api/mobile/proprietar
// Unitățile (apartamentele) deținute de utilizatorul curent, cu soldul.
// Un proprietar e legat de apartament prin AsociatieUser.apartamentId.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getApiUser } from "@/lib/mobile-auth";

export async function GET(req: Request) {
  const user = await getApiUser(req);
  if (!user) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const links = await db.asociatieUser.findMany({
    where: { userId: user.id, isSuspended: false, apartamentId: { not: null } },
    select: { apartamentId: true },
  });
  const apartamentIds = links.map((l) => l.apartamentId!).filter(Boolean);
  if (apartamentIds.length === 0) return NextResponse.json([]);

  const apartamente = await db.apartament.findMany({
    where: { id: { in: apartamentIds }, isActive: true },
    select: {
      id: true,
      numar: true,
      asociatie: { select: { id: true, name: true, cui: true } },
      solduri: { select: { restantaIntretinere: true, intretinereCurenta: true }, take: 1 },
      fonduri: { select: { fondId: true, restanta: true } },
    },
  });

  const result = [];
  for (const ap of apartamente) {
    const fondDefs = await db.fondAsociatie.findMany({
      where: { asociatieId: ap.asociatie.id, isEnabled: true },
      select: { id: true, name: true },
      orderBy: { sortOrder: "asc" },
    });
    const fonduri = fondDefs.map((fd) => ({
      name: fd.name,
      restanta: ap.fonduri.find((f) => f.fondId === fd.id)?.restanta ?? 0,
    }));
    const sold = ap.solduri[0];
    const restanta = sold?.restantaIntretinere ?? 0;
    const curenta = sold?.intretinereCurenta ?? 0;
    const totalFond = fonduri.reduce((s, f) => s + f.restanta, 0);
    result.push({
      asociatie: ap.asociatie,
      apartament: { id: ap.id, numar: ap.numar },
      restantaIntretinere: restanta,
      intretinereCurenta: curenta,
      fonduri,
      total: Math.round((restanta + curenta + totalFond) * 100) / 100,
    });
  }

  return NextResponse.json(result);
}
