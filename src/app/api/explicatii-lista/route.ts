import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// ─── Etichete unități / titluri secțiuni pe criteriu ──────────────────────────

const CONSUM_UNIT: Record<string, string> = {
  apa_rece:  "mc",
  apa_calda: "mc",
  gaz:       "mc",
  electric:  "kWh",
};

// Ordinea și titlul secțiunilor în raport (după criteriul de repartizare).
const SECTIUNI: { key: string; titlu: string }[] = [
  { key: "consum",     titlu: "Cheltuieli pe index (contoare individuale)" },
  { key: "persoane",   titlu: "Cheltuieli pe număr de persoane" },
  { key: "suprafata",  titlu: "Cheltuieli pe suprafață" },
  { key: "egal",       titlu: "Cheltuieli împărțite egal pe apartament" },
  { key: "cota_parte", titlu: "Cheltuieli pe cotă parte indiviză" },
  { key: "manual",     titlu: "Cheltuieli cu valori individuale" },
];

const round2 = (v: number) => Math.round(v * 100) / 100;

interface Linie {
  label:        string;
  facturaNumar: string;
  facturaData:  string | null; // ISO
  suma:         number;
  divizor:      number | null;
  unitate:      string;
  perUnit:      number | null;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const asociatieId = searchParams.get("asociatieId");
  const luna = parseInt(searchParams.get("luna") ?? "");
  const an   = parseInt(searchParams.get("an")   ?? "");

  if (!asociatieId || isNaN(luna) || isNaN(an)) {
    return NextResponse.json({ error: "Parametri lipsă" }, { status: 400 });
  }

  const asociatie = await db.asociatie.findFirst({
    where:  { id: asociatieId, organizationId: orgId },
    select: { id: true, name: true },
  });
  if (!asociatie) return NextResponse.json({ error: "Asociație negăsită" }, { status: 404 });

  // Metricile pe apartament (persoane / cotă / suprafață / consum pe tip) — baza
  // împărțirilor. Cheia divizorului depinde de criteriul fiecărei cheltuieli.
  const apartamente = await db.apartament.findMany({
    where:  { asociatieId, organizationId: orgId, isActive: true },
    select: {
      id: true, nrPersone: true, cotaParte: true, suprafata: true,
      contoare: {
        where:  { isActive: true },
        select: {
          tip: true,
          citiri: { where: { luna, an }, select: { consum: true, valoare: true, valoarePrev: true }, take: 1 },
        },
      },
    },
  });

  const apMap = new Map<string, { nrPersone: number; cotaParte: number; suprafata: number; consumByTip: Record<string, number> }>();
  for (const ap of apartamente) {
    const consumByTip: Record<string, number> = {};
    for (const contor of ap.contoare) {
      const c = contor.citiri[0];
      if (!c) continue;
      let val = c.consum;
      if (val === null && c.valoare !== null && c.valoarePrev !== null) val = c.valoare - c.valoarePrev;
      if (val !== null && val >= 0) consumByTip[contor.tip] = (consumByTip[contor.tip] ?? 0) + val;
    }
    apMap.set(ap.id, {
      nrPersone: ap.nrPersone ?? 0,
      cotaParte: ap.cotaParte ?? 0,
      suprafata: ap.suprafata ?? 0,
      consumByTip,
    });
  }

  const facturi = await db.factura.findMany({
    where:  { asociatieId, luna, an, distribuireJson: { not: null } },
    select: {
      serie: true, numar: true, dataEmiterii: true, valoare: true,
      distribuireJson: true,
      plati: { select: { suma: true, fondId: true } },
    },
    orderBy: { dataEmiterii: "asc" },
  });

  // Acumulează liniile pe secțiuni (după criteriu).
  const liniiPerSectiune: Record<string, Linie[]> = {};
  for (const s of SECTIUNI) liniiPerSectiune[s.key] = [];

