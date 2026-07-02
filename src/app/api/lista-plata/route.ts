import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/mobile-auth";
import { db } from "@/lib/db";
import { resolveAccess, can } from "@/lib/access";

const TIP_LABEL: Record<string, string> = {
  apa_rece:  "Apă rece",
  apa_calda: "Apă caldă",
  electric:  "Electric",
  gaz:       "Gaz",
};

const TIP_UNIT: Record<string, string> = {
  apa_rece:  "m³",
  apa_calda: "m³",
  electric:  "kWh",
  gaz:       "m³",
};

function sortNr(a: string, b: string): number {
  const na = parseInt(a) || 0;
  const nb = parseInt(b) || 0;
  if (na !== nb) return na - nb;
  return a.localeCompare(b);
}

export async function GET(req: NextRequest) {
  const user = await getApiUser(req);
  const orgId = user?.organizationId;
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

  const access = await resolveAccess(user, asociatieId);
  if (!can(access, "lista_plata")) {
    return NextResponse.json({ error: "Acces interzis" }, { status: 403 });
  }

  const listaLuna = await db.listaLuna.findUnique({
    where:  { asociatieId_luna_an: { asociatieId, luna, an } },
    select: { status: true, confirmContabilAt: true, confirmPresedinteAt: true, confirmCenzorAt: true, inchisaAt: true },
  });

  // Nivele de vizibilitate: contabilul (admin) vede mereu totul; Președinte/Cenzor
  // (și restul rolurilor interne) doar după ce contabilul a bifat publicarea;
  // Proprietarii și Casierul doar după ce lista e închisă definitiv (bifă șef
  // departament contabil) — casierul încasează doar pe liste deja închise.
  if (!access.isAdmin) {
    const publicDupaInchidere = listaLuna?.status === "inchisa";
    const publicDupaContabil  = !!listaLuna?.confirmContabilAt || publicDupaInchidere;
    const doarDupaInchidere   = access.role === "PROPRIETAR" || access.role === "CASIER";
    const vizibil = doarDupaInchidere ? publicDupaInchidere : publicDupaContabil;
    if (!vizibil) {
      return NextResponse.json({ error: "Lista nu a fost încă publicată." }, { status: 403 });
    }
  }

  const [apartamente, fonduri] = await Promise.all([
    db.apartament.findMany({
      where:   { asociatieId, organizationId: orgId, isActive: true },
      include: {
        proprietari: {
          where:   { isMain: true },
          include: { proprietar: { select: { nume: true, prenume: true } } },
          take:    1,
        },
        solduri: { select: { restantaIntretinere: true, intretinereCurenta: true } },
        fonduri: { select: { fondId: true, restanta: true } },
        contoare: {
          where:   { isActive: true },
          select: {
            id: true, tip: true,
            citiri: {
              where:  { luna, an },
              select: { consum: true, valoare: true, valoarePrev: true },
              take:   1,
            },
          },
        },
      },
    }),
    db.fondAsociatie.findMany({
      where:   { asociatieId, isEnabled: true },
      orderBy: { sortOrder: "asc" },
      select:  { id: true, name: true },
    }),
  ]);

  apartamente.sort((a, b) => sortNr(a.numar, b.numar));

  const tipsCuDate = new Set<string>();

  const rows = apartamente.map(ap => {
    const prop = ap.proprietari[0]?.proprietar;
    const sold = ap.solduri[0];

    const consumByTip: Record<string, number> = {};
    for (const contor of ap.contoare) {
      const citire = contor.citiri[0];
      if (!citire) continue;
      let val = citire.consum;
      if (val === null && citire.valoare !== null && citire.valoarePrev !== null) {
        val = citire.valoare - citire.valoarePrev;
      }
      if (val !== null && val >= 0) {
        consumByTip[contor.tip] = (consumByTip[contor.tip] ?? 0) + val;
        tipsCuDate.add(contor.tip);
      }
    }

    const restantaFonduri: Record<string, number> = {};
    for (const fond of fonduri) {
      const fa = ap.fonduri.find(f => f.fondId === fond.id);
      restantaFonduri[fond.id] = fa?.restanta ?? 0;
    }

    const restantaIntretinere = (sold?.restantaIntretinere ?? 0) + (sold?.intretinereCurenta ?? 0);
    const totalFonduri = Object.values(restantaFonduri).reduce((s, v) => s + v, 0);
    const total = restantaIntretinere + totalFonduri;

    return {
      apartamentId: ap.id, numar: ap.numar,
      proprietar: prop ? [prop.prenume, prop.nume].filter(Boolean).join(" ") : "",
      nrPersone: ap.nrPersone, cotaParte: ap.cotaParte, suprafata: ap.suprafata,
      consumByTip,
      cheltuieli:          {} as Record<string, number>,
      totalLuna:           0,
      restantaIntretinere,
      totalFonduri,
      restantaFonduri,
      total,
    };
  });

  const hasCotaParte = rows.some(r => r.cotaParte !== null && r.cotaParte > 0);
  const hasSuprafata = rows.some(r => r.suprafata !== null && r.suprafata > 0);

  const tipOrder = ["apa_rece", "apa_calda", "electric", "gaz"];

  // ── Aggregate facturi distributions ──────────────────────────────────────

  // Partea unei facturi acoperită dintr-un fond NU se distribuie în lista de
  // întreținere (proprietarii au contribuit deja la fond). Restul (valoare −
  // partea din fond) se distribuie proporțional. Dacă e integral din fond,
  // factorul devine 0 și factura nu apare deloc în listă.
  const facturiLuna = await db.factura.findMany({
    where:  { asociatieId, luna, an, distribuireJson: { not: null } },
    select: { valoare: true, distribuireJson: true, plati: { select: { suma: true, fondId: true } } },
  });

  const cheltuialaKeys: string[] = [];
  const cheltuialaKeysSet   = new Set<string>();
  const colPerAp:            Record<string, Record<string, number>> = {};
  const criteriuByColAgg:    Record<string, string> = {};  // chelt key → criteriu
  const consumTipByColAgg:   Record<string, string> = {};  // chelt key → consum tip

  for (const f of facturiLuna) {
    if (!f.distribuireJson) continue;
    try {
      const raw = JSON.parse(f.distribuireJson);
      const dist: { apartamentId: string; suma: number; coloane?: Record<string, number> }[] =
        Array.isArray(raw) ? raw : raw.rows;
      const criteriuByCol:  Record<string, string> = Array.isArray(raw) ? {} : (raw.criteriuByCol  ?? {});
      const consumTipByCol: Record<string, string> = Array.isArray(raw) ? {} : (raw.consumTipByCol ?? {});

      // Factor de distribuire = cât din factură se distribuie (restul e din fond).
      const fondPaid = f.plati.filter(p => p.fondId).reduce((s, p) => s + p.suma, 0);
      const distTotal = dist.reduce((s, item) => {
        const cols = (item.coloane && Object.keys(item.coloane).length > 0) ? item.coloane : { Cheltuieli: item.suma };
        return s + Object.values(cols).reduce((a, v) => a + v, 0);
      }, 0);
      const distribuibil = Math.max(0, f.valoare - fondPaid);
      const factor = distTotal > 0 ? Math.min(1, distribuibil / distTotal) : 0;
      if (factor <= 0) continue; // integral din fond → nu se distribuie

      for (const [k, v] of Object.entries(criteriuByCol))  { if (!criteriuByColAgg[k])  criteriuByColAgg[k]  = v; }
      for (const [k, v] of Object.entries(consumTipByCol)) { if (!consumTipByColAgg[k]) consumTipByColAgg[k] = v; }

      for (const item of dist) {
        if (!colPerAp[item.apartamentId]) colPerAp[item.apartamentId] = {};
        const cols = (item.coloane && Object.keys(item.coloane).length > 0)
          ? item.coloane
          : { "Cheltuieli": item.suma };
        for (const [key, val] of Object.entries(cols)) {
          if (!cheltuialaKeysSet.has(key)) { cheltuialaKeysSet.add(key); cheltuialaKeys.push(key); }
          const adj = Math.round(val * factor * 100) / 100;
          colPerAp[item.apartamentId][key] = (colPerAp[item.apartamentId][key] ?? 0) + adj;
        }
      }
    } catch {}
  }

  // ── Link cheltuiala ↔ consum tip (for "lei" columns in consum group) ──────

  // consumTipByColAgg: cheltuiala label → consum tip (only for consum-criterion distributions)
  // consumLeiByTip:    consum tip → cheltuiala label (first match wins)
  const consumLeiByTip: Record<string, string> = {};
  for (const [chelKey, tipVal] of Object.entries(consumTipByColAgg)) {
    if (!consumLeiByTip[tipVal]) consumLeiByTip[tipVal] = chelKey;
  }
  const linkedCheltuialaKeys = new Set(Object.values(consumLeiByTip));

  // ── Apply distributions to rows ───────────────────────────────────────────

  for (const row of rows) {
    row.cheltuieli = colPerAp[row.apartamentId] ?? {};
    row.totalLuna  = Object.values(row.cheltuieli).reduce((s, v) => s + v, 0);
    row.total      = row.totalLuna + row.restantaIntretinere + row.totalFonduri;
  }

  const hasTotalLuna = rows.some(r => r.totalLuna > 0);

  // ── Build column definitions ──────────────────────────────────────────────

  const consumuri = tipOrder.filter(t => tipsCuDate.has(t)).map(t => ({
    tip: t, label: TIP_LABEL[t] ?? t, unit: TIP_UNIT[t] ?? "",
    // key of the cheltuiala that represents the monetary value for this consum type (or null)
    valoareLeiKey: consumLeiByTip[t] ?? null,
  }));

  // Cheltuieli: exclude consum-linked ones (shown inside consum group)
  const cheltuieli = cheltuialaKeys
    .filter(key => !linkedCheltuialaKeys.has(key))
    .map(key => ({ key, label: key, criteriu: criteriuByColAgg[key] ?? null }));

  const coloane = {
    nrPersone:              true,
    cotaParte:              hasCotaParte,
    suprafata:              hasSuprafata && !hasCotaParte,
    consumuri,
    cheltuieli,
    hasRestantaIntretinere: rows.some(r => r.restantaIntretinere !== 0),
    fonduri:                fonduri.filter(f => rows.some(r => (r.restantaFonduri[f.id] ?? 0) > 0)),
    hasTotalLuna,
  };

  return NextResponse.json({
    asociatie, luna, an, coloane, rows,
    lista: listaLuna ?? { status: "draft", confirmContabilAt: null, confirmPresedinteAt: null, confirmCenzorAt: null, inchisaAt: null },
  });
}
