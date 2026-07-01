// GET /api/mobile/proprietar/incasari?apartamentId=...
// Istoricul plăților pentru apartamentul proprietarului (verifică deținerea).
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getApiUser } from "@/lib/mobile-auth";

export async function GET(req: NextRequest) {
  const user = await getApiUser(req);
  if (!user) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const apartamentId = req.nextUrl.searchParams.get("apartamentId");
  if (!apartamentId) return NextResponse.json({ error: "Parametri lipsă" }, { status: 400 });

  // Verificăm că utilizatorul e legat de acest apartament.
  const link = await db.asociatieUser.findFirst({
    where: { userId: user.id, apartamentId, isSuspended: false },
    select: { id: true },
  });
  if (!link) return NextResponse.json({ error: "Acces interzis" }, { status: 403 });

  const incasari = await db.incasare.findMany({
    where: { apartamentId },
    orderBy: [{ data: "desc" }, { numarDocument: "desc" }],
    take: 50,
    select: { id: true, data: true, serie: true, numarDocument: true, sumaIncasata: true, tipDocument: true },
  });

  return NextResponse.json(
    incasari.map((i) => ({ ...i, data: i.data.toISOString() })),
  );
}
