// Maparea rută → drept necesar. Client-safe (fără db).
// "ADMIN" = doar owner/super-admin; null = permis oricui logat.

type Req = string | "ADMIN" | null;

const PATH_PERM: [string, Req][] = [
  ["/rapoarte/lista-intretinere",   "lista_plata"],
  ["/rapoarte/explicatii-lista",    "explicatii"],
  ["/rapoarte/incasari",            "reg_incasari"],
  ["/rapoarte/registru-plati",      "reg_plati"],
  ["/rapoarte/registru-casa",       "reg_casa"],
  ["/rapoarte/registru-banca",      "reg_banca"],
  ["/rapoarte/registru-jurnal",     "jurnal"],
  ["/rapoarte/fonduri",             "reg_fonduri"],
  ["/rapoarte/situatia-activ-pasiv","venituri"],
  ["/rapoarte/restantieri",         "restantieri"],
  ["/rapoarte/fisa-proprietar",     "fisa_proprie"],
  ["/rapoarte/fisa-furnizor",       "fisa_furnizor"],
  ["/rapoarte/restante-furnizori",  "fisa_furnizor"],
  ["/rapoarte/venituri-cheltuieli", "venituri"],
  ["/contoare",                     "citiri"],
  ["/incasari",                     "chit_add"],
  ["/mesaje",                       "mesaje"],
  ["/ajutor",                       null],
  ["/profil",                       null],
  ["/legal",                        null],
  ["/acces-interzis",               null],
];

export function requiredPerm(pathname: string): Req {
  for (const [prefix, req] of PATH_PERM) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) return req;
  }
  return "ADMIN"; // tot ce nu e mapat = doar admin
}

export function pathAllowed(pathname: string, isAdmin: boolean, can: (k: string) => boolean): boolean {
  const req = requiredPerm(pathname);
  if (req === null)    return true;
  if (req === "ADMIN") return isAdmin;
  return isAdmin || can(req);
}

// Prima pagină permisă pentru un user restricționat (pt. redirect din pagini interzise).
const LANDING_CANDIDATES = [
  "/rapoarte/lista-intretinere",
  "/rapoarte/incasari",
  "/incasari",
  "/contoare/citiri",
  "/mesaje",
];
export function firstAllowedPath(isAdmin: boolean, can: (k: string) => boolean): string {
  if (isAdmin) return "/dashboard";
  for (const p of LANDING_CANDIDATES) if (pathAllowed(p, isAdmin, can)) return p;
  return "/acces-interzis";
}
