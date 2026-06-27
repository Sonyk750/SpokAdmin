import { Prisma } from "@prisma/client";

// Client Prisma normal SAU client de tranzacție interactivă.
// PrismaClient este atribuibil la TransactionClient, deci ambele merg.
type DbClient = Prisma.TransactionClient;

const r2 = (v: number) => Math.round(v * 100) / 100;
const EPS = 0.01;

// ── Status & acoperire factură ────────────────────────────────────────────────
// "Acoperit" = cât din valoarea facturii este efectiv stins.
//   = Σ plăți (numerar real) − Σ mișcări avans ale facturii
// Semnele mișcărilor: depunere (+) scade acoperirea facturii sursă (acel ban a
// mers în avans, nu pe factură); consum (−) o crește (avansul a stins factura).
export function computeAcoperit(
  plati: { suma: number }[],
  avansMiscari: { suma: number }[],
): number {
  const sumPlati = plati.reduce((s, p) => s + p.suma, 0);
  const sumAvans = avansMiscari.reduce((s, m) => s + m.suma, 0);
  return r2(sumPlati - sumAvans);
}

export function computeStatus(valoare: number, acoperit: number): string {
  if (acoperit >= valoare - EPS) return "platita";
  if (acoperit > EPS)            return "partial";
  return "neplatita";
}

// Reîncarcă plățile + mișcările de avans ale unei facturi, recalculează și
// persistă statusul. Întoarce sumarul (valoare, acoperit, rest, status).
export async function recomputeFacturaStatus(client: DbClient, facturaId: string) {
  const factura = await client.factura.findUnique({
    where: { id: facturaId },
    select: {
      valoare: true,
      plati:        { select: { suma: true } },
      avansMiscari: { select: { suma: true } },
    },
  });
  if (!factura) throw new Error("Factură negăsită");

  const acoperit = computeAcoperit(factura.plati, factura.avansMiscari);
  const status   = computeStatus(factura.valoare, acoperit);

  await client.factura.update({ where: { id: facturaId }, data: { status } });

  return { valoare: factura.valoare, acoperit, rest: r2(factura.valoare - acoperit), status };
}

// ── Soldul de avans per (asociație, furnizor) ─────────────────────────────────

export async function getAvansSold(
  client: DbClient,
  asociatieId: string,
  furnizorId: string,
): Promise<number> {
  const av = await client.avansFurnizor.findUnique({
    where: { asociatieId_furnizorId: { asociatieId, furnizorId } },
    select: { sold: true },
  });
  return av ? r2(av.sold) : 0;
}

async function getOrCreateAvans(
  client: DbClient,
  organizationId: string,
  asociatieId: string,
  furnizorId: string,
) {
  return client.avansFurnizor.upsert({
    where:  { asociatieId_furnizorId: { asociatieId, furnizorId } },
    update: {},
    create: { organizationId, asociatieId, furnizorId, sold: 0 },
  });
}

// ── Depunere avans (din supraplată) ───────────────────────────────────────────
// Surplusul unei plăți devine avans la furnizor. Numerarul a ieșit deja prin
// `Plata`, deci aici NU mai mișcăm numerar — doar înregistrăm rezerva.
export async function depuneAvans(
  client: DbClient,
  params: { organizationId: string; asociatieId: string; furnizorId: string },
  suma: number,
  facturaId: string | null,
  metoda: string,
  plataId?: string | null,
  notes?: string | null,
): Promise<void> {
  const val = r2(suma);
  if (val <= EPS) return;

  const av = await getOrCreateAvans(client, params.organizationId, params.asociatieId, params.furnizorId);
  await client.avansFurnizorMiscare.create({
    data: { avansId: av.id, facturaId, plataId: plataId ?? null, suma: val, tip: "depunere", metoda, notes: notes ?? null },
  });
  await client.avansFurnizor.update({
    where: { id: av.id },
    data:  { sold: r2(av.sold + val) },
  });
}

// ── Consum avans pe o factură ─────────────────────────────────────────────────
// Aplică avansul disponibil pe restul unei facturi. NU mișcă numerar.
// Întoarce suma efectiv consumată.
export async function consumaAvansPeFactura(
  client: DbClient,
  factura: { id: string; organizationId: string; asociatieId: string; furnizorId: string | null },
): Promise<number> {
  if (!factura.furnizorId) return 0;

  const av = await client.avansFurnizor.findUnique({
    where:  { asociatieId_furnizorId: { asociatieId: factura.asociatieId, furnizorId: factura.furnizorId } },
    select: { id: true, sold: true },
  });
  if (!av || av.sold <= EPS) return 0;

  // Restul facturii înainte de consum
  const full = await client.factura.findUnique({
    where:  { id: factura.id },
    select: { valoare: true, plati: { select: { suma: true } }, avansMiscari: { select: { suma: true } } },
  });
  if (!full) return 0;
  const acoperit = computeAcoperit(full.plati, full.avansMiscari);
  const rest = r2(full.valoare - acoperit);
  if (rest <= EPS) return 0;

  const aplicat = r2(Math.min(av.sold, rest));
  if (aplicat <= EPS) return 0;

  await client.avansFurnizorMiscare.create({
    data: { avansId: av.id, facturaId: factura.id, suma: -aplicat, tip: "consum", metoda: null, notes: "Consum automat din avans" },
  });
  await client.avansFurnizor.update({ where: { id: av.id }, data: { sold: r2(av.sold - aplicat) } });
  await recomputeFacturaStatus(client, factura.id);

  return aplicat;
}