  for (const f of facturi) {
    if (!f.distribuireJson) continue;
    let raw: any;
    try { raw = JSON.parse(f.distribuireJson); } catch { continue; }

    const dist: { apartamentId: string; suma: number; coloane?: Record<string, number> }[] =
      Array.isArray(raw) ? raw : raw.rows;
    if (!Array.isArray(dist)) continue;
    const criteriuByCol:  Record<string, string> = Array.isArray(raw) ? {} : (raw.criteriuByCol  ?? {});
    const consumTipByCol: Record<string, string> = Array.isArray(raw) ? {} : (raw.consumTipByCol ?? {});

    // Factor: partea acoperită din fond NU se distribuie (vezi lista-plata).
    const fondPaid = f.plati.filter(p => p.fondId).reduce((s, p) => s + p.suma, 0);
    const distTotal = dist.reduce((s, item) => {
      const cols = (item.coloane && Object.keys(item.coloane).length > 0) ? item.coloane : { Cheltuieli: item.suma };
      return s + Object.values(cols).reduce((a, v) => a + v, 0);
    }, 0);
    const distribuibil = Math.max(0, f.valoare - fondPaid);
    const factor = distTotal > 0 ? Math.min(1, distribuibil / distTotal) : 0;
    if (factor <= 0) continue;

    // Sumă brută + apartamente participante (valoare ≠ 0) pe coloană.
    const sumRaw:       Record<string, number> = {};
    const participants: Record<string, Set<string>> = {};
    for (const item of dist) {
      const cols = (item.coloane && Object.keys(item.coloane).length > 0)
        ? item.coloane
        : { Cheltuieli: item.suma };
      for (const [label, val] of Object.entries(cols)) {
        sumRaw[label] = (sumRaw[label] ?? 0) + val;
        if (Math.abs(val) > 0.0001) {
          (participants[label] ??= new Set()).add(item.apartamentId);
        }
      }
    }

    const facturaNumar = [f.serie, f.numar].filter(Boolean).join(" ").trim();
    const facturaData  = f.dataEmiterii ? f.dataEmiterii.toISOString().slice(0, 10) : null;

    for (const label of Object.keys(sumRaw)) {
      const suma = round2((sumRaw[label] ?? 0) * factor);
      if (Math.abs(suma) < 0.005) continue;

      const criteriu = criteriuByCol[label] ?? null;
      const parts = [...(participants[label] ?? new Set<string>())];

      let divizor: number | null = null;
      let unitate = "";

      if (criteriu === "consum") {
        const tip = consumTipByCol[label] ?? "";
        divizor = round2(parts.reduce((s, id) => s + (apMap.get(id)?.consumByTip[tip] ?? 0), 0));
        unitate = `Lei / ${CONSUM_UNIT[tip] ?? "unit."}`;
      } else if (criteriu === "persoane") {
        divizor = parts.reduce((s, id) => s + (apMap.get(id)?.nrPersone ?? 0), 0);
        unitate = "Lei / pers";
      } else if (criteriu === "cota_parte") {
        divizor = round2(parts.reduce((s, id) => s + (apMap.get(id)?.cotaParte ?? 0), 0));
        unitate = "Lei / cotă";
      } else if (criteriu === "suprafata") {
        divizor = round2(parts.reduce((s, id) => s + (apMap.get(id)?.suprafata ?? 0), 0));
        unitate = "Lei / m²";
      } else if (criteriu === "egal") {
        divizor = parts.length;
        unitate = "Lei / ap";
      } else {
        // manual / necunoscut → valori individuale, fără divizor unic
        divizor = null;
        unitate = "Valori individuale";
      }

      const perUnit = divizor && divizor > 0 ? round2(suma / divizor) : null;
      const sectKey = criteriu && liniiPerSectiune[criteriu] ? criteriu : "manual";

      liniiPerSectiune[sectKey].push({ label, facturaNumar, facturaData, suma, divizor, unitate, perUnit });
    }
  }

  const sectiuni = SECTIUNI
    .map(s => {
      const linii = liniiPerSectiune[s.key].sort((a, b) => a.label.localeCompare(b.label, "ro"));
      const subtotal = round2(linii.reduce((acc, l) => acc + l.suma, 0));
      return { key: s.key, titlu: s.titlu, linii, subtotal };
    })
    .filter(s => s.linii.length > 0);

  const total = round2(sectiuni.reduce((acc, s) => acc + s.subtotal, 0));

  return NextResponse.json({ asociatie, luna, an, sectiuni, total });
}
