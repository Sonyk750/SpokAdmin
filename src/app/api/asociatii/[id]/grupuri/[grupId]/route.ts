import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; grupId: string }> }
) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { id, grupId } = await params;

  const grup = await db.grupApartamente.findFirst({
    where: { id: grupId, asociatieId: id, organizationId: orgId },
    select: { id: true },
  });
  if (!grup) return NextResponse.json({ error: "Negăsit" }, { status: 404 });

  await db.grupApartamente.delete({ where: { id: grupId } });
  return NextResponse.json({ ok: true });
}
