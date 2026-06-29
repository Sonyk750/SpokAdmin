import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.organizationId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  const orgId = session.user.organizationId;

  const asoc = await db.asociatie.findFirst({ where: { id, organizationId: orgId } });
  if (!asoc) return NextResponse.json({ error: "Asociație negăsită" }, { status: 404 });

  const body = await req.json();
  const { restante, dataRestante } = body as {
    restante: { furnizorNume: string; restanta: string }[];
    dataRestante: string;
  };

  try {
    // Șterge facturile generate anterior de wizard pentru această asociație
    await db.factura.deleteMany({
      where: { asociatieId: id, notes: "wizard-init-restante-furnizori" },
    });

    for (const item of restante ?? []) {
      const numeT = item.furnizorNume?.trim();
      const val   = parseFloat(item.restanta);
      if (!numeT || isNaN(val) || val === 0) continue;

      let furnizor = await db.furnizor.findFirst({ where: { organizationId: orgId, nume: numeT } });
      if (!furnizor) {
        furnizor = await db.furnizor.create({ data: { organizationId: orgId, nume: numeT } });
      }

      await db.furnizorAsociatie.upsert({
        where: { furnizorId_asociatieId: { furnizorId: furnizor.id, asociatieId: id } },
        create: { furnizorId: furnizor.id, asociatieId: id },
        update: {},
      });

      const dataDate = dataRestante ? new Date(dataRestante) : new Date();
      await db.factura.create({
        data: {
          organizationId: orgId,
          asociatieId:    id,
          furnizorId:     furnizor.id,
          valoare:        val,
          dataEmiterii:   dataDate,
          status:         "neplatita",
          notes:          "wizard-init-restante-furnizori",
        },
      });
    }

    let wd: Record<string, unknown> = {};
    try { if (asoc.wizardData) wd = JSON.parse(asoc.wizardData); } catch {}
    wd.dataRestanteFurnizori = dataRestante;
    // salvăm cu câmpul "nome" ca să corespundă formatului de reîncărcare în wizard
    wd.furnizoriRestante = restante.map(r => ({ nume: r.furnizorNume, restanta: r.restanta }));

    await db.asociatie.update({
      where: { id },
      data: {
        wizardData: JSON.stringify(wd),
        wizardStep: Math.max(asoc.wizardStep, 8),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[POST restante-furnizori]", err);
    return NextResponse.json({ error: err?.message ?? "Eroare internă" }, { status: 500 });
  }
}
