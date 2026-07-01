import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/mobile-auth";
import { resolveAccess } from "@/lib/access";

// GET /api/me/access?asociatieId=... → drepturile efective ale userului curent.
export async function GET(req: NextRequest) {
  const user = await getApiUser(req);
  if (!user) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const asociatieId = req.nextUrl.searchParams.get("asociatieId");
  const access = await resolveAccess(user, asociatieId);
  return NextResponse.json(access);
}
