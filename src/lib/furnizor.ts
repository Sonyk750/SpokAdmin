// Denumirile furnizorilor sunt afișate uniform, cu MAJUSCULE — exact ca pe facturile
// oficiale. Folosim aceeași formă canonică la stocare oriunde se creează un furnizor,
// ca să nu apară duplicate din cauza scrierii diferite (majuscule/spații).
//
// Identitatea reală a unei firme e însă CUI-ul: dacă CUI-ul coincide, e clar același
// furnizor indiferent cum e scris numele. De aceea potrivirea se face întâi pe CUI.

/** Forma canonică pentru stocare/afișare: trim, spații colapsate, MAJUSCULE. */
export function canonicalFurnizorNume(nume: string): string {
  return nume.trim().replace(/\s+/g, " ").toUpperCase();
}

/** Normalizează CUI-ul la cifre (fără prefix RO, spații, puncte). null dacă invalid. */
export function normalizeCui(cui?: string | null): string | null {
  if (!cui) return null;
  const digits = cui.replace(/\D/g, "");
  return digits.length >= 2 ? digits : null;
}

// Forme juridice eliminate la calcularea „cheii de bază" (ordonate cu cele lungi întâi).
const FORME_JURIDICE = [
  "PERSOANAFIZICAAUTORIZATA", "INTREPRINDEREINDIVIDUALA", "INTREPRINDEREFAMILIALA",
  "SOCIETATECOMERCIALA", "SRLD", "SRL", "PFA", "SC", "SA",
];

/**
 * Cheie de bază a numelui: fără diacritice, doar litere/cifre, fără forma juridică
 * (SC/SA/SRL/PFA/Persoană Fizică Autorizată...). Folosită ca să recunoaștem că
 * „STAREXPERT CONCEPT SRL" și „STAREXPERT CONCEPT S.R.L." sunt același furnizor.
 */
export function furnizorBaseKey(nume: string): string {
  let s = (nume || "")
    .normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "") // scoate diacriticele
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");                       // compactează (fără spații/punctuație)
  for (const t of FORME_JURIDICE) {
    if (s.startsWith(t)) s = s.slice(t.length);
    if (s.endsWith(t))   s = s.slice(0, -t.length);
  }
  return s;
}

type DbLike = {
  furnizor: {
    findFirst: (args: any) => Promise<any>;
    create:    (args: any) => Promise<any>;
    update:    (args: any) => Promise<any>;
  };
};

/**
 * Găsește furnizorul potrivit (sau îl creează) pentru o organizație.
 * Ordinea de potrivire: 1) după CUI (identitate sigură), 2) după nume canonic
 * (case-insensitive). Întoarce id-ul furnizorului sau null dacă nu există date.
 */
export async function resolveFurnizorId(
  db: DbLike,
  organizationId: string,
  input: { nume?: string | null; cui?: string | null },
): Promise<string | null> {
  const cui  = normalizeCui(input.cui);
  const nume = input.nume?.trim() ? canonicalFurnizorNume(input.nume) : null;

  // 1) Identitate puternică: CUI. Doar furnizori activi — cei dezactivați (unificați)
  // nu trebuie reînviați, altfel reapar duplicatele.
  if (cui) {
    const byCui = await db.furnizor.findFirst({
      where:  { organizationId, cui, isActive: true },
      select: { id: true },
    });
    if (byCui) return byCui.id;
  }

  // 2) Nume (case-insensitive). Dacă avem CUI nou, îl completăm pe furnizorul găsit.
  if (nume) {
    const byName = await db.furnizor.findFirst({
      where:  { organizationId, nume: { equals: nume, mode: "insensitive" }, isActive: true },
      select: { id: true, cui: true },
    });
    if (byName) {
      if (cui && !byName.cui) {
        await db.furnizor.update({ where: { id: byName.id }, data: { cui } });
      }
      return byName.id;
    }
  }

  // 3) Creare
  if (!nume && !cui) return null;
  const created = await db.furnizor.create({
    data:   { organizationId, nume: nume ?? cui!, cui },
    select: { id: true },
  });
  return created.id;
}
