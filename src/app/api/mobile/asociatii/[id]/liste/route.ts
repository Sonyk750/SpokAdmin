// GET /api/mobile/asociatii/[id]/liste
// Lunile care au listă de plată generată (pentru selectoarele mobile).
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getApiUser } from "@/lib/mobile-auth";
import { resolveAccess, can } from "@/lib/access";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser(req);
  if (!user) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { id } = await params;
  const access = await resolveAccess(user, id);
  if (!can(access, "lista_plata") && !can(access, "explicatii")) {
    return NextResponse.json({ error: "Acces interzis" }, { status: 403 });
  }

  const liste = await db.listaLuna.findMany({
    where: { asociatieId: id },
    orderBy: [{ an: "desc" }, { luna: "desc" }],
    select: { luna: true, an: true, status: true },
  });

  return NextResponse.json(liste);
}
