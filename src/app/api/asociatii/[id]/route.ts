import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const a = await db.asociatie.findFirst({
    where:  { id, organizationId: session.user.organizationId },
    select: { bank: true, iban: true, wizardData: true, name: true },
  });
  if (!a) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let banci: { name: string; iban?: string }[] = [];
  try {
    const wd = a.wizardData ? JSON.parse(a.wizardData) : {};
    if (Array.isArray(wd.banci) && wd.banci.length > 0) {
      banci = wd.banci
        .filter((b: any) => b.name)
        .map((b: any) => ({ name: b.name, iban: b.iban || a.iban || undefined }));
    }
  } catch {}
  if (banci.length === 0 && a.bank) {
    banci = [{ name: a.bank, iban: a.iban || undefined }];
  }

  return NextResponse.json({ name: a.name, banci });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const asociatie = await db.asociatie.findFirst({
    where: { id, organizationId: session.user.organizationId },
  });
  if (!asociatie) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.asociatie.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
