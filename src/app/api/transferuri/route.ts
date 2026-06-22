import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const CASA = "Casă";

// Soldurile curente ale conturilor (Casă + bănci), all-time.
// Casă  = sold inițial + încasări casă − plăți casă + transferuri (in − out)
// Bancă = sold inițial + (doar contul principal: încasări bancă − plăți bancă) + transferuri (in − out)
async function computeConturi(asociatieId: string, orgId: string) {
  const asoc = await db.asociatie.findFirst({
    where:  { id: asociatieId, organizationId: orgId },
    select: { bank: true, wizardData: true },
  });
  if (!asoc) return null;

  let soldCasa = 0;
  let banci: { name: string; sold: number }[] = [];
  try {
    const wd = asoc.wizardData ? JSON.parse(asoc.wizardData) : {};
    soldCasa = typeof wd.soldCasa === "number" ? wd.soldCasa : parseFloat(wd.soldCasa) || 0;
    if (Array.isArray(wd.banci)) {
      banci = wd.banci
        .filter((b: any) => b.name)
        .map((b: any) => ({ name: b.name, sold: typeof b.sold === "number" ? b.sold : parseFloat(b.sold) || 0 }));
    }
  } catch { /* ignore */ }
  if (banci.length === 0 && asoc.bank) banci = [{ name: asoc.bank, sold: 0 }];

  const [incByTip, platiByMetoda, transferuri] = await Promise.all([
    db.incasare.groupBy({ by: ["tipPlata"], where: { asociatieId, organizationId: orgId }, _sum: { sumaIncasata: true } }),
    db.plata.groupBy({ by: ["metoda"], where: { factura: { asociatieId, organizationId: orgId } }, _sum: { suma: true } }),
    db.transfer.findMany({ where: { asociatieId, organizationId: orgId }, select: { dinCont: true, inCont: true, suma: true } }),
  ]);

  const incCasa    = incByTip.find(x => x.tipPlata === "casa")?._sum.sumaIncasata  ?? 0;
  const incBanca   = incByTip.find(x => x.tipPlata === "banca")?._sum.sumaIncasata ?? 0;
  const platiCasa  = platiByMetoda.find(x => x.metoda === "casa")?._sum.suma  ?? 0;
  const platiBanca = platiByMetoda.find(x => x.metoda === "banca")?._sum.suma ?? 0;
  const trIn  = (name: string) => transferuri.filter(t => t.inCont  === name).reduce((s, t) => s + t.suma, 0);
  const trOut = (name: string) => transferuri.filter(t => t.dinCont === name).reduce((s, t) => s + t.suma, 0);

  const primaryBank = banci[0]?.name ?? null;
  return [
    { name: CASA, balance: soldCasa + incCasa - platiCasa + trIn(CASA) - trOut(CASA) },
    ...banci.map(b => ({
      name:    b.name,
      balance: b.sold + (b.name === primaryBank ? incBanca - platiBanca : 0) + trIn(b.name) - trOut(b.name),
    })),
  ];
}

// GET — soldurile conturilor + lista transferurilor
export async function GET(req: NextRequest) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const asociatieId = searchParams.get("asociatieId");
  if (!asociatieId) return NextResponse.json({ error: "Parametri lipsă" }, { status: 400 });

  const conturi = await computeConturi(asociatieId, orgId);
  if (!conturi) return NextResponse.json({ error: "Asociație negăsită" }, { status: 404 });

  const dataStart = searchParams.get("dataStart");
  const dataEnd   = searchParams.get("dataEnd");
  const where: Record<string, unknown> = { asociatieId, organizationId: orgId };
  if (dataStart || dataEnd) {
    where.data = {
      ...(dataStart ? { gte: new Date(dataStart) } : {}),
      ...(dataEnd   ? { lte: new Date(dataEnd + "T23:59:59") } : {}),
    };
  }

  const transferuri = await db.transfer.findMany({
    where,
    orderBy: [{ data: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({
    conturi,
    transferuri: transferuri.map(t => ({ ...t, data: t.data.toISOString(), createdAt: t.createdAt.toISOString() })),
  });
}

// POST — creează un transfer între conturi
export async function POST(req: NextRequest) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const body = await req.json();
  const { asociatieId, data, suma, dinCont, inCont, notes } = body as {
    asociatieId?: string; data?: string; suma?: number | string;
    dinCont?: string; inCont?: string; notes?: string;
  };

  const sumaNum = typeof suma === "number" ? suma : parseFloat(String(suma));

  if (!asociatieId || !dinCont || !inCont)
    return NextResponse.json({ error: "Date incomplete" }, { status: 400 });
  if (dinCont === inCont)
    return NextResponse.json({ error: "Contul sursă și cel destinație trebuie să fie diferite" }, { status: 400 });
  if (!sumaNum || sumaNum <= 0)
    return NextResponse.json({ error: "Suma trebuie să fie mai mare ca 0" }, { status: 400 });

  const conturi = await computeConturi(asociatieId, orgId);
  if (!conturi) return NextResponse.json({ error: "Asociație negăsită" }, { status: 404 });

  const sursa = conturi.find(c => c.name === dinCont);
  if (sursa && sumaNum > sursa.balance + 0.001)
    return NextResponse.json({ error: `Sold insuficient în „${dinCont}" (disponibil: ${sursa.balance.toFixed(2)} lei)` }, { status: 400 });

  const transfer = await db.transfer.create({
    data: {
      organizationId: orgId,
      asociatieId,
      data:    data ? new Date(data) : new Date(),
      suma:    sumaNum,
      dinCont: dinCont.trim(),
      inCont:  inCont.trim(),
      notes:   notes?.trim() || null,
    },
  });

  return NextResponse.json({ transfer: { ...transfer, data: transfer.data.toISOString(), createdAt: transfer.createdAt.toISOString() } });
}
