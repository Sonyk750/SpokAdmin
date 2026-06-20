import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const asociatie = await db.asociatie.findFirst({
    where: { id, organizationId: session.user.organizationId },
    include: {
      apartamente: { where: { isActive: true }, select: { id: true } },
      fonduri:     { where: { isEnabled: true }, select: { id: true } },
    },
  });
  if (!asociatie) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.asociatie.update({
    where: { id },
    data: {
      wizardStep: 9,
      wizardData: JSON.stringify({
        completedAt:    new Date().toISOString(),
        nrApartamente:  asociatie.apartamente.length,
        nrFonduri:      asociatie.fonduri.length,
      }),
    },
  });

  return NextResponse.json({ ok: true });
}
