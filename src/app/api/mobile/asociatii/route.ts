// GET /api/mobile/asociatii  →  asociațiile la care are acces utilizatorul curent.
//
// Diferă de /api/asociatii (care filtrează după organizationId, potrivit pentru
// admin/owner): un casier „pur" nu are organizationId, ci acces prin AsociatieUser.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getApiUser } from "@/lib/mobile-auth";
import { isSuperAdmin, isOwner } from "@/lib/roles";

export async function GET(req: Request) {
  const user = await getApiUser(req);
  if (!user) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  let where: { isActive: boolean; organizationId?: string; id?: { in: string[] } };

  if (isSuperAdmin(user.role) || isOwner(user.orgRole)) {
    // Admin/owner → toate asociațiile din organizația lui.
    if (!user.organizationId) return NextResponse.json([]);
    where = { organizationId: user.organizationId, isActive: true };
  } else {
    // Utilizator cu rol pe asociație (ex. CASIER) → doar asociațiile lui.
    const links = await db.asociatieUser.findMany({
      where: { userId: user.id, isSuspended: false },
      select: { asociatieId: true },
    });
    const ids = links.map((l) => l.asociatieId);
    if (ids.length === 0) return NextResponse.json([]);
    where = { id: { in: ids }, isActive: true };
  }

  const asociatii = await db.asociatie.findMany({
    where,
    orderBy: { name: "asc" },
    select: { id: true, name: true, city: true, address: true, cui: true },
  });

  return NextResponse.json(asociatii);
}
