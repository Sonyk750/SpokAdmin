import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const asociatie = await db.asociatie.findFirst({
    where: { id, organizationId: session.user.organizationId },
  });
  if (!asociatie) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { proprietari } = await req.json() as {
    proprietari: {
      apartamentId: string;
      numar:        string;
      numeComplet?: string;
      nume?:        string;
      prenume?:     string;
      telefon:      string;
      emailuri:     string[];
    }[];
  };

  const orgId = session.user.organizationId;

  for (const p of proprietari) {
    const numeToSave    = (p.numeComplet ?? p.nume ?? "").trim();
    const prenumeToSave = (p.prenume ?? "").trim() || null;
    if (!p.apartamentId || !numeToSave) continue;

    const emailuriCurate = (p.emailuri ?? []).map(e => e.trim()).filter(Boolean);

    const prop = await db.proprietar.upsert({
      where: {
        id: (await db.apartamentProprietar.findFirst({
          where:  { apartamentId: p.apartamentId, isMain: true },
          select: { proprietarId: true },
        }))?.proprietarId ?? "nonexistent",
      },
      update: {
        nume:         numeToSave,
        prenume:      prenumeToSave,
        telefon:      p.telefon.trim() || null,
        email:        emailuriCurate[0] ?? null,
        emailuriJson: emailuriCurate.length > 0 ? JSON.stringify(emailuriCurate) : null,
      },
      create: {
        organizationId: orgId,
        asociatieId:    id,
        nume:           numeToSave,
        prenume:        prenumeToSave,
        telefon:        p.telefon.trim() || null,
        email:          emailuriCurate[0] ?? null,
        emailuriJson:   emailuriCurate.length > 0 ? JSON.stringify(emailuriCurate) : null,
      },
    });

    await db.apartamentProprietar.upsert({
      where: { apartamentId_proprietarId: { apartamentId: p.apartamentId, proprietarId: prop.id } },
      update: { isMain: true },
      create: { apartamentId: p.apartamentId, proprietarId: prop.id, isMain: true },
    });
  }

  await db.asociatie.update({ where: { id }, data: { wizardStep: 3 } });

  return NextResponse.json({ ok: true });
}
