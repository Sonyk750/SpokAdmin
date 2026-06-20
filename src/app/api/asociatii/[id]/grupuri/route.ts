import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.organizationId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { id } = await params;
  const asociatie = await db.asociatie.findFirst({
    where: { id, organizationId: session.user.organizationId },
    select: { id: true },
  });
  if (!asociatie) return NextResponse.json({ error: "Negăsit" }, { status: 404 });

  const grupuri = await db.grupApartamente.findMany({
    where:   { asociatieId: id },
    select:  { id: true, name: true, apartamentIds: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(
    grupuri.map(g => ({
      id:            g.id,
      name:          g.name,
      apartamentIds: JSON.parse(g.apartamentIds) as string[],
    }))
  );
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { id } = await params;
  const asociatie = await db.asociatie.findFirst({
    where: { id, organizationId: orgId },
    select: { id: true },
  });
  if (!asociatie) return NextResponse.json({ error: "Negăsit" }, { status: 404 });

  const { name, apartamentIds } = await req.json() as { name: string; apartamentIds: string[] };
  if (!name?.trim())               return NextResponse.json({ error: "Numele grupului este obligatoriu." }, { status: 400 });
  if (!apartamentIds?.length)      return NextResponse.json({ error: "Selectează cel puțin un apartament." }, { status: 400 });

  const grup = await db.grupApartamente.create({
    data: {
      organizationId: orgId,
      asociatieId:    id,
      name:           name.trim(),
      apartamentIds:  JSON.stringify(apartamentIds),
    },
  });

  return NextResponse.json({ id: grup.id, name: grup.name, apartamentIds }, { status: 201 });
}
