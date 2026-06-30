// ─── Drepturi pe rol — sursă canonică (folosită de UI și de enforcement) ──────
// Cheile trebuie să corespundă cu matricea din „Drepturi & roluri" (DrepturiClient).

export type RoleKey = "proprietar" | "presedinte" | "cenzor" | "membru_cex" | "casier";
export type PermMap = Record<string, boolean>;

export const PERM_KEYS = [
  "lista_plata", "explicatii",
  "reg_incasari", "reg_plati", "reg_casa", "reg_banca", "jurnal", "reg_fonduri",
  "restantieri", "fisa_proprie", "fisa_furnizor", "venituri",
  "chit_add", "chit_edit", "chit_delete",
  "citiri", "istoric_index", "mesaje",
] as const;

export const DEFAULT_PERMS: Record<RoleKey, PermMap> = {
  proprietar: { lista_plata: true, explicatii: false, reg_incasari: false, reg_plati: false, reg_casa: false, reg_banca: false, jurnal: false, reg_fonduri: false, restantieri: false, fisa_proprie: true, fisa_furnizor: false, venituri: false, chit_add: false, chit_edit: false, chit_delete: false, citiri: true,  istoric_index: true,  mesaje: true },
  presedinte: { lista_plata: true, explicatii: true,  reg_incasari: true,  reg_plati: true,  reg_casa: true,  reg_banca: true,  jurnal: true,  reg_fonduri: true,  restantieri: true,  fisa_proprie: true, fisa_furnizor: true,  venituri: true,  chit_add: true,  chit_edit: true,  chit_delete: true,  citiri: true,  istoric_index: true,  mesaje: true },
  cenzor:     { lista_plata: true, explicatii: true,  reg_incasari: true,  reg_plati: true,  reg_casa: true,  reg_banca: true,  jurnal: true,  reg_fonduri: true,  restantieri: true,  fisa_proprie: true, fisa_furnizor: true,  venituri: true,  chit_add: false, chit_edit: false, chit_delete: false, citiri: false, istoric_index: true,  mesaje: true },
  membru_cex: { lista_plata: true, explicatii: false, reg_incasari: false, reg_plati: false, reg_casa: false, reg_banca: false, jurnal: false, reg_fonduri: false, restantieri: false, fisa_proprie: true, fisa_furnizor: false, venituri: false, chit_add: false, chit_edit: false, chit_delete: false, citiri: false, istoric_index: false, mesaje: true },
  // Casier: toate rapoartele + apometre (citiri), poate adăuga/edita chitanțe dar NU șterge.
  casier:     { lista_plata: true, explicatii: true,  reg_incasari: true,  reg_plati: true,  reg_casa: true,  reg_banca: true,  jurnal: true,  reg_fonduri: true,  restantieri: true,  fisa_proprie: true, fisa_furnizor: true,  venituri: true,  chit_add: true,  chit_edit: true,  chit_delete: false, citiri: true,  istoric_index: true,  mesaje: true },
};

/** Rolul AsociatieUser (MAJUSCULE) → cheia din matricea de drepturi. */
export function roleKeyFromAsoc(role: string | null | undefined): RoleKey | null {
  switch ((role || "").toUpperCase()) {
    case "PRESEDINTE": return "presedinte";
    case "CENZOR":     return "cenzor";
    case "PROPRIETAR": return "proprietar";
    case "MEMBRU_CEX": return "membru_cex";
    case "CASIER":     return "casier";
    default:           return null;
  }
}

export function emptyPerms(): PermMap {
  const m: PermMap = {};
  for (const k of PERM_KEYS) m[k] = false;
  return m;
}
export function fullPerms(): PermMap {
  const m: PermMap = {};
  for (const k of PERM_KEYS) m[k] = true;
  return m;
}

/** Drepturile efective pentru un rol = defaults ∪ configurarea salvată a organizației. */
export function permsForRole(
  roleKey: RoleKey,
  orgPerms?: Partial<Record<RoleKey, PermMap>> | null,
): PermMap {
  const base  = DEFAULT_PERMS[roleKey] ?? emptyPerms();
  const saved = orgPerms?.[roleKey] ?? {};
  return { ...emptyPerms(), ...base, ...saved };
}
