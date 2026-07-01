// GET /api/mobile/asociatii/[id]/meta
// Date pentru selectoarele din rapoarte: conturi bancare + fonduri.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getApiUser } from "@/lib/mobile-auth";
import { resolveAccess, can } from "@/lib/access";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser(req);
  if (!user) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { id } = await params;
  const access = await resolveAccess(user, id);
  if (!can(access, "lista_plata")) {
    return NextResponse.json({ error: "Acces interzis" }, { status: 403 });
  }

  const asoc = await db.asociatie.findUnique({
    where: { id },
    select: { bank: true, wizardData: true },
  });

  let banci: string[] = [];
  try {
    const wd = asoc?.wizardData ? JSON.parse(asoc.wizardData) : {};
    if (Array.isArray(wd.banci)) banci = wd.banci.map((b: any) => b?.name).filter(Boolean);
  } catch { /* ignore */ }
  if (banci.length === 0 && asoc?.bank) banci = [asoc.bank];

  const fonduri = await db.fondAsociatie.findMany({
    where: { asociatieId: id, isEnabled: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });

  return NextResponse.json({ banci, fonduri });
}
