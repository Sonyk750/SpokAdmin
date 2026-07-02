import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPerioadaCurenta, computeIntretinereLuna, nextMonth } from "@/lib/perioada";

const r2 = (v: number) => Math.round(v * 100) / 100;

async function ownedAsociatie(orgId: string, id: string) {
  return db.asociatie.findFirst({ where: { id, organizationId: orgId }, select: { id: true, organizationId: true } });
}

// POST — închide lista perioadei curente: reportează întreținerea în restanță + snapshot
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { id } = await params;
  const asoc = await ownedAsociatie(orgId, id);
  if (!asoc) return NextResponse.json({ error: "Asociație negăsită" }, { status: 404 });

  const { luna, an } = await req.json().catch(() => ({}));
  if (!luna || !an) return NextResponse.json({ error: "Parametri lipsă" }, { status: 400 });

  // Poți închide doar perioada curentă
  const curenta = await getPerioadaCurenta(id);
  if (luna !== curenta.luna || an !== curenta.an) {
    return NextResponse.json({ error: `Poți închide doar perioada curentă (${curenta.luna}/${curenta.an}).` }, { status: 400 });
  }

  // Idempotent: nu reînchide o lună deja închisă
  const existing = await db.listaLuna.findUnique({
    where:  { asociatieId_luna_an: { asociatieId: id, luna, an } },
    select: { status: true, confirmContabilAt: true, confirmPresedinteAt: true, confirmCenzorAt: true },
  });
  if (existing?.status === "inchisa") {
    return NextResponse.json({ error: "Lista acestei luni este deja închisă." }, { status: 409 });
  }

  // Închiderea (bifa Șef departament contabil) e ultimul pas — necesită confirmarea
  // prealabilă a Contabilului, Președintelui și Cenzorului.
  if (!existing?.confirmContabilAt || !existing?.confirmPresedinteAt || !existing?.confirmCenzorAt) {
    return NextResponse.json({ error: "Lista trebuie confirmată de Contabil, Președinte și Cenzor înainte de închidere." }, { status: 400 });
  }

  const [chargeByAp, apartamente] = await Promise.all([
    computeIntretinereLuna(id, luna, an),
    db.apartament.findMany({
      where:  { asociatieId: id, isActive: true },
      select: {
        id: true, numar: true, nrPersone: true, suprafata: true, cotaParte: true,
        solduri:     { select: { restantaIntretinere: true, intretinereCurenta: true } },
        proprietari: { where: { isMain: true }, take: 1, include: { proprietar: { select: { nume: true, prenume: true } } } },
      },
    }),
  ]);

  const totalCheltuieli = r2([...chargeByAp.values()].reduce((s, v) => s + v, 0));

  await db.$transaction(async (tx) => {
    const lista = await tx.listaLuna.upsert({
      where:  { asociatieId_luna_an: { asociatieId: id, luna, an } },
      create: { organizationId: orgId, asociatieId: id, luna, an, status: "inchisa", inchisaAt: new Date(), totalCheltuieli },
      update: { status: "inchisa", inchisaAt: new Date(), totalCheltuieli },
    });
    await tx.listaLunaApartament.deleteMany({ where: { listaId: lista.id } });

    for (const ap of apartamente) {
      const charge = r2(chargeByAp.get(ap.id) ?? 0);
      const sold   = ap.solduri[0];
      const restantaVeche = r2((sold?.restantaIntretinere ?? 0) + (sold?.intretinereCurenta ?? 0));
      const prop = ap.proprietari[0]?.proprietar;

      // Reportare: întreținerea lunii devine restanță pentru luna următoare
      await tx.soldApartament.upsert({
        where:  { apartamentId: ap.id },
        create: { apartamentId: ap.id, asociatieId: id, restantaIntretinere: charge, intretinereCurenta: 0 },
        update: { restantaIntretinere: { increment: charge } },
      });

      await tx.listaLunaApartament.create({
        data: {
          listaId: lista.id, apartamentId: ap.id, numarAp: ap.numar,
          proprietar:  prop ? [prop.prenume, prop.nume].filter(Boolean).join(" ") : null,
          nrPersone:   ap.nrPersone, suprafata: ap.suprafata, cotaParte: ap.cotaParte,
          totalLuna:   charge,
          restantaVeche,
          totalDePlata: r2(restantaVeche + charge),
          achitat:     0,
          rest:        r2(restantaVeche + charge),
        },
      });
    }
  });

  const urm = nextMonth(luna, an);
  return NextResponse.json({ ok: true, perioadaCurenta: urm });
}

// DELETE — redeschide ultima lună închisă: reversează reportarea + șterge snapshot
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { id } = await params;
  const asoc = await ownedAsociatie(orgId, id);
  if (!asoc) return NextResponse.json({ error: "Asociație negăsită" }, { status: 404 });

  const luna = parseInt(req.nextUrl.searchParams.get("luna") ?? "");
  const an   = parseInt(req.nextUrl.searchParams.get("an")   ?? "");
  if (isNaN(luna) || isNaN(an)) return NextResponse.json({ error: "Parametri lipsă" }, { status: 400 });

  const lista = await db.listaLuna.findUnique({
    where:   { asociatieId_luna_an: { asociatieId: id, luna, an } },
    include: { apartamente: { select: { apartamentId: true, totalLuna: true } } },
  });
  if (!lista || lista.status !== "inchisa") {
    return NextResponse.json({ error: "Luna nu este închisă." }, { status: 400 });
  }

  // Doar ultima lună închisă poate fi redeschisă (să nu spargem ordinea)
  const maiNoua = await db.listaLuna.findFirst({
    where:  { asociatieId: id, status: "inchisa", OR: [{ an: { gt: an } }, { an, luna: { gt: luna } }] },
    select: { id: true },
  });
  if (maiNoua) return NextResponse.json({ error: "Redeschide întâi luna mai recentă închisă." }, { status: 400 });

  await db.$transaction(async (tx) => {
    for (const r of lista.apartamente) {
      await tx.soldApartament.updateMany({
        where: { apartamentId: r.apartamentId },
        data:  { restantaIntretinere: { decrement: r.totalLuna } },
      });
    }
    await tx.listaLuna.delete({ where: { id: lista.id } }); // cascade pe ListaLunaApartament
  });

  return NextResponse.json({ ok: true, perioadaCurenta: { luna, an } });
}
