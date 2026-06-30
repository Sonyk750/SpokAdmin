import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resolveAccess } from "@/lib/access";

// GET /api/me/access?asociatieId=... → drepturile efective ale userului curent.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const asociatieId = req.nextUrl.searchParams.get("asociatieId");
  const access = await resolveAccess(session.user as any, asociatieId);
  return NextResponse.json(access);
}
