import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { id } = await params;
  const a = await db.asociatie.findFirst({
    where:  { id, organizationId: orgId },
    select: { id: true, wizardStep: true, wizardData: true },
  });
  if (!a) return NextResponse.json({ error: "Asociație negăsită" }, { status: 404 });

  const body = await req.json();

  let existing: Record<string, unknown> = {};
  try { if (a.wizardData) existing = JSON.parse(a.wizardData); } catch {}

  await db.asociatie.update({
    where: { id },
    data:  {
      wizardData: JSON.stringify({
        ...existing,
        soldCasa:       body.soldCasa       ?? null,
        dataSoldCasa:   body.dataSoldCasa   ?? null,
        banci:          body.banci          ?? [],
        primaListaLuna: body.primaListaLuna ?? null,
        primaListaAn:   body.primaListaAn   ?? null,
      }),
      wizardStep: Math.max(a.wizardStep, 9),
    },
  });

  return NextResponse.json({ ok: true });
}
