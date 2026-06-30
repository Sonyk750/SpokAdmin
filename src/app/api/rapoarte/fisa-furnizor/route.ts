import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { WIZARD_AVANS_NOTE } from "@/lib/avans-furnizor";

const r2 = (v: number) => Math.round(v * 100) / 100;
const metodaLabel = (m: string) => m === "casa" ? "Casă" : m === "banca" ? "Bancă" : m === "online" ? "Online" : m;

// Fișă furnizor — extras cronologic: sold inițial + facturi + plăți + sold curent.
export async function GET(req: NextRequest) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const asociatieId = searchParams.get("asociatieId");
  const furnizorId  = searchParams.get("furnizorId");
  if (!asociatieId || !furnizorId)
    return NextResponse.json({ error: "Parametri lipsă" }, { status: 400 });

  const furnizor = await db.furnizor.findFirst({
    where:  { id: furnizorId, organizationId: orgId },
    select: { id: true, nume: true, cui: true, telefon: true, email: true },
  });
  if (!furnizor) return NextResponse.json({ error: "Furnizor negăsit" }, { status: 404 });

  // Avans de preluare din wizard (depuneri cu notes=WIZARD_AVANS_NOTE)
  const avansFurnizor = await db.avansFurnizor.findUnique({
    where:  { asociatieId_furnizorId: { asociatieId, furnizorId } },
    select: {
      miscari: {
        where:  { tip: "depunere", notes: WIZARD_AVANS_NOTE },
        select: { suma: true, data: true },
        orderBy: { data: "asc" },
      },
    },
  });
  const wizardAvansMiscari = avansFurnizor?.miscari ?? [];

  // Toate facturile + plățile lor
  const facturiAll = await db.factura.findMany({
    where: { furnizorId, asociatieId, organizationId: orgId },
    select: {
      id: true, serie: true, numar: true, valoare: true, categorie: true,
      dataEmiterii: true, createdAt: true, notes: true,
      plati: {
        select: { id: true, suma: true, data: true, metoda: true, idTranzactie: true, serieCh: true, nrCh: true },
        orderBy: { data: "asc" },
      },
    },
    orderBy: [{ dataEmiterii: "asc" }, { createdAt: "asc" }],
  });

  // Construiește evenimentele cronologice
  type Tip = "sold_initial" | "factura" | "plata";
  interface Ev { data: Date; tip: Tip; descriere: string; valoare: number; }
  const events: Ev[] = [];

  // 1. Sold inițial — avans de preluare (asociația a plătit deja în avans)
  for (const m of wizardAvansMiscari) {
    events.push({ data: m.data, tip: "sold_initial", descriere: "Sold inițial — avans la preluare", valoare: -m.suma });
  }

  // 2. Facturi (restanțe de preluare + facturi curente) + plățile lor
  for (const f of facturiAll) {
    const dateEff = f.dataEmiterii ?? f.createdAt;
    const isRestanta = f.notes === "wizard-init-restante-furnizori";
    const docLabel = [f.serie, f.numar].filter(Boolean).join(" ") || "—";

    events.push({
      data: dateEff,
      tip:  isRestanta ? "sold_initial" : "factura",
      descriere: isRestanta
        ? "Sold inițial — restanță la preluare"
        : `Factură ${docLabel}${f.categorie ? ` · ${f.categorie}` : ""}`,
      valoare: +f.valoare,
    });

    for (const p of f.plati) {
      const doc = p.serieCh && p.nrCh != null ? `${p.serieCh} ${p.nrCh}` : (p.idTranzactie ?? "");
      events.push({
        data: p.data,
        tip:  "plata",
        descriere: `Plată ${metodaLabel(p.metoda)}${doc ? ` · ${doc}` : ""}`,
        valoare: -p.suma,
      });
    }
  }

  // Sortare: sold_initial întotdeauna primul, restul cronologic
  events.sort((a, b) => {
    if (a.tip === "sold_initial" && b.tip !== "sold_initial") return -1;
    if (a.tip !== "sold_initial" && b.tip === "sold_initial") return 1;
    return a.data.getTime() - b.data.getTime();
  });

  // Sold curent (running balance)
  let sold = 0;
  const rows = events.map(e => {
    sold = r2(sold + e.valoare);
    return {
      data:      e.data.toISOString(),
      tip:       e.tip,
      descriere: e.descriere,
      debit:     e.valoare > 0 ? e.valoare : 0,   // cât datorăm mai mult
      credit:    e.valoare < 0 ? -e.valoare : 0,  // cât am plătit / avans
      sold,
    };
  });

  const soldFinal = rows.length > 0 ? rows[rows.length - 1].sold : 0;

  return NextResponse.json({
    furnizor:  { nume: furnizor.nume, cui: furnizor.cui, telefon: furnizor.telefon, email: furnizor.email },
    soldFinal,
    rows,
  });
}
