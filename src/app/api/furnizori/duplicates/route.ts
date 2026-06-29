import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { furnizorBaseKey, normalizeCui } from "@/lib/furnizor";

// GET → grupuri de furnizori activi cu același nume de bază (ignorând forma juridică),
// unde EXACT unul are CUI. Acela e ținta (identitate sigură), restul sunt duplicate
// de comasat în el. Grupurile ambigue (0 sau >1 cu CUI) sunt sărite.
export async function GET() {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const furnizori = await db.furnizor.findMany({
    where:  { organizationId: orgId, isActive: true },
    select: { id: true, nume: true, cui: true },
    orderBy: { nume: "asc" },
  });

  const groups = new Map<string, { id: string; nume: string; cui: string | null }[]>();
  for (const f of furnizori) {
    const key = furnizorBaseKey(f.nume);
    if (!key) continue;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(f);
  }

  const pairs: { base: string; target: { id: string; nume: string; cui: string | null }; dupes: { id: string; nume: string; cui: string | null }[] }[] = [];
  for (const [base, list] of groups) {
    if (list.length < 2) continue;
    const withCui = list.filter(f => normalizeCui(f.cui));
    if (withCui.length !== 1) continue; // ambiguu → lăsăm pentru unificare manuală
    const target = withCui[0];
    const dupes  = list.filter(f => f.id !== target.id);
    pairs.push({ base, target, dupes });
  }

  return NextResponse.json({ pairs });
}
