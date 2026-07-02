import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendListaPlataPublicata } from "@/lib/email";

async function ownedAsociatie(orgId: string, id: string) {
  return db.asociatie.findFirst({ where: { id, organizationId: orgId }, select: { id: true, name: true } });
}

const FIELD_MAP = {
  contabil:   "confirmContabilAt",
  presedinte: "confirmPresedinteAt",
  cenzor:     "confirmCenzorAt",
} as const;
type FieldKey = keyof typeof FIELD_MAP;

// PATCH — bifează/debifează unul din cei 3 pași de confirmare ai listei
// (contabil / presedinte / cenzor). Pasul „șef departament contabil" e gestionat
// de inchide-lista/route.ts, pentru că el chiar închide luna.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { id } = await params;
  const asoc = await ownedAsociatie(orgId, id);
  if (!asoc) return NextResponse.json({ error: "Asociație negăsită" }, { status: 404 });

  const { luna, an, field, value } = await req.json().catch(() => ({}));
  const key = FIELD_MAP[field as FieldKey];
  if (!luna || !an || !key || typeof value !== "boolean") {
    return NextResponse.json({ error: "Parametri lipsă" }, { status: 400 });
  }

  const existing = await db.listaLuna.findUnique({
    where:  { asociatieId_luna_an: { asociatieId: id, luna, an } },
    select: { status: true, confirmContabilAt: true },
  });
  if (existing?.status === "inchisa") {
    return NextResponse.json({ error: "Lista este închisă — nu mai poate fi modificată." }, { status: 409 });
  }

  const wasContabilSet = !!existing?.confirmContabilAt;

  const lista = await db.listaLuna.upsert({
    where:  { asociatieId_luna_an: { asociatieId: id, luna, an } },
    create: { organizationId: orgId, asociatieId: id, luna, an, [key]: value ? new Date() : null },
    update: { [key]: value ? new Date() : null },
  });

  if (field === "contabil" && value && !wasContabilSet) {
    const membri = await db.asociatieUser.findMany({
      where:  { asociatieId: id, role: { in: ["PRESEDINTE", "CENZOR"] }, isSuspended: false },
      select: { user: { select: { email: true } } },
    });
    await Promise.all(
      membri
        .filter(m => m.user?.email)
        .map(m => sendListaPlataPublicata({ to: m.user!.email, asocName: asoc.name, luna, an }))
    );
  }

  return NextResponse.json({
    ok: true,
    status: lista.status,
    confirmContabilAt:   lista.confirmContabilAt,
    confirmPresedinteAt: lista.confirmPresedinteAt,
    confirmCenzorAt:     lista.confirmCenzorAt,
  });
}
