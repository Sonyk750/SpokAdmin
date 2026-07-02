import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { articolKey } from "@/lib/distributie";
import { isPerioadaInchisa } from "@/lib/perioada";

interface DistRow {
  apartamentId: string;
  numar:        string;
  proprietar:   string;
  suma:         number;
  coloane?:     Record<string, number>;
}

interface InvataItem { denumire: string; criteriu: string; consumTip?: string | null }

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { id } = await params;
  const factura = await db.factura.findFirst({
    where:  { id, organizationId: orgId },
    select: { id: true, asociatieId: true, valoare: true, luna: true, an: true, furnizorId: true },
  });
  if (!factura) return NextResponse.json({ error: "Factură negăsită." }, { status: 404 });

  if (factura.luna && factura.an && await isPerioadaInchisa(factura.asociatieId, factura.luna, factura.an)) {
    return NextResponse.json({ error: "Luna facturii este închisă — nu mai poate fi redistribuită." }, { status: 409 });
  }

  const { rows, criteriuByCol, consumTipByCol, invata } = await req.json() as {
    rows:            DistRow[];
    criteriuByCol?:  Record<string, string>;
    consumTipByCol?: Record<string, string>;
    invata?:         InvataItem[];
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

  // Învață MODELUL (coloanele preferate) pentru acest furnizor: înlocuiește modelul
  // existent cu coloanele distribuirii curente (dedup pe nume). Astfel modelul reflectă
  // mereu ultima structură confirmată (ex: "Apă rece" + "Apă meteo"), iar AI-ul o reutilizează.
  if (factura.furnizorId && Array.isArray(invata) && invata.length) {
    const fid = factura.furnizorId;
    const seen = new Set<string>();
    const cols: { key: string; denumire: string; criteriu: string; consumTip: string | null }[] = [];
    for (const it of invata) {
      const denumire = (it?.denumire ?? "").trim();
      const key = articolKey(denumire);
      if (!key || !it?.criteriu || seen.has(key)) continue;
      seen.add(key);
      cols.push({ key, denumire, criteriu: it.criteriu, consumTip: it.criteriu === "consum" ? (it.consumTip ?? null) : null });
    }
    if (cols.length) {
      await db.$transaction([
        db.distributieModel.deleteMany({ where: { furnizorId: fid } }),
        ...cols.map(c => db.distributieModel.create({
          data: { organizationId: orgId, furnizorId: fid, articolKey: c.key, articolLabel: c.denumire, criteriu: c.criteriu, consumTip: c.consumTip },
        })),
      ]).catch(() => { /* nu bloca salvarea distribuirii dacă învățarea eșuează */ });
    }
  }

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
