// Denumirile furnizorilor sunt afișate uniform, cu MAJUSCULE — exact ca pe facturile
// oficiale. Folosim aceeași formă canonică la stocare oriunde se creează un furnizor,
// ca să nu apară duplicate din cauza scrierii diferite (majuscule/spații).

/** Forma canonică pentru stocare/afișare: trim, spații colapsate, MAJUSCULE. */
export function canonicalFurnizorNume(nume: string): string {
  return nume.trim().replace(/\s+/g, " ").toUpperCase();
}
