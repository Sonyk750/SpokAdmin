import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  const orgId   = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const asociatieId = req.nextUrl.searchParams.get("asociatieId");
  if (!asociatieId) return NextResponse.json({ error: "asociatieId lipsă" }, { status: 400 });

  const asociatie = await db.asociatie.findFirst({
    where: { id: asociatieId, organizationId: orgId },
    select: { id: true },
  });
  if (!asociatie) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const apartamente = await db.apartament.findMany({
    where:   { asociatieId, organizationId: orgId, isActive: true },
    orderBy: { numar: "asc" },
    select: {
      id:    true,
      numar: true,
      proprietari: {
        select: {
          isMain: true,
          proprietar: {
            select: {
              id:           true,
              prenume:      true,
              nume:         true,
              telefon:      true,
              emailuriJson: true,
            },
          },
        },
      },
    },
  });

  const rows = apartamente.flatMap(ap =>
    ap.proprietari.map(lnk => {
      let emailuri: string[] = [];
      try {
        const raw = lnk.proprietar.emailuriJson;
        if (raw) emailuri = JSON.parse(raw);
      } catch {}
      return {
        proprietarId:  lnk.proprietar.id,
        prenume:       lnk.proprietar.prenume,
        nume:          lnk.proprietar.nume,
        telefon:       lnk.proprietar.telefon,
        emailuri,
        apartamentNr:  `Ap. ${ap.numar}`,
        apartamentId:  ap.id,
        isMain:        lnk.isMain,
      };
    })
  );

  return NextResponse.json(rows);
}
