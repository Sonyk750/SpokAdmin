import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendInstiintarePlataProprietar } from "@/lib/email";

async function ownedAsociatie(orgId: string, id: string) {
  return db.asociatie.findFirst({ where: { id, organizationId: orgId }, select: { id: true, name: true } });
}

// POST — trimite manual (buton + dublă confirmare din UI) înștiințarea de plată
// către toți proprietarii cu cont creat, pentru o lună deja închisă.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { id } = await params;
  const asoc = await ownedAsociatie(orgId, id);
  if (!asoc) return NextResponse.json({ error: "Asociație negăsită" }, { status: 404 });

  const { luna, an } = await req.json().catch(() => ({}));
  if (!luna || !an) return NextResponse.json({ error: "Parametri lipsă" }, { status: 400 });

  const lista = await db.listaLuna.findUnique({
    where:  { asociatieId_luna_an: { asociatieId: id, luna, an } },
    select: { id: true, status: true },
  });
  if (!lista || lista.status !== "inchisa") {
    return NextResponse.json({ error: "Lista trebuie închisă înainte de a trimite înștiințarea de plată." }, { status: 400 });
  }

  const [proprietari, snapshot] = await Promise.all([
    db.asociatieUser.findMany({
      where:  { asociatieId: id, role: "PROPRIETAR", isSuspended: false, apartamentId: { not: null } },
      select: { apartamentId: true, user: { select: { email: true } } },
    }),
    db.listaLunaApartament.findMany({
      where:  { listaId: lista.id },
      select: { apartamentId: true, numarAp: true, totalDePlata: true },
    }),
  ]);

  const snapByAp = new Map(snapshot.map(s => [s.apartamentId, s]));

  let trimise = 0;
  let faraEmail = 0;
  await Promise.all(proprietari.map(async p => {
    if (!p.apartamentId) return;
    const snap = snapByAp.get(p.apartamentId);
    if (!snap) return;
    if (!p.user?.email) { faraEmail++; return; }
    const r = await sendInstiintarePlataProprietar({
      to: p.user.email, asocName: asoc.name, luna, an,
      numarAp: snap.numarAp, suma: snap.totalDePlata,
    });
    if (r.ok) trimise++;
  }));

  return NextResponse.json({ ok: true, trimise, faraEmail });
}
