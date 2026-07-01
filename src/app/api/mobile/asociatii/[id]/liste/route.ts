// GET /api/mobile/asociatii/[id]/liste
// Lunile care au listă de plată (facturi distribuite sau ListaLuna generată).
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

  // Lunile cu facturi distribuite (lista se calculează din ele).
  const facturi = await db.factura.findMany({
    where: { asociatieId: id, distribuireJson: { not: null } },
    select: { luna: true, an: true },
    distinct: ["luna", "an"],
  });

  // Plus lunile din ListaLuna, dacă există (cu status).
  const liste = await db.listaLuna.findMany({
    where: { asociatieId: id },
    select: { luna: true, an: true, status: true },
  });

  const map = new Map<string, { luna: number; an: number; status: string }>();
  for (const f of facturi) {
    if (f.luna == null || f.an == null) continue;
    map.set(`${f.an}-${f.luna}`, { luna: f.luna, an: f.an, status: "publicata" });
  }
  for (const l of liste) map.set(`${l.an}-${l.luna}`, { luna: l.luna, an: l.an, status: l.status });

  const rezultat = [...map.values()].sort((a, b) => b.an - a.an || b.luna - a.luna);
  return NextResponse.json(rezultat);
}
