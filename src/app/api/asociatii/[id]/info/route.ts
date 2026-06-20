import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const asociatie = await db.asociatie.findFirst({
    where: { id, organizationId: session.user.organizationId },
  });
  if (!asociatie) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = await req.json();
    const { info, blocuri } = body as {
      info: {
        name: string; address: string; city: string; sector: string;
        cui: string; adminName: string; presedinteName: string; cenzorName: string;
        bank: string; iban: string; phone: string; email: string;
      };
      blocuri: { name: string; nrScari: string }[];
    };

    await db.asociatie.update({
      where: { id },
      data: {
        name:           info.name?.trim() || asociatie.name,
        address:        info.address?.trim() || null,
        city:           info.city?.trim() || "București",
        sector:         info.sector?.trim() || null,
        cui:            info.cui?.trim() || null,
        adminName:      info.adminName?.trim() || null,
        presedinteName: info.presedinteName?.trim() || null,
        cenzorName:     info.cenzorName?.trim() || null,
        bank:           info.bank?.trim() || null,
        iban:           info.iban?.trim() || null,
        phone:          info.phone?.trim() || null,
        email:          info.email?.trim() || null,
        blocuriJson:    JSON.stringify(blocuri),
        wizardStep:     1,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[POST /api/asociatii/info]", err);
    return NextResponse.json({ error: err?.message ?? "Eroare internă" }, { status: 500 });
  }
}
