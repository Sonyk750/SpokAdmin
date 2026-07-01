// GET /api/me  →  utilizatorul curent (web sau mobil, via getApiUser).
// Folosit de aplicația mobilă ca să verifice tokenul după login.
import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/mobile-auth";

export async function GET(req: Request) {
  const user = await getApiUser(req);
  if (!user) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  return NextResponse.json({ user });
}
