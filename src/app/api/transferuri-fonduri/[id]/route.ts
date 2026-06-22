import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// DELETE — șterge un transfer între fonduri
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { id } = await params;
  const transfer = await db.transferFond.findFirst({ where: { id, organizationId: orgId } });
  if (!transfer) return NextResponse.json({ error: "Transfer negăsit" }, { status: 404 });

  await db.transferFond.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
