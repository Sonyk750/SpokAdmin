import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/mobile-auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser(req);
  const orgId = user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { id } = await params;
  const asoc = await db.asociatie.findFirst({ where: { id, organizationId: orgId } });
  if (!asoc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let serie = await db.incasareSerie.findUnique({ where: { asociatieId: id } });
  if (!serie) {
    serie = await db.incasareSerie.create({
      data: { asociatieId: id, organizationId: orgId, serie: "CH", urmatorulNumar: 1 },
    });
  }

  return NextResponse.json({ serie: serie.serie, urmatorulNumar: serie.urmatorulNumar });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser(req);
  const orgId = user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { id } = await params;
  const asoc = await db.asociatie.findFirst({ where: { id, organizationId: orgId } });
  if (!asoc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { serie, urmatorulNumar } = body;

  if (serie !== undefined && (typeof serie !== "string" || serie.trim().length === 0))
    return NextResponse.json({ error: "Serie invalidă" }, { status: 400 });
  if (urmatorulNumar !== undefined && (!Number.isInteger(urmatorulNumar) || urmatorulNumar < 1))
    return NextResponse.json({ error: "Numărul de start trebuie să fie întreg pozitiv" }, { status: 400 });

  const updated = await db.incasareSerie.upsert({
    where: { asociatieId: id },
    create: {
      asociatieId: id, organizationId: orgId,
      serie: serie?.trim().toUpperCase() ?? "CH",
      urmatorulNumar: urmatorulNumar ?? 1,
    },
    update: {
      ...(serie !== undefined      ? { serie: serie.trim().toUpperCase() } : {}),
      ...(urmatorulNumar !== undefined ? { urmatorulNumar }                : {}),
    },
  });

  return NextResponse.json({ serie: updated.serie, urmatorulNumar: updated.urmatorulNumar });
}
