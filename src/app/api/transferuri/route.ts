import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET — listează transferurile asociației (opțional filtrate pe perioadă)
export async function GET(req: NextRequest) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const asociatieId = searchParams.get("asociatieId");
  if (!asociatieId) return NextResponse.json({ error: "Parametri lipsă" }, { status: 400 });

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

  return NextResponse.json(transferuri.map(t => ({
    ...t,
    data:      t.data.toISOString(),
    createdAt: t.createdAt.toISOString(),
  })));
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

  const asoc = await db.asociatie.findFirst({ where: { id: asociatieId, organizationId: orgId } });
  if (!asoc) return NextResponse.json({ error: "Asociație negăsită" }, { status: 404 });

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
