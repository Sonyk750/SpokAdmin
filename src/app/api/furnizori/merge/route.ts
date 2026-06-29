import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const r2 = (v: number) => Math.round(v * 100) / 100;

// POST { sourceId, targetId } → unifică furnizorul `source` în `target`:
// mută facturile, avansurile (comasând soldul pe asociație), legăturile de
// asociație și modelele de distribuire, completează datele lipsă pe target
// (CUI/contact/IBAN) și dezactivează sursa. Operație atomică.
export async function POST(req: NextRequest) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { sourceId, targetId } = await req.json() as { sourceId?: string; targetId?: string };
  if (!sourceId || !targetId) return NextResponse.json({ error: "Selectează ambii furnizori." }, { status: 400 });
  if (sourceId === targetId)  return NextResponse.json({ error: "Selectează doi furnizori diferiți." }, { status: 400 });

  const [source, target] = await Promise.all([
    db.furnizor.findFirst({ where: { id: sourceId, organizationId: orgId }, select: { id: true, nume: true, cui: true, telefon: true, email: true, adresa: true, iban: true, banca: true } }),
    db.furnizor.findFirst({ where: { id: targetId, organizationId: orgId }, select: { id: true, nume: true, cui: true, telefon: true, email: true, adresa: true, iban: true, banca: true } }),
  ]);
  if (!source || !target) return NextResponse.json({ error: "Furnizor invalid." }, { status: 404 });

  try {
    await db.$transaction(async (tx) => {
      // 1) Facturile trec la target (plățile rămân legate de facturile lor).
      await tx.factura.updateMany({ where: { furnizorId: sourceId, organizationId: orgId }, data: { furnizorId: targetId } });

      // 2) Avansuri — sold per (asociație, furnizor) cu unicitate → comasăm pe asociație.
      const srcAvansuri = await tx.avansFurnizor.findMany({ where: { furnizorId: sourceId }, select: { id: true, asociatieId: true, sold: true } });
      for (const sa of srcAvansuri) {
        const ta = await tx.avansFurnizor.findUnique({
          where:  { asociatieId_furnizorId: { asociatieId: sa.asociatieId, furnizorId: targetId } },
          select: { id: true, sold: true },
        });
        if (ta) {
          await tx.avansFurnizorMiscare.updateMany({ where: { avansId: sa.id }, data: { avansId: ta.id } });
          await tx.avansFurnizor.update({ where: { id: ta.id }, data: { sold: r2(ta.sold + sa.sold) } });
          await tx.avansFurnizor.delete({ where: { id: sa.id } });
        } else {
          await tx.avansFurnizor.update({ where: { id: sa.id }, data: { furnizorId: targetId } });
        }
      }

      // 3) Legături furnizor-asociație (unicitate pe pereche).
      const srcLinks = await tx.furnizorAsociatie.findMany({ where: { furnizorId: sourceId }, select: { asociatieId: true } });
      for (const l of srcLinks) {
        const exists = await tx.furnizorAsociatie.findUnique({
          where:  { furnizorId_asociatieId: { furnizorId: targetId, asociatieId: l.asociatieId } },
          select: { id: true },
        });
        if (exists) {
          await tx.furnizorAsociatie.delete({ where: { furnizorId_asociatieId: { furnizorId: sourceId, asociatieId: l.asociatieId } } });
        } else {
          await tx.furnizorAsociatie.update({ where: { furnizorId_asociatieId: { furnizorId: sourceId, asociatieId: l.asociatieId } }, data: { furnizorId: targetId } });
        }
      }

      // 4) Modele de distribuire (unic pe furnizor + articol).
      const srcModele = await tx.distributieModel.findMany({ where: { furnizorId: sourceId }, select: { id: true, articolKey: true } });
      for (const m of srcModele) {
        const exists = await tx.distributieModel.findUnique({
          where:  { furnizorId_articolKey: { furnizorId: targetId, articolKey: m.articolKey } },
          select: { id: true },
        });
        if (exists) await tx.distributieModel.delete({ where: { id: m.id } });
        else        await tx.distributieModel.update({ where: { id: m.id }, data: { furnizorId: targetId } });
      }

      // 5) Completează pe target datele lipsă din sursă.
      const patch: Record<string, string> = {};
      if (!target.cui     && source.cui)     patch.cui     = source.cui;
      if (!target.telefon && source.telefon) patch.telefon = source.telefon;
      if (!target.email   && source.email)   patch.email   = source.email;
      if (!target.adresa  && source.adresa)  patch.adresa  = source.adresa;
      if (!target.iban    && source.iban)    patch.iban    = source.iban;
      if (!target.banca   && source.banca)   patch.banca   = source.banca;
      if (Object.keys(patch).length) await tx.furnizor.update({ where: { id: targetId }, data: patch });

      // 6) Dezactivează sursa (n-o ștergem — istoricul rămâne).
      await tx.furnizor.update({ where: { id: sourceId }, data: { isActive: false } });
    }, { timeout: 20000 });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[POST furnizori/merge]", err);
    return NextResponse.json({ error: err?.message ?? "Eroare internă" }, { status: 500 });
  }
}
