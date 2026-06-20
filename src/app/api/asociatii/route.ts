import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.organizationId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const asociatii = await db.asociatie.findMany({
    where:   { organizationId: session.user.organizationId, isActive: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(asociatii);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.organizationId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const body = await req.json();
  const { name, address, city, sector, cui, bank, iban, adminName, presedinteName, cenzorName, nrApartamente } = body;

  if (!name?.trim()) return NextResponse.json({ error: "Numele este obligatoriu." }, { status: 400 });

  const orgExists = await db.organization.findUnique({ where: { id: session.user.organizationId }, select: { id: true } });
  if (!orgExists) return NextResponse.json({ error: "Sesiune expirată — reconectează-te." }, { status: 403 });

  try {
    const asociatie = await db.asociatie.create({
      data: {
        organizationId: session.user.organizationId,
        name:           name.trim(),
        address:        address?.trim() || null,
        city:           city?.trim() || "București",
        sector:         sector?.trim() || null,
        cui:            cui?.trim() || null,
        bank:           bank?.trim() || null,
        iban:           iban?.trim() || null,
        adminName:      adminName?.trim() || null,
        presedinteName: presedinteName?.trim() || null,
        cenzorName:     cenzorName?.trim() || null,
        nrApartamente:  nrApartamente ? parseInt(nrApartamente) : 0,
      },
    });

    return NextResponse.json(asociatie, { status: 201 });
  } catch (err: any) {
    console.error("[POST /api/asociatii]", err);
    return NextResponse.json({ error: err?.message ?? "Eroare internă." }, { status: 500 });
  }
}
