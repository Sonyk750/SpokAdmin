import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  // Când e dat asociatieId, întoarcem doar furnizorii cu activitate reală în acea
  // asociație (facturi sau avansuri) — fiecare asociație își vede strict furnizorii ei,
  // fără a-i amesteca pe cei din alte asociații ale aceleiași organizații.
  const asociatieId = req.nextUrl.searchParams.get("asociatieId");

  const furnizori = await db.furnizor.findMany({
    where: {
      organizationId: orgId,
      isActive: true,
      ...(asociatieId
        ? {
            OR: [
              { facturi:  { some: { asociatieId } } },
              { avansuri: { some: { asociatieId } } },
            ],
          }
        : {}),
    },
    orderBy: { nume: "asc" },
    select:  { id: true, nume: true, cui: true },
  });

  return NextResponse.json(furnizori);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { nume, cui } = await req.json() as { nume: string; cui?: string };
  if (!nume?.trim()) return NextResponse.json({ error: "Numele este obligatoriu." }, { status: 400 });

  const furnizor = await db.furnizor.create({
    data: { organizationId: orgId, nume: nume.trim(), cui: cui?.trim() || null },
    select: { id: true, nume: true, cui: true },
  });

  return NextResponse.json(furnizor, { status: 201 });
}
