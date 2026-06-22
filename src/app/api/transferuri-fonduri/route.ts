import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Soldul unui fond = suma contribuțiilor (FondApartament.sold) + net transferuri
async function computeBalances(asociatieId: string, orgId: string) {
  const fonduri = await db.fondAsociatie.findMany({
    where:   { asociatieId, isEnabled: true },
    orderBy: { sortOrder: "asc" },
    select:  { id: true, name: true },
  });

  const baze = await db.fondApartament.groupBy({
    by:    ["fondId"],
    where: { asociatieId },
    _sum:  { sold: true },
  });
  const bazaById = new Map(baze.map(b => [b.fondId, b._sum.sold ?? 0]));

  const transferuri = await db.transferFond.findMany({
    where: { asociatieId, organizationId: orgId },
  });

  const balances = fonduri.map(f => {
    const baza  = bazaById.get(f.id) ?? 0;
    const intra = transferuri.filter(t => t.inFondId  === f.id).reduce((s, t) => s + t.suma, 0);
    const iesi  = transferuri.filter(t => t.dinFondId === f.id).reduce((s, t) => s + t.suma, 0);
    return { id: f.id, name: f.name, balance: baza + intra - iesi };
  });

  return { fonduri: balances, transferuri };
}

// GET — fonduri cu solduri + lista transferurilor
export async function GET(req: NextRequest) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const asociatieId = req.nextUrl.searchParams.get("asociatieId");
  if (!asociatieId) return NextResponse.json({ error: "Parametri lipsă" }, { status: 400 });

  const asoc = await db.asociatie.findFirst({ where: { id: asociatieId, organizationId: orgId }, select: { id: true } });
  if (!asoc) return NextResponse.json({ error: "Asociație negăsită" }, { status: 404 });

  const { fonduri, transferuri } = await computeBalances(asociatieId, orgId);

  return NextResponse.json({
    fonduri,
    transferuri: transferuri
      .sort((a, b) => b.data.getTime() - a.data.getTime() || b.createdAt.getTime() - a.createdAt.getTime())
      .map(t => ({ ...t, data: t.data.toISOString(), createdAt: t.createdAt.toISOString() })),
  });
}

// POST — creează un transfer între fonduri (scade din sursă, adaugă la destinație)
export async function POST(req: NextRequest) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const body = await req.json();
  const { asociatieId, data, suma, dinFondId, inFondId, notes } = body as {
    asociatieId?: string; data?: string; suma?: number | string;
    dinFondId?: string; inFondId?: string; notes?: string;
  };

  const sumaNum = typeof suma === "number" ? suma : parseFloat(String(suma));

  if (!asociatieId || !dinFondId || !inFondId)
    return NextResponse.json({ error: "Date incomplete" }, { status: 400 });
  if (dinFondId === inFondId)
    return NextResponse.json({ error: "Fondul sursă și cel destinație trebuie să fie diferite" }, { status: 400 });
  if (!sumaNum || sumaNum <= 0)
    return NextResponse.json({ error: "Suma trebuie să fie mai mare ca 0" }, { status: 400 });

  const asoc = await db.asociatie.findFirst({ where: { id: asociatieId, organizationId: orgId }, select: { id: true } });
  if (!asoc) return NextResponse.json({ error: "Asociație negăsită" }, { status: 404 });

  const { fonduri } = await computeBalances(asociatieId, orgId);
  const dinFond = fonduri.find(f => f.id === dinFondId);
  const inFond  = fonduri.find(f => f.id === inFondId);
  if (!dinFond || !inFond)
    return NextResponse.json({ error: "Fond inexistent sau dezactivat" }, { status: 400 });
  if (sumaNum > dinFond.balance + 0.001)
    return NextResponse.json({ error: `Sold insuficient în „${dinFond.name}" (disponibil: ${dinFond.balance.toFixed(2)} lei)` }, { status: 400 });

  const transfer = await db.transferFond.create({
    data: {
      organizationId: orgId,
      asociatieId,
      data:        data ? new Date(data) : new Date(),
      suma:        sumaNum,
      dinFondId,   dinFondName: dinFond.name,
      inFondId,    inFondName:  inFond.name,
      notes:       notes?.trim() || null,
    },
  });

  return NextResponse.json({ transfer: { ...transfer, data: transfer.data.toISOString(), createdAt: transfer.createdAt.toISOString() } });
}
