import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

async function getFactura(id: string, orgId: string) {
  return db.factura.findFirst({ where: { id, organizationId: orgId } });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { id } = await params;
  const factura = await getFactura(id, orgId);
  if (!factura) return NextResponse.json({ error: "Factură negăsită." }, { status: 404 });

  const body = await req.json() as {
    furnizorId?:   string | null;
    furnizorNume?: string;
    serie?:        string;
    numar?:        string;
    valoare?:      number;
    tva?:          number;
    dataEmiterii?: string | null;
    dataScadenta?: string | null;
    luna?:         number | null;
    an?:           number | null;
    categorie?:    string | null;
    notes?:        string | null;
    status?:       string;
  };

  // Resolve furnizor by name if needed
  let furnizorId = body.furnizorId;
  if (furnizorId === undefined && body.furnizorNume !== undefined) {
    if (body.furnizorNume.trim()) {
      const existing = await db.furnizor.findFirst({
        where: { organizationId: orgId, nume: body.furnizorNume.trim() },
        select: { id: true },
      });
      if (existing) {
        furnizorId = existing.id;
      } else {
        const nou = await db.furnizor.create({
          data: { organizationId: orgId, nume: body.furnizorNume.trim() },
          select: { id: true },
        });
        furnizorId = nou.id;
      }
    } else {
      furnizorId = null;
    }
  }

  const updated = await db.factura.update({
    where: { id },
    data: {
      ...(furnizorId !== undefined && { furnizorId }),
      ...(body.serie        !== undefined && { serie:        body.serie?.trim() || null }),
      ...(body.numar        !== undefined && { numar:        body.numar?.trim() || null }),
      ...(body.valoare      !== undefined && { valoare:      body.valoare }),
      ...(body.tva          !== undefined && { tva:          body.tva }),
      ...(body.dataEmiterii !== undefined && { dataEmiterii: body.dataEmiterii ? new Date(body.dataEmiterii) : null }),
      ...(body.dataScadenta !== undefined && { dataScadenta: body.dataScadenta ? new Date(body.dataScadenta) : null }),
      ...(body.luna         !== undefined && { luna:         body.luna }),
      ...(body.an           !== undefined && { an:           body.an }),
      ...(body.categorie    !== undefined && { categorie:    body.categorie }),
      ...(body.notes        !== undefined && { notes:        body.notes?.trim() || null }),
      ...(body.status       !== undefined && { status:       body.status }),
    },
    include: {
      furnizor:  { select: { id: true, nume: true } },
      asociatie: { select: { id: true, name: true } },
      plati:     { select: { suma: true } },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { id } = await params;
  const factura = await getFactura(id, orgId);
  if (!factura) return NextResponse.json({ error: "Factură negăsită." }, { status: 404 });

  await db.factura.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
