import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAvansSold, depuneAvans, consumaAvansPeFacturileFurnizorului } from "@/lib/avans-furnizor";

// GET ?asociatieId=&furnizorId= → soldul de avans disponibil la furnizor.
export async function GET(req: NextRequest) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const asociatieId = sp.get("asociatieId");
  const furnizorId  = sp.get("furnizorId");
  if (!asociatieId || !furnizorId) return NextResponse.json({ sold: 0 });

  // Verifică apartenența furnizorului la organizație.
  const furnizor = await db.furnizor.findFirst({
    where: { id: furnizorId, organizationId: orgId }, select: { id: true },
  });
  if (!furnizor) return NextResponse.json({ sold: 0 });

  const sold = await getAvansSold(db, asociatieId, furnizorId);
  return NextResponse.json({ sold });
}

// POST { asociatieId, furnizorId, suma, notes? } → înregistrează un avans la furnizor
// (ex. plată făcută înainte de factură / la preluare) și îl consumă imediat pe
// facturile deschise ale furnizorului. Întoarce noul sold de avans.
export async function POST(req: NextRequest) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { asociatieId, furnizorId, suma, notes } = await req.json() as {
    asociatieId?: string; furnizorId?: string; suma?: number; notes?: string;
  };
  if (!asociatieId || !furnizorId) return NextResponse.json({ error: "Lipsesc asociația/furnizorul." }, { status: 400 });
  const val = Math.round(Number(suma) * 100) / 100;
  if (!val || val <= 0) return NextResponse.json({ error: "Suma avansului trebuie să fie pozitivă." }, { status: 400 });

  const [asoc, furnizor] = await Promise.all([
    db.asociatie.findFirst({ where: { id: asociatieId, organizationId: orgId }, select: { id: true } }),
    db.furnizor.findFirst({  where: { id: furnizorId,  organizationId: orgId }, select: { id: true } }),
  ]);
  if (!asoc || !furnizor) return NextResponse.json({ error: "Asociație/furnizor invalid." }, { status: 400 });

  try {
    await db.$transaction(async (tx) => {
      await depuneAvans(tx, { organizationId: orgId, asociatieId, furnizorId }, val, null, "manual", null, notes?.trim() || "Avans înregistrat manual");
      await consumaAvansPeFacturileFurnizorului(tx, { organizationId: orgId, asociatieId, furnizorId });
    }, { timeout: 20000 });
  } catch (err: any) {
    console.error("[POST avans-furnizor]", err);
    return NextResponse.json({ error: err?.message ?? "Eroare internă" }, { status: 500 });
  }

  const sold = await getAvansSold(db, asociatieId, furnizorId);
  return NextResponse.json({ ok: true, sold });
}
