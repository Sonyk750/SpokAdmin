import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAvansSold } from "@/lib/avans-furnizor";

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
