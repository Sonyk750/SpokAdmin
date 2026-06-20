import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

interface DistRow {
  apartamentId: string;
  numar:        string;
  proprietar:   string;
  suma:         number;
  coloane?:     Record<string, number>;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { id } = await params;
  const factura = await db.factura.findFirst({
    where:  { id, organizationId: orgId },
    select: { id: true, valoare: true, luna: true, an: true },
  });
  if (!factura) return NextResponse.json({ error: "Factură negăsită." }, { status: 404 });

  const { rows, criteriuByCol, consumTipByCol } = await req.json() as {
    rows:            DistRow[];
    criteriuByCol?:  Record<string, string>;
    consumTipByCol?: Record<string, string>;
  };
  if (!rows?.length) return NextResponse.json({ error: "Distribuirea este goală." }, { status: 400 });

  const total = rows.reduce((s, r) => s + r.suma, 0);

  await db.factura.update({
    where: { id },
    data:  {
      distribuireJson: JSON.stringify({
        v: 2,
        criteriuByCol:  criteriuByCol  ?? {},
        consumTipByCol: consumTipByCol ?? {},
        rows,
      }),
    },
  });

  return NextResponse.json({ ok: true, total });
}

// Preview calculation (no DB write)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { id } = await params;
  const factura = await db.factura.findFirst({
    where:  { id, organizationId: orgId },
    select: { id: true, distribuireJson: true },
  });
  if (!factura) return NextResponse.json({ error: "Factură negăsită." }, { status: 404 });

  const rows = factura.distribuireJson ? JSON.parse(factura.distribuireJson) : null;
  return NextResponse.json({ rows });
}
