import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ proprietarId: string }> }) {
  const session = await auth();
  if (!session?.user?.organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { proprietarId } = await params;
  const orgId = session.user.organizationId;

  const proprietar = await db.proprietar.findFirst({
    where: { id: proprietarId, organizationId: orgId },
  });
  if (!proprietar) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { prenume, nume, telefon, emailuri } = await req.json() as {
    prenume:  string;
    nume:     string;
    telefon:  string;
    emailuri: string[];
  };

  const emailuriCurate = (emailuri ?? []).map(e => e.trim()).filter(Boolean);

  const updated = await db.proprietar.update({
    where: { id: proprietarId },
    data: {
      prenume:      prenume?.trim() || null,
      nume:         (nume ?? "").trim(),
      telefon:      telefon?.trim() || null,
      email:        emailuriCurate[0] ?? null,
      emailuriJson: emailuriCurate.length ? JSON.stringify(emailuriCurate) : null,
    },
    select: { id: true, prenume: true, nume: true, telefon: true, email: true, emailuriJson: true },
  });

  return NextResponse.json(updated);
}
