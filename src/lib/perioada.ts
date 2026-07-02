import { db } from "@/lib/db";

export interface Perioada { luna: number; an: number }

const r2 = (v: number) => Math.round(v * 100) / 100;

export function nextMonth(luna: number, an: number): Perioada {
  return luna >= 12 ? { luna: 1, an: an + 1 } : { luna: luna + 1, an };
}

/** O lună închisă (listă de plată) e read-only: chitanțe/facturi din acea perioadă nu se mai modifică. */
export async function isPerioadaInchisa(asociatieId: string, luna: number, an: number): Promise<boolean> {
  const lista = await db.listaLuna.findUnique({
    where:  { asociatieId_luna_an: { asociatieId, luna, an } },
    select: { status: true },
  });
  return lista?.status === "inchisa";
}

/**
 * Perioada curentă a unei asociații:
 *  - luna următoare celei mai recente liste închise, dacă există;
 *  - altfel prima listă (primaListaLuna/An din wizardData);
 *  - altfel luna calendaristică.
 */
export async function getPerioadaCurenta(asociatieId: string): Promise<Perioada> {
  const [asoc, lastClosed] = await Promise.all([
    db.asociatie.findUnique({ where: { id: asociatieId }, select: { wizardData: true } }),
    db.listaLuna.findFirst({
      where:   { asociatieId, status: "inchisa" },
      orderBy: [{ an: "desc" }, { luna: "desc" }],
      select:  { luna: true, an: true },
    }),
  ]);

  if (lastClosed) return nextMonth(lastClosed.luna, lastClosed.an);

  try {
    const wd = asoc?.wizardData ? JSON.parse(asoc.wizardData) : {};
    const pl = parseInt(wd.primaListaLuna);
    const pa = parseInt(wd.primaListaAn);
    if (pl && pa) return { luna: pl, an: pa };
  } catch { /* ignore */ }

  const now = new Date();
  return { luna: now.getMonth() + 1, an: now.getFullYear() };
}

/**
 * Cota de întreținere (lei) per apartament din facturile distribuite ale lunii.
 * Reproduce logica din /api/lista-plata: partea acoperită din fond nu se distribuie
 * (factor = distribuibil / distTotal).
 */
export async function computeIntretinereLuna(
  asociatieId: string, luna: number, an: number,
): Promise<Map<string, number>> {
  const facturiLuna = await db.factura.findMany({
    where:  { asociatieId, luna, an, distribuireJson: { not: null } },
    select: { valoare: true, distribuireJson: true, plati: { select: { suma: true, fondId: true } } },
  });

  const chargeByAp = new Map<string, number>();

  for (const f of facturiLuna) {
    if (!f.distribuireJson) continue;
    try {
      const raw = JSON.parse(f.distribuireJson);
      const dist: { apartamentId: string; suma: number; coloane?: Record<string, number> }[] =
        Array.isArray(raw) ? raw : raw.rows;

      const fondPaid  = f.plati.filter(p => p.fondId).reduce((s, p) => s + p.suma, 0);
      const distTotal = dist.reduce((s, item) => {
        const cols = (item.coloane && Object.keys(item.coloane).length > 0) ? item.coloane : { Cheltuieli: item.suma };
        return s + Object.values(cols).reduce((a, v) => a + v, 0);
      }, 0);
      const distribuibil = Math.max(0, f.valoare - fondPaid);
      const factor = distTotal > 0 ? Math.min(1, distribuibil / distTotal) : 0;
      if (factor <= 0) continue;

      for (const item of dist) {
        const cols = (item.coloane && Object.keys(item.coloane).length > 0) ? item.coloane : { Cheltuieli: item.suma };
        let suma = 0;
        for (const val of Object.values(cols)) suma += r2(val * factor);
        chargeByAp.set(item.apartamentId, r2((chargeByAp.get(item.apartamentId) ?? 0) + suma));
      }
    } catch { /* ignore */ }
  }

  return chargeByAp;
}
