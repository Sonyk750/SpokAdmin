import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const asociatie = await db.asociatie.findFirst({
    where: { id, organizationId: session.user.organizationId },
    select: { id: true },
  });
  if (!asociatie) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { searchParams } = req.nextUrl;
  const luna = parseInt(searchParams.get("luna") ?? "");
  const an   = parseInt(searchParams.get("an")   ?? "");
  const withConsum = !isNaN(luna) && !isNaN(an);

  const apartamente = await db.apartament.findMany({
    where:   { asociatieId: id, isActive: true },
    orderBy: { numar: "asc" },
    select: {
      id: true, numar: true, scara: true, nrPersone: true, cotaParte: true, suprafata: true,
      proprietari: {
        where:   { isMain: true },
        include: { proprietar: { select: { nume: true, prenume: true } } },
        take:    1,
      },
      ...(withConsum ? {
        contoare: {
          where:  { isActive: true },
          select: {
            tip: true,
            citiri: {
              where:  { luna, an },
              select: { consum: true, valoare: true, valoarePrev: true },
              take:   1,
            },
          },
        },
      } : {}),
    },
  });

  return NextResponse.json({
    apartamente: apartamente.map((ap: any) => {
      const p = ap.proprietari[0]?.proprietar;
      const consumByTip: Record<string, number> = {};
      if (withConsum && ap.contoare) {
        for (const contor of ap.contoare) {
          const citire = contor.citiri?.[0];
          if (!citire) continue;
          let val = citire.consum;
          if (val === null && citire.valoare !== null && citire.valoarePrev !== null) {
            val = citire.valoare - citire.valoarePrev;
          }
          if (val !== null && val >= 0) {
            consumByTip[contor.tip] = (consumByTip[contor.tip] ?? 0) + val;
          }
        }
      }
      return {
        id:          ap.id,
        numar:       ap.numar,
        scara:       ap.scara ?? null,
        nrPersone:   ap.nrPersone,
        cotaParte:   ap.cotaParte,
        suprafata:   ap.suprafata,
        proprietar:  p ? [p.prenume, p.nume].filter(Boolean).join(" ") : "",
        consumByTip,
      };
    }),
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const asociatie = await db.asociatie.findFirst({
    where: { id, organizationId: session.user.organizationId },
  });
  if (!asociatie) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { apartamente } = await req.json() as {
    apartamente: {
      numar: string;
      scara: string;
      etaj: string;
      suprafata: string;
      nrPersone: string;
      cotaParte: string;
    }[];
  };

  const orgId = session.user.organizationId;
  const results: { id: string; numar: string }[] = [];

  for (const ap of apartamente) {
    if (!ap.numar.trim()) continue;

    const data = {
      asociatieId:    id,
      organizationId: orgId,
      numar:          ap.numar.trim(),
      scara:          ap.scara || null,
      etaj:           ap.etaj ? parseInt(ap.etaj) : null,
      suprafata:      ap.suprafata ? parseFloat(ap.suprafata) : null,
      nrPersone:      ap.nrPersone ? parseInt(ap.nrPersone) : 1,
      cotaParte:      ap.cotaParte ? parseFloat(ap.cotaParte) : null,
    };

    const upserted = await db.apartament.upsert({
      where:  { asociatieId_numar: { asociatieId: id, numar: ap.numar.trim() } },
      update: data,
      create: data,
    });

    results.push({ id: upserted.id, numar: upserted.numar });
  }

  await db.asociatie.update({
    where: { id },
    data:  { wizardStep: 2, nrApartamente: results.length }, // step 2 = apartamente
  });

  return NextResponse.json({ apartamente: results });
}
