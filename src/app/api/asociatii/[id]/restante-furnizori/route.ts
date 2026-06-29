import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveFurnizorId } from "@/lib/furnizor";
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
    restante: { furnizorNume: string; furnizorCui?: string; restanta: string }[];
    dataRestante: string;
  };

  try {
    // Șterge facturile generate anterior de wizard pentru această asociație
    await db.factura.deleteMany({
      where: { asociatieId: id, notes: "wizard-init-restante-furnizori" },
    });

    for (const item of restante ?? []) {
      const val = parseFloat(item.restanta);
      if ((!item.furnizorNume?.trim() && !item.furnizorCui?.trim()) || isNaN(val) || val === 0) continue;

      // Potrivire după CUI (identitate sigură), apoi după nume — fără a dubla.
      const furnizorId = await resolveFurnizorId(db, orgId, { nume: item.furnizorNume, cui: item.furnizorCui });
      if (!furnizorId) continue;

      await db.furnizorAsociatie.upsert({
        where:  { furnizorId_asociatieId: { furnizorId, asociatieId: id } },
        create: { furnizorId, asociatieId: id },
        update: {},
      });

      const dataDate = dataRestante ? new Date(dataRestante) : new Date();
      await db.factura.create({
        data: {
          organizationId: orgId,
          asociatieId:    id,
          furnizorId,
          valoare:        val,
          dataEmiterii:   dataDate,
          status:         "neplatita",
          notes:          "wizard-init-restante-furnizori",
        },
      });
    }

    // Curățenie: dezactivează furnizorii legați de această asociație rămași complet goi
    // (fără facturi și fără avansuri nicăieri) — orfani din rulări anterioare ale pasului 8
    // cu nume schimbat (ex: "APA NOVA" redenumit în "APA NOVA BUCURESTI").
    const orfani = await db.furnizor.findMany({
      where: {
        organizationId: orgId,
        isActive:       true,
        asociatii:      { some: { asociatieId: id } },
        facturi:        { none: {} },
        avansuri:       { none: {} },
      },
      select: { id: true },
    });
    if (orfani.length) {
      const ids = orfani.map(o => o.id);
      await db.furnizor.updateMany({ where: { id: { in: ids } }, data: { isActive: false } });
      await db.furnizorAsociatie.deleteMany({ where: { asociatieId: id, furnizorId: { in: ids } } });
    }

    let wd: Record<string, unknown> = {};
    try { if (asoc.wizardData) wd = JSON.parse(asoc.wizardData); } catch {}
    wd.dataRestanteFurnizori = dataRestante;
    // salvăm cu câmpul "nome" ca să corespundă formatului de reîncărcare în wizard
    wd.furnizoriRestante = restante.map(r => ({ nume: r.furnizorNume, cui: r.furnizorCui ?? "", restanta: r.restanta }));

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
