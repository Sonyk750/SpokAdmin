import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const furnizori = await db.furnizor.findMany({
    where:   { organizationId: orgId, isActive: true },
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
