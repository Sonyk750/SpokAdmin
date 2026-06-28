import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { allowedRecipients, loadCommMatrix, resolveParty } from "@/lib/chat";

// GET /api/mesaje/recipients?asociatieId= — destinatarii cu care utilizatorul poate iniția
export async function GET(req: NextRequest) {
  const session = await auth();
  const userId  = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const asociatieId = req.nextUrl.searchParams.get("asociatieId");
  if (!asociatieId) return NextResponse.json({ error: "asociatieId lipsă" }, { status: 400 });

  const rp = await resolveParty(userId, asociatieId);
  if (!rp) return NextResponse.json({ error: "Fără acces" }, { status: 403 });

  const matrix = await loadCommMatrix(rp.organizationId);
  const recipients = await allowedRecipients(matrix, rp.party, rp.organizationId, asociatieId, userId);

  return NextResponse.json({ party: rp.party, recipients });
}
