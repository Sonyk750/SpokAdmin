// GET /api/mobile/asociatii/[id]/apartamente
// Lista apartamentelor unei asociații, cu proprietarul principal și soldul
// (restanță + întreținere curentă). Pentru ecranul de încasare al casierului.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getApiUser } from "@/lib/mobile-auth";
import { resolveAccess, can } from "@/lib/access";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser(req);
  if (!user) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { id } = await params;
  const access = await resolveAccess(user, id);
  // Casierul are dreptul `lista_plata`; adminii trec prin isAdmin.
  if (!can(access, "lista_plata")) {
    return NextResponse.json({ error: "Acces interzis la această asociație." }, { status: 403 });
  }

  const apartamente = await db.apartament.findMany({
    where: { asociatieId: id, isActive: true },
    select: {
      id: true,
      numar: true,
      scara: true,
      etaj: true,
      solduri: { select: { restantaIntretinere: true, intretinereCurenta: true }, take: 1 },
      proprietari: {
        where: { isMain: true },
        select: { proprietar: { select: { nume: true, prenume: true } } },
        take: 1,
      },
    },
  });

  const lista = apartamente.map((a) => {
    const sold = a.solduri[0];
    const restanta = sold?.restantaIntretinere ?? 0;
    const curenta = sold?.intretinereCurenta ?? 0;
    const p = a.proprietari[0]?.proprietar;
    const proprietarNume = p ? [p.nume, p.prenume].filter(Boolean).join(" ") : null;
    return {
      id: a.id,
      numar: a.numar,
      scara: a.scara,
      etaj: a.etaj,
      proprietarNume,
      restantaIntretinere: restanta,
      intretinereCurenta: curenta,
      total: Math.round((restanta + curenta) * 100) / 100,
    };
  });

  // Sortare numerică după numărul apartamentului (1, 2, 10 — nu 1, 10, 2).
  lista.sort((x, y) => x.numar.localeCompare(y.numar, "ro", { numeric: true }));

  return NextResponse.json({ apartamente: lista });
}
