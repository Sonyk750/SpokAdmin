import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveFurnizorId } from "@/lib/furnizor";
import { depuneAvans, consumaAvansPeFactura, consumaAvansPeFacturileFurnizorului, resetWizardInitAvans, WIZARD_AVANS_NOTE } from "@/lib/avans-furnizor";
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
    await db.$transaction(async (tx) => {
      // Șterge facturile (restanțe) generate anterior de wizard pentru această asociație
      await tx.factura.deleteMany({
        where: { asociatieId: id, sourceWizard: true },
      });
      // Anulează avansurile de preluare anterioare → pasul 8 e re-rulabil fără dublare.
      await resetWizardInitAvans(tx, id);

      for (const item of restante ?? []) {
        const val = parseFloat(item.restanta);
        // CUI obligatoriu la preluare: fără CUI nu creăm furnizor (evită dublurile).
        // Rândurile fără CUI rămân totuși salvate ca draft în wizardData (mai jos).
        if (!item.furnizorCui?.trim() || isNaN(val) || val === 0) continue;

        // Potrivire după CUI (identitate sigură), apoi după nume — fără a dubla.
        const furnizorId = await resolveFurnizorId(tx, orgId, { nume: item.furnizorNume, cui: item.furnizorCui });
        if (!furnizorId) continue;

        await tx.furnizorAsociatie.upsert({
          where:  { furnizorId_asociatieId: { furnizorId, asociatieId: id } },
          create: { furnizorId, asociatieId: id },
          update: {},
        });

        if (val > 0) {
          // Valoare pozitivă = restanță (datorie la preluare) → factură neplătită.
          const dataDate = dataRestante ? new Date(dataRestante) : new Date();
          const created = await tx.factura.create({
            data: {
              organizationId: orgId,
              asociatieId:    id,
              furnizorId,
              valoare:        val,
              dataEmiterii:   dataDate,
              status:         "neplatita",
              notes:          "wizard-init-restante-furnizori",
              sourceWizard:   true,
            },
            select: { id: true, organizationId: true, asociatieId: true, furnizorId: true },
          });
          // Furnizorul putea avea deja avans disponibil (dintr-o rulare anterioară a
          // pasului 8 sau dintr-o supraplată) — îl aplicăm imediat pe noua restanță.
          await consumaAvansPeFactura(tx, created);
        } else {
          // Valoare negativă = avans (asociația a plătit înainte de factură) → sold de avans
          // la furnizor, consumat automat pe facturile deja introduse și pe cele viitoare.
          await depuneAvans(tx, { organizationId: orgId, asociatieId: id, furnizorId }, -val, null, "wizard-init", null, WIZARD_AVANS_NOTE, true);
          await consumaAvansPeFacturileFurnizorului(tx, { organizationId: orgId, asociatieId: id, furnizorId });
        }
      }

      // Curățenie: dezactivează furnizorii legați de această asociație rămași complet goi
      // (fără facturi și fără avansuri nicăieri) — orfani din rulări anterioare ale pasului 8
      // cu nume schimbat (ex: "APA NOVA" redenumit în "APA NOVA BUCURESTI").
      const orfani = await tx.furnizor.findMany({
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
        await tx.furnizor.updateMany({ where: { id: { in: ids } }, data: { isActive: false } });
        await tx.furnizorAsociatie.deleteMany({ where: { asociatieId: id, furnizorId: { in: ids } } });
      }

      let wd: Record<string, unknown> = {};
      try { if (asoc.wizardData) wd = JSON.parse(asoc.wizardData); } catch {}
      wd.dataRestanteFurnizori = dataRestante;
      // salvăm cu câmpul "nome" ca să corespundă formatului de reîncărcare în wizard
      wd.furnizoriRestante = restante.map(r => ({ nume: r.furnizorNume, cui: r.furnizorCui ?? "", restanta: r.restanta }));

      await tx.asociatie.update({
        where: { id },
        data: {
          wizardData: JSON.stringify(wd),
          wizardStep: Math.max(asoc.wizardStep, 8),
        },
      });
    }, { timeout: 20000 });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[POST restante-furnizori]", err);
    return NextResponse.json({ error: err?.message ?? "Eroare internă" }, { status: 500 });
  }
}
