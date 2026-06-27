"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import * as XLSX from "xlsx";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AsocInfo {
  name: string; address: string; city: string; sector: string;
  cui: string; adminName: string; presedinteName: string; cenzorName: string;
  bank: string; iban: string; phone: string; email: string;
}

interface BlocRow { name: string; nrScari: string; }

interface FondRow {
  id?:       string;
  name:      string;
  isEnabled: boolean;
  sortOrder: number;
}

interface ApartRow {
  id?:       string;
  numar:     string;
  scara:     string;
  etaj:      string;
  suprafata: string;
  nrPersone: string;
  cotaParte: string;
  proprietarNume?:      string;
  proprietarPrenume?:   string;
  proprietarTelefon?:   string;
  proprietarEmailuri?:  string[];
  restantaIntretinere?: string;
  restantaCurenta?:     string;
}

interface PropRow {
  numar:        string;
  apartamentId: string;
  numeComplet:  string;
  telefon:      string;
  emailuri:     string[];
}

interface SoldRow {
  numar:               string;
  apartamentId:        string;
  restantaIntretinere: string;
  restantaCurenta:     string;
}

interface SoldFondRow {
  numar:        string;
  apartamentId: string;
  fondId:       string;
  fondName:     string;
  restanta:     string;
}

interface SoldContribFondRow {
  numar:        string;
  apartamentId: string;
  fondId:       string;
  fondName:     string;
  sold:         string;
}

interface SubConfig {
  enabled: boolean;
  locatii: string[];
  custom:  string[];
}

interface ConturConfig {
  apa:      { enabled: boolean; rece: SubConfig; calda: SubConfig };
  electric: { enabled: boolean; locatii: string[]; custom: string[] };
  gaz:      { enabled: boolean; locatii: string[]; custom: string[] };
}

interface IndexRow {
  contorId:     string;
  apartamentId: string;
  numar:        string;
  tip:          string;
  locatie:      string;
  denumire:     string;
  numarSerie:   string;
  indexVechi:   string;
  indexNou:     string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_FONDURI: FondRow[] = [
  { name: "Fond Rulment",    isEnabled: true,  sortOrder: 0 },
  { name: "Fond Reparații",  isEnabled: true,  sortOrder: 1 },
  { name: "Fond Penalități", isEnabled: false, sortOrder: 2 },
  { name: "Fond Special",    isEnabled: false, sortOrder: 3 },
];

const DEFAULT_CONTUR_CONFIG: ConturConfig = {
  apa:      { enabled: false, rece: { enabled: false, locatii: [], custom: [] }, calda: { enabled: false, locatii: [], custom: [] } },
  electric: { enabled: false, locatii: [], custom: [] },
  gaz:      { enabled: false, locatii: [], custom: [] },
};

const APA_LOCATII   = ["bucatarie", "baie", "baie_mica", "general", "gradina"];
const APA_LABELS: Record<string, string>    = { bucatarie: "Bucătărie", baie: "Baie", baie_mica: "Baie mică", general: "General", gradina: "Grădină" };
const SIMPLE_LOCATII = ["general"];
const SIMPLE_LABELS: Record<string, string> = { general: "General" };

const TIP_LABEL: Record<string, string> = {
  apa_rece: "Apă rece", apa_calda: "Apă caldă", electric: "Electric", gaz: "Gaz",
};

const STEP_LABELS = [
  "Info asociație", "Apartamente", "Proprietari", "Solduri",
  "Fonduri", "Restanțe fonduri", "Solduri fonduri", "Sold casă / bancă", "Contoare", "Indecși", "Finalizare",
];

const LUNI_NAMES = [
  "Ianuarie","Februarie","Martie","Aprilie","Mai","Iunie",
  "Iulie","August","Septembrie","Octombrie","Noiembrie","Decembrie",
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface BancaRow {
  name: string;
  sold: string;
  data: string;
}

interface ExistingSoldFond {
  apartamentId: string;
  fondId:       string;
  restanta:     number;
  sold:         number;
}

interface ExistingContor {
  id:           string;
  apartamentId: string;
  numar:        string;
  tip:          string;
  locatie:      string | null;
  denumire:     string | null;
  numarSerie:   string | null;
  indexVechi:   number | null;
  indexNou:     number | null;
}

interface Props {
  asociatieId:         string;
  asociatieNume:       string;
  nrApartamente:       number;
  wizardStep:          number;
  asociatieInfo:       AsocInfo;
  blocuriJson:         string | null;
  existingFonduri:     FondRow[];
  existingApartamente: ApartRow[];
  wizardInitData:      Record<string, unknown>;
  existingSoldFonduri?: ExistingSoldFond[];
  existingContoare?:   ExistingContor[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function genApartRow(nr: number): ApartRow {
  return { numar: nr.toString(), scara: "", etaj: "", suprafata: "", nrPersone: "2", cotaParte: "" };
}

function buildPropRows(aps: ApartRow[]): PropRow[] {
  return aps.map(ap => ({
    numar:        ap.numar,
    apartamentId: ap.id ?? "",
    numeComplet:  [ap.proprietarPrenume, ap.proprietarNume].filter(Boolean).join(" ") || (ap.proprietarNume ?? ""),
    telefon:      ap.proprietarTelefon ?? "",
    emailuri:     ap.proprietarEmailuri?.length ? ap.proprietarEmailuri : [""],
  }));
}

function buildSoldRows(aps: ApartRow[]): SoldRow[] {
  return aps.map(ap => ({
    numar:               ap.numar,
    apartamentId:        ap.id ?? "",
    restantaIntretinere: ap.restantaIntretinere && ap.restantaIntretinere !== "0" ? ap.restantaIntretinere : "",
    restantaCurenta:     ap.restantaCurenta     && ap.restantaCurenta     !== "0" ? ap.restantaCurenta     : "",
  }));
}

function buildSoldFondRows(aps: ApartRow[], fonduri: FondRow[], existingSF?: ExistingSoldFond[]): SoldFondRow[] {
  const active = fonduri.filter(f => f.isEnabled);
  return aps.flatMap(ap => active.map(f => {
    const sf = existingSF?.find(s => s.apartamentId === (ap.id ?? "") && s.fondId === (f.id ?? ""));
    return {
      numar: ap.numar, apartamentId: ap.id ?? "", fondId: f.id ?? "", fondName: f.name,
      restanta: sf && sf.restanta !== 0 ? sf.restanta.toFixed(2) : "",
    };
  }));
}

function buildSoldContribFondRows(aps: ApartRow[], fonduri: FondRow[], existingSF?: ExistingSoldFond[]): SoldContribFondRow[] {
  const active = fonduri.filter(f => f.isEnabled);
  return aps.flatMap(ap => active.map(f => {
    const sf = existingSF?.find(s => s.apartamentId === (ap.id ?? "") && s.fondId === (f.id ?? ""));
    return {
      numar: ap.numar, apartamentId: ap.id ?? "", fondId: f.id ?? "", fondName: f.name,
      sold: sf && sf.sold !== 0 ? sf.sold.toFixed(2) : "",
    };
  }));
}

function buildConturConfig(contoare: ExistingContor[]): ConturConfig {
  if (!contoare.length) return DEFAULT_CONTUR_CONFIG;
  const byTip    = (tip: string) => contoare.filter(c => c.tip === tip);
  const getLocs  = (cs: ExistingContor[], known: string[]) =>
    [...new Set(cs.map(c => c.locatie ?? "").filter(l => known.includes(l)))];
  const getCustom = (cs: ExistingContor[], known: string[]) =>
    [...new Set(cs.filter(c => !known.includes(c.locatie ?? "")).map(c => c.denumire || c.locatie || "").filter(Boolean))];

  const rece  = byTip("apa_rece");
  const calda = byTip("apa_calda");
  const elec  = byTip("electric");
  const gaz   = byTip("gaz");

  return {
    apa: {
      enabled: rece.length > 0 || calda.length > 0,
      rece:  { enabled: rece.length  > 0, locatii: getLocs(rece,  APA_LOCATII), custom: getCustom(rece,  APA_LOCATII) },
      calda: { enabled: calda.length > 0, locatii: getLocs(calda, APA_LOCATII), custom: getCustom(calda, APA_LOCATII) },
    },
    electric: { enabled: elec.length > 0, locatii: getLocs(elec, SIMPLE_LOCATII), custom: getCustom(elec, SIMPLE_LOCATII) },
    gaz:      { enabled: gaz.length  > 0, locatii: getLocs(gaz,  SIMPLE_LOCATII), custom: getCustom(gaz,  SIMPLE_LOCATII) },
  };
}

function buildIndexRows(contoare: ExistingContor[]): IndexRow[] {
  return contoare.map(c => ({
    contorId:     c.id,
    apartamentId: c.apartamentId,
    numar:        c.numar,
    tip:          c.tip,
    locatie:      c.locatie  ?? "",
    denumire:     c.denumire ?? "",
    numarSerie:   c.numarSerie ?? "",
    indexVechi:   c.indexVechi !== null && c.indexVechi !== undefined ? String(c.indexVechi) : "",
    indexNou:     c.indexNou   !== null && c.indexNou   !== undefined ? String(c.indexNou)   : "",
  }));
}

function parseBlocuri(json: string | null): BlocRow[] {
  if (!json) return [{ name: "Bloc 1", nrScari: "1" }];
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {}
  return [{ name: "Bloc 1", nrScari: "1" }];
}

// ─── Sub-component: LocatiiSection ───────────────────────────────────────────

function LocatiiSection({
  title, locatii, labels, selected, custom,
  onToggle, onAddCustom, onRemoveCustom,
}: {
  title:          string;
  locatii:        string[];
  labels:         Record<string, string>;
  selected:       string[];
  custom:         string[];
  onToggle:       (loc: string) => void;
  onAddCustom:    (val: string) => void;
  onRemoveCustom: (idx: number) => void;
}) {
  const [newVal, setNewVal] = useState("");

  function add() {
    if (!newVal.trim()) return;
    onAddCustom(newVal.trim());
    setNewVal("");
  }

  return (
    <div className="loc-section">
      <div className="loc-section__title">{title}</div>
      <div className="loc-section__checks">
        {locatii.map(loc => (
          <label key={loc} className="loc-check">
            <input type="checkbox" checked={selected.includes(loc)} onChange={() => onToggle(loc)} className="fond-row__check" />
            <span>{labels[loc] ?? loc}</span>
          </label>
        ))}
        {custom.map((c, i) => (
          <label key={`c${i}`} className="loc-check loc-check--custom">
            <input type="checkbox" checked readOnly className="fond-row__check" />
            <span>{c}</span>
            <button type="button" className="fond-row__del" onClick={() => onRemoveCustom(i)}>×</button>
          </label>
        ))}
      </div>
      <div className="fond-add" style={{ marginTop: "0.75rem" }}>
        <input
          type="text" className="input input--sm fond-add__input"
          placeholder="Alt contor (denumire)..."
          value={newVal} onChange={e => setNewVal(e.target.value)}
          onKeyDown={e => e.key === "Enter" && add()}
        />
        <button type="button" className="btn btn--secondary" style={{ padding: "0.375rem 0.75rem", fontSize: "0.8125rem" }} onClick={add}>
          + Adaugă
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function WizardClient({
  asociatieId, asociatieNume, nrApartamente, wizardStep,
  asociatieInfo, blocuriJson, existingFonduri, existingApartamente, wizardInitData,
  existingSoldFonduri, existingContoare,
}: Props) {
  const router = useRouter();

  const initStep = Math.min(Math.max(wizardStep, 0) + 1, 11);
  const [step,    setStep]    = useState<number>(initStep);
  const [maxStep, setMaxStep] = useState<number>(initStep);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // ── Step 1: Info asociație + Blocuri ──
  const [asocInfo, setAsocInfo] = useState<AsocInfo>(asociatieInfo);
  const [blocuri,  setBlocuri]  = useState<BlocRow[]>(parseBlocuri(blocuriJson));
  const [infoTab,  setInfoTab]  = useState<"info" | "blocuri">("info");

  // ── Step 2: Apartamente ──
  const initAps = existingApartamente.length > 0
    ? existingApartamente
    : Array.from({ length: nrApartamente || 1 }, (_, i) => genApartRow(i + 1));
  const [apartamente, setApartamente] = useState<ApartRow[]>(initAps);
  const [nrAp,        setNrAp]        = useState(nrApartamente || initAps.length);

  // ── Step 3: Proprietari ──
  const [proprietari, setProprietari] = useState<PropRow[]>(buildPropRows(initAps));
  const [propTab,     setPropTab]     = useState<"date" | "emailuri">("date");

  // ── Step 4: Solduri ──
  const [solduri, setSolduri] = useState<SoldRow[]>(buildSoldRows(initAps));

  // ── Step 5: Fonduri ──
  const [fonduri,     setFonduri]     = useState<FondRow[]>(existingFonduri.length > 0 ? existingFonduri : DEFAULT_FONDURI);
  const [newFondName, setNewFondName] = useState("");

  // ── Step 6: Restanțe fonduri ──
  const [soldFonduri, setSoldFonduri] = useState<SoldFondRow[]>(buildSoldFondRows(initAps, existingFonduri.length > 0 ? existingFonduri : DEFAULT_FONDURI, existingSoldFonduri));

  // ── Step 7: Solduri fonduri (contribuții acumulate) ──
  const [soldContribFonduri, setSoldContribFonduri] = useState<SoldContribFondRow[]>(buildSoldContribFondRows(initAps, existingFonduri.length > 0 ? existingFonduri : DEFAULT_FONDURI, existingSoldFonduri));

  // ── Step 7: Sold casă / bancă + prima listă de plată ──
  const _today = new Date().toISOString().slice(0, 10);
  const _now   = new Date();
  const [soldCasa,       setSoldCasa]       = useState<string>(String(wizardInitData.soldCasa ?? ""));
  const [dataSoldCasa,   setDateSoldCasa]   = useState<string>(String(wizardInitData.dataSoldCasa ?? _today));
  const [banci,          setBanci]          = useState<BancaRow[]>(() => {
    const raw = wizardInitData.banci as Array<{ name?: unknown; sold?: unknown; data?: unknown }> | null | undefined;
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map(b => ({
        name: typeof b.name === "string" ? b.name : "",
        sold: b.sold !== null && b.sold !== undefined ? String(b.sold) : "",
        data: typeof b.data === "string" ? b.data : _today,
      }));
    }
    return [{ name: asociatieInfo.bank || "", sold: "", data: _today }];
  });
  const [primaListaLuna, setPrimaListaLuna] = useState<string>(
    wizardInitData.primaListaLuna ? String(wizardInitData.primaListaLuna) : String(_now.getMonth() + 1)
  );
  const [primaListaAn,   setPrimaListaAn]   = useState<string>(
    wizardInitData.primaListaAn ? String(wizardInitData.primaListaAn) : String(_now.getFullYear())
  );

  // ── Step 8: Contoare ──
  const [conturCfg, setConturCfg] = useState<ConturConfig>(
    existingContoare?.length ? buildConturConfig(existingContoare) : DEFAULT_CONTUR_CONFIG
  );
  const [conturTab, setConturTab] = useState<"tipuri" | "apa" | "electric" | "gaz">("tipuri");

  // ── Step 9: Indecși ──
  const [indexRows, setIndexRows] = useState<IndexRow[]>(
    existingContoare?.length ? buildIndexRows(existingContoare) : []
  );

  // ─── API helper ──────────────────────────────────────────────────────────

  async function api(path: string, body: unknown) {
    const res = await fetch(`/api/asociatii/${asociatieId}/${path}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    let data: any = {};
    try { data = await res.json(); } catch { /* empty */ }
    if (!res.ok) throw new Error(data.error ?? `Eroare (${res.status})`);
    return data;
  }

  // ─── Save handlers ────────────────────────────────────────────────────────

  const saveInfo = useCallback(async () => {
    setSaving(true); setError(null);
    try {
      await api("info", { info: asocInfo, blocuri });
      setMaxStep(prev => Math.max(prev, 2)); setStep(2);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }, [asocInfo, blocuri]);

  const saveApartamente = useCallback(async () => {
    setSaving(true); setError(null);
    try {
      const data = await api("apartamente", { apartamente });
      const saved: { id: string; numar: string }[] = data.apartamente;
      const merged = apartamente.map(ap => ({ ...ap, id: saved.find(s => s.numar === ap.numar)?.id ?? ap.id }));
      setApartamente(merged);
      setProprietari(prev => {
        const prevMap = new Map(prev.map(p => [p.apartamentId, p]));
        return buildPropRows(merged).map(row => prevMap.get(row.apartamentId) ?? row);
      });
      // Preserve any solduri values already entered by user
      setSolduri(prev => {
        const prevMap = new Map(prev.map(s => [s.apartamentId, s]));
        return buildSoldRows(merged).map(row => {
          const ex = prevMap.get(row.apartamentId);
          return ex ? { ...row, restantaIntretinere: ex.restantaIntretinere, restantaCurenta: ex.restantaCurenta } : row;
        });
      });
      // Preserve existing soldFonduri values
      setSoldFonduri(prev => {
        const prevMap = new Map(prev.map(sf => [`${sf.apartamentId}:${sf.fondId}`, sf]));
        return buildSoldFondRows(merged, fonduri,
          prev.map(sf => ({ apartamentId: sf.apartamentId, fondId: sf.fondId, restanta: parseFloat(sf.restanta) || 0, sold: 0 }))
        ).map(row => {
          const ex = prevMap.get(`${row.apartamentId}:${row.fondId}`);
          return ex ? { ...row, restanta: ex.restanta } : row;
        });
      });
      setMaxStep(p => Math.max(p, 3)); setStep(3);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }, [apartamente, fonduri]);

  const saveProprietari = useCallback(async () => {
    setSaving(true); setError(null);
    try {
      const payload = proprietari.map(p => {
        const parts   = p.numeComplet.trim().split(/\s+/);
        const prenume = parts.length > 1 ? parts.slice(0, -1).join(" ") : "";
        const nume    = parts.length > 1 ? parts[parts.length - 1] : (parts[0] ?? "");
        return {
          apartamentId: p.apartamentId, numar: p.numar,
          numeComplet: p.numeComplet, nume, prenume, telefon: p.telefon,
          emailuri: p.emailuri.filter(Boolean),
        };
      });
      await api("proprietari", { proprietari: payload });
      setMaxStep(p => Math.max(p, 4)); setStep(4);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }, [proprietari]);

  const saveSolduri = useCallback(async () => {
    setSaving(true); setError(null);
    try {
      await api("solduri", {
        solduri: solduri.map(s => ({
          ...s,
          restantaIntretinere: s.restantaIntretinere || "0",
          restantaCurenta:     s.restantaCurenta     || "0",
        })),
      });
      setMaxStep(p => Math.max(p, 5)); setStep(5);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }, [solduri]);

  const saveFonduri = useCallback(async () => {
    setSaving(true); setError(null);
    try {
      const data = await api("fonduri", { fonduri: fonduri.map((f, i) => ({ ...f, sortOrder: i })) });
      if (data.fonduri) {
        setFonduri(data.fonduri);
        // Preserve existing restanta values entered by user
        setSoldFonduri(prev => {
          const prevMap = new Map(prev.map(sf => [`${sf.apartamentId}:${sf.fondId}`, sf]));
          return buildSoldFondRows(apartamente, data.fonduri,
            prev.map(sf => ({ apartamentId: sf.apartamentId, fondId: sf.fondId, restanta: parseFloat(sf.restanta) || 0, sold: 0 }))
          ).map(row => {
            const ex = prevMap.get(`${row.apartamentId}:${row.fondId}`);
            return ex ? { ...row, restanta: ex.restanta } : row;
          });
        });
        // Preserve existing sold values entered by user
        setSoldContribFonduri(prev => {
          const prevMap = new Map(prev.map(sf => [`${sf.apartamentId}:${sf.fondId}`, sf]));
          return buildSoldContribFondRows(apartamente, data.fonduri,
            prev.map(sf => ({ apartamentId: sf.apartamentId, fondId: sf.fondId, restanta: 0, sold: parseFloat(sf.sold) || 0 }))
          ).map(row => {
            const ex = prevMap.get(`${row.apartamentId}:${row.fondId}`);
            return ex ? { ...row, sold: ex.sold } : row;
          });
        });
      }
      setMaxStep(p => Math.max(p, 6)); setStep(6);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }, [fonduri, apartamente]);

  const saveSoldFonduri = useCallback(async () => {
    setSaving(true); setError(null);
    try {
      await api("sold-fonduri", { soldFonduri });
      setMaxStep(p => Math.max(p, 7)); setStep(7);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }, [soldFonduri]);

  const saveSolduriContribFonduri = useCallback(async () => {
    setSaving(true); setError(null);
    try {
      await api("solduri-fonduri", { solduriFonduri: soldContribFonduri.map(s => ({ apartamentId: s.apartamentId, fondId: s.fondId, sold: s.sold || "0" })) });
      setMaxStep(p => Math.max(p, 8)); setStep(8);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }, [soldContribFonduri]);

  const saveSoldInitial = useCallback(async () => {
    setSaving(true); setError(null);
    try {
      await api("sold-initial", {
        soldCasa:       soldCasa       ? parseFloat(soldCasa)       : null,
        dataSoldCasa,
        banci:          banci.map(b => ({ ...b, sold: b.sold ? parseFloat(b.sold) : null })),
        primaListaLuna: primaListaLuna ? parseInt(primaListaLuna) : null,
        primaListaAn:   primaListaAn   ? parseInt(primaListaAn)   : null,
      });
      setMaxStep(p => Math.max(p, 9)); setStep(9);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }, [soldCasa, dataSoldCasa, banci, primaListaLuna, primaListaAn]);

  const saveContoare = useCallback(async () => {
    setSaving(true); setError(null);
    try {
      const data = await api("contoare", { config: conturCfg });
      const saved: { id: string; apartamentId: string; numar: string; tip: string; locatie: string; denumire: string }[] = data.contoare ?? [];
      setIndexRows(prev => saved.map(c => {
        const match = prev.find(r =>
          r.apartamentId === c.apartamentId &&
          r.tip          === c.tip          &&
          r.locatie      === c.locatie      &&
          r.denumire     === c.denumire
        );
        return {
          contorId: c.id, apartamentId: c.apartamentId, numar: c.numar,
          tip: c.tip, locatie: c.locatie, denumire: c.denumire,
          numarSerie: match?.numarSerie ?? "",
          indexVechi: match?.indexVechi ?? "",
          indexNou:   match?.indexNou   ?? "",
        };
      }));
      setMaxStep(p => Math.max(p, 10)); setStep(10);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }, [conturCfg]);

  const saveIndecsi = useCallback(async () => {
    setSaving(true); setError(null);
    try {
      await api("index-contoare", {
        indecsi: indexRows.map(r => ({ contorId: r.contorId, numarSerie: r.numarSerie, indexVechi: r.indexVechi, indexNou: r.indexNou })),
      });
      setMaxStep(p => Math.max(p, 11)); setStep(11);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }, [indexRows]);

  // ─── Silent save (fără navigare) — folosit la Înapoi și la click pe step label ─
  const silentSaveStep = useCallback(async (s: number) => {
    try {
      if (s === 1) await api("info", { info: asocInfo, blocuri });
      else if (s === 3) {
        const payload = proprietari.map(p => {
          const parts = p.numeComplet.trim().split(/\s+/);
          const prenume = parts.length > 1 ? parts.slice(0, -1).join(" ") : "";
          const nume    = parts.length > 1 ? parts[parts.length - 1] : (parts[0] ?? "");
          return { apartamentId: p.apartamentId, numar: p.numar, numeComplet: p.numeComplet, nume, prenume, telefon: p.telefon, emailuri: p.emailuri.filter(Boolean) };
        });
        await api("proprietari", { proprietari: payload });
      }
      else if (s === 4) await api("solduri", { solduri: solduri.map(s2 => ({ ...s2, restantaIntretinere: s2.restantaIntretinere || "0", restantaCurenta: s2.restantaCurenta || "0" })) });
      else if (s === 6) await api("sold-fonduri", { soldFonduri });
      else if (s === 7) await api("solduri-fonduri", { solduriFonduri: soldContribFonduri.map(s2 => ({ apartamentId: s2.apartamentId, fondId: s2.fondId, sold: s2.sold || "0" })) });
      else if (s === 8) await api("sold-initial", { soldCasa: soldCasa ? parseFloat(soldCasa) : null, dataSoldCasa, banci: banci.map(b => ({ ...b, sold: b.sold ? parseFloat(b.sold) : null })), primaListaLuna: primaListaLuna ? parseInt(primaListaLuna) : null, primaListaAn: primaListaAn ? parseInt(primaListaAn) : null });
    } catch { /* silent — nu blocăm navigarea */ }
  }, [asocInfo, blocuri, proprietari, solduri, soldFonduri, soldContribFonduri, soldCasa, dataSoldCasa, banci, primaListaLuna, primaListaAn]);

  const finalizeaza = useCallback(async () => {
    setSaving(true); setError(null);
    try {
      await api("finalizeaza", {});
      router.push(`/asociatii/${asociatieId}`);
      router.refresh();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }, []);

  // ─── XLS import ref ───────────────────────────────────────────────────────
  const xlsInputRef = useRef<HTMLInputElement>(null);

  function handleXlsImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const data = ev.target?.result;
      if (!data) return;
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      // Skip header row if first cell is not a number
      const dataRows = rows.filter((r, i) => {
        if (i === 0) {
          const first = String(r[0] ?? "").trim();
          return !isNaN(Number(first)) && first !== "";
        }
        return true;
      });
      if (dataRows.length === 0) return;
      setApartamente(prev => {
        const next = [...prev];
        dataRows.forEach(row => {
          const numar     = String(row[0] ?? "").trim();
          const suprafata = String(row[1] ?? "").trim();
          const nrPersone = String(row[2] ?? "").trim();
          const cotaParte = String(row[3] ?? "").trim();
          if (!numar) return;
          const idx = next.findIndex(ap => ap.numar === numar);
          if (idx >= 0) {
            next[idx] = {
              ...next[idx],
              suprafata: suprafata || next[idx].suprafata,
              nrPersone: nrPersone || next[idx].nrPersone,
              cotaParte: cotaParte || next[idx].cotaParte,
            };
          } else {
            next.push({ numar, scara: "", etaj: "", suprafata, nrPersone: nrPersone || "2", cotaParte });
          }
        });
        return next;
      });
      setNrAp(prev => Math.max(prev, dataRows.length));
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  }

  // ─── Updaters ─────────────────────────────────────────────────────────────

  function updateNrAp(n: number) {
    const nr = Math.max(1, n);
    setNrAp(nr);
    setApartamente(prev =>
      nr > prev.length
        ? [...prev, ...Array.from({ length: nr - prev.length }, (_, i) => genApartRow(prev.length + i + 1))]
        : prev.slice(0, nr)
    );
  }

  function updateIndex(i: number, field: keyof IndexRow, val: string) {
    setIndexRows(prev => prev.map((r, j) => j === i ? { ...r, [field]: val } : r));
  }

  function getConsum(r: IndexRow): string {
    const v = parseFloat(r.indexVechi);
    const n = parseFloat(r.indexNou);
    if (isNaN(v) || isNaN(n) || r.indexVechi === "" || r.indexNou === "") return "—";
    const c = n - v;
    return c < 0 ? `⚠ ${c.toFixed(3)}` : c.toFixed(3);
  }

  // Email helpers for step 3
  function addEmail(propIdx: number) {
    setProprietari(prev => prev.map((p, i) =>
      i === propIdx ? { ...p, emailuri: [...p.emailuri, ""] } : p
    ));
  }
  function removeEmail(propIdx: number, emailIdx: number) {
    setProprietari(prev => prev.map((p, i) =>
      i === propIdx ? { ...p, emailuri: p.emailuri.filter((_, j) => j !== emailIdx) } : p
    ));
  }
  function updateEmail(propIdx: number, emailIdx: number, val: string) {
    setProprietari(prev => prev.map((p, i) =>
      i === propIdx ? { ...p, emailuri: p.emailuri.map((e, j) => j === emailIdx ? val : e) } : p
    ));
  }

  // Contur config helpers
  function toggleApaLoc(sub: "rece" | "calda", loc: string) {
    setConturCfg(prev => {
      const cur = prev.apa[sub].locatii;
      return { ...prev, apa: { ...prev.apa, [sub]: { ...prev.apa[sub], locatii: cur.includes(loc) ? cur.filter(l => l !== loc) : [...cur, loc] } } };
    });
  }
  function addApaCustom(sub: "rece" | "calda", val: string) {
    setConturCfg(prev => ({ ...prev, apa: { ...prev.apa, [sub]: { ...prev.apa[sub], custom: [...prev.apa[sub].custom, val] } } }));
  }
  function removeApaCustom(sub: "rece" | "calda", idx: number) {
    setConturCfg(prev => ({ ...prev, apa: { ...prev.apa, [sub]: { ...prev.apa[sub], custom: prev.apa[sub].custom.filter((_, i) => i !== idx) } } }));
  }
  function toggleSimpleLoc(tip: "electric" | "gaz", loc: string) {
    setConturCfg(prev => {
      const cur = prev[tip].locatii;
      return { ...prev, [tip]: { ...prev[tip], locatii: cur.includes(loc) ? cur.filter(l => l !== loc) : [...cur, loc] } };
    });
  }
  function addSimpleCustom(tip: "electric" | "gaz", val: string) {
    setConturCfg(prev => ({ ...prev, [tip]: { ...prev[tip], custom: [...prev[tip].custom, val] } }));
  }
  function removeSimpleCustom(tip: "electric" | "gaz", idx: number) {
    setConturCfg(prev => ({ ...prev, [tip]: { ...prev[tip], custom: prev[tip].custom.filter((_, i) => i !== idx) } }));
  }

  // ─── Derived ──────────────────────────────────────────────────────────────

  const totalRestante  = solduri.reduce((s, r) => s + (parseFloat(r.restantaIntretinere) || 0), 0);
  const totalCurente   = solduri.reduce((s, r) => s + (parseFloat(r.restantaCurenta)     || 0), 0);
  const fondActive     = fonduri.filter(f => f.isEnabled);
  const nrProprietari  = proprietari.filter(p => p.numeComplet.trim()).length;
  const apsWithFonduri = apartamente.map((ap, idx) => ({
    ap, prop: proprietari[idx],
    rows: soldFonduri.filter(sf => sf.numar === ap.numar),
  }));
  const apsWithIndex = apartamente.map(ap => ({
    ap,
    prop: proprietari.find(p => p.numar === ap.numar),
    rows: indexRows.filter(r => r.numar === ap.numar),
  })).filter(x => x.rows.length > 0);

  const conturTabsVisible = [
    "tipuri",
    ...(conturCfg.apa.enabled      ? ["apa"]      : []),
    ...(conturCfg.electric.enabled ? ["electric"] : []),
    ...(conturCfg.gaz.enabled      ? ["gaz"]      : []),
  ] as ("tipuri" | "apa" | "electric" | "gaz")[];

  const conturTabLabel: Record<string, string> = { tipuri: "Tipuri", apa: "Apă", electric: "Electric", gaz: "Gaz" };

  const displayName = asocInfo.name || asociatieNume;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="wizard">
      <div className="wizard__header">
        <div>
          <Link href={`/asociatii/${asociatieId}`} className="back-link">← {displayName}</Link>
          <h1 className="page-title" style={{ marginTop: "0.25rem" }}>Inițializare asociație</h1>
          <p className="page-sub">Configurează datele asociației, apartamentele și soldurile inițiale.</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="wizard__steps">
        {STEP_LABELS.map((label, i) => {
          const n = i + 1; const done = n < step; const current = n === step;
          const clickable = n !== step && n <= maxStep;
          return (
            <div key={n} className={`wizard__step${done ? " wizard__step--done" : current ? " wizard__step--active" : ""}${clickable ? " wizard__step--clickable" : ""}`}>
              <div
                className="wizard__step-dot"
                role={clickable ? "button" : undefined}
                tabIndex={clickable ? 0 : undefined}
                onClick={() => { if (clickable) { silentSaveStep(step).then(() => setStep(n)); } }}
                onKeyDown={e => { if (clickable && e.key === "Enter") { silentSaveStep(step).then(() => setStep(n)); } }}
              >
                {done ? "✓" : n}
              </div>
              <span className="wizard__step-label">{label}</span>
              {i < STEP_LABELS.length - 1 && <div className="wizard__step-line" />}
            </div>
          );
        })}
      </div>

      {error && <div className="wizard__error">{error}</div>}

      {/* ── Step 1: Info asociație + Blocuri ───────────────────────────── */}
      {step === 1 && (
        <div className="wizard__body">
          <h2 className="wizard__step-title">Informații asociație</h2>

          <div className="contur-tabs" style={{ marginBottom: "1.5rem" }}>
            {(["info", "blocuri"] as const).map(t => (
              <button key={t} type="button"
                className={`contur-tab${infoTab === t ? " contur-tab--active" : ""}`}
                onClick={() => setInfoTab(t)}
              >
                {t === "info" ? "Date generale" : "Blocuri"}
              </button>
            ))}
          </div>

          {infoTab === "info" && (
            <div className="contur-tab-body">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div className="form-field">
                  <label className="form-field__label">Denumire asociație *</label>
                  <input type="text" className="input" value={asocInfo.name}
                    onChange={e => setAsocInfo(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label className="form-field__label">CUI</label>
                  <input type="text" className="input" value={asocInfo.cui}
                    onChange={e => setAsocInfo(p => ({ ...p, cui: e.target.value }))} placeholder="ex: 1234567" />
                </div>
                <div className="form-field" style={{ gridColumn: "1 / -1" }}>
                  <label className="form-field__label">Adresă</label>
                  <input type="text" className="input" value={asocInfo.address}
                    onChange={e => setAsocInfo(p => ({ ...p, address: e.target.value }))} placeholder="Str. Exemplu nr. 10" />
                </div>
                <div className="form-field">
                  <label className="form-field__label">Localitate</label>
                  <input type="text" className="input" value={asocInfo.city}
                    onChange={e => setAsocInfo(p => ({ ...p, city: e.target.value }))} placeholder="București" />
                </div>
                <div className="form-field">
                  <label className="form-field__label">Sector / Județ</label>
                  <input type="text" className="input" value={asocInfo.sector}
                    onChange={e => setAsocInfo(p => ({ ...p, sector: e.target.value }))} placeholder="ex: 3 sau Ilfov" />
                </div>
                <div className="form-field">
                  <label className="form-field__label">Telefon</label>
                  <input type="text" className="input" value={asocInfo.phone}
                    onChange={e => setAsocInfo(p => ({ ...p, phone: e.target.value }))} placeholder="021 xxx xxxx" />
                </div>
                <div className="form-field">
                  <label className="form-field__label">Email</label>
                  <input type="email" className="input" value={asocInfo.email}
                    onChange={e => setAsocInfo(p => ({ ...p, email: e.target.value }))} placeholder="asociatie@email.ro" />
                </div>
                <div className="form-field">
                  <label className="form-field__label">Administrator</label>
                  <input type="text" className="input" value={asocInfo.adminName}
                    onChange={e => setAsocInfo(p => ({ ...p, adminName: e.target.value }))} placeholder="Nume administrator" />
                </div>
                <div className="form-field">
                  <label className="form-field__label">Președinte</label>
                  <input type="text" className="input" value={asocInfo.presedinteName}
                    onChange={e => setAsocInfo(p => ({ ...p, presedinteName: e.target.value }))} placeholder="Nume președinte" />
                </div>
                <div className="form-field">
                  <label className="form-field__label">Cenzor</label>
                  <input type="text" className="input" value={asocInfo.cenzorName}
                    onChange={e => setAsocInfo(p => ({ ...p, cenzorName: e.target.value }))} placeholder="Nume cenzor" />
                </div>
                <div className="form-field">
                  <label className="form-field__label">Bancă</label>
                  <input type="text" className="input" value={asocInfo.bank}
                    onChange={e => setAsocInfo(p => ({ ...p, bank: e.target.value }))} placeholder="ex: BCR" />
                </div>
                <div className="form-field">
                  <label className="form-field__label">IBAN</label>
                  <input type="text" className="input" value={asocInfo.iban}
                    onChange={e => setAsocInfo(p => ({ ...p, iban: e.target.value }))} placeholder="RO..." />
                </div>
              </div>
            </div>
          )}

          {infoTab === "blocuri" && (
            <div className="contur-tab-body">
              <p className="wizard__step-desc" style={{ marginBottom: "1rem" }}>
                Definește blocurile și numărul de scări pentru fiecare.
              </p>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Denumire bloc</th>
                      <th style={{ width: "120px" }}>Nr. scări</th>
                      <th style={{ width: "48px" }} />
                    </tr>
                  </thead>
                  <tbody>
                    {blocuri.map((b, i) => (
                      <tr key={i}>
                        <td>
                          <input type="text" className="input input--sm" value={b.name}
                            onChange={e => setBlocuri(prev => prev.map((r, j) => j === i ? { ...r, name: e.target.value } : r))}
                            style={{ width: "100%" }} placeholder="ex: Bloc A" />
                        </td>
                        <td>
                          <input type="number" className="input input--sm" value={b.nrScari}
                            onChange={e => setBlocuri(prev => prev.map((r, j) => j === i ? { ...r, nrScari: e.target.value } : r))}
                            style={{ width: "80px" }} min={1} max={20} />
                        </td>
                        <td>
                          {blocuri.length > 1 && (
                            <button type="button" className="fond-row__del"
                              onClick={() => setBlocuri(prev => prev.filter((_, j) => j !== i))}>×</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: "0.75rem" }}>
                <button type="button" className="btn btn--secondary"
                  onClick={() => setBlocuri(prev => [...prev, { name: `Bloc ${prev.length + 1}`, nrScari: "1" }])}>
                  + Adaugă bloc
                </button>
              </div>
            </div>
          )}

          <div className="wizard__footer">
            <span />
            <button className="btn btn--primary" onClick={saveInfo} disabled={saving}>
              {saving ? "Se salvează..." : "Continuă →"}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Apartamente ─────────────────────────────────────────── */}
      {step === 2 && (
        <div className="wizard__body">
          <h2 className="wizard__step-title">Apartamente</h2>
          <p className="wizard__step-desc">Completează datele fiecărui apartament.</p>
          <div className="wizard__nr-ap">
            <label className="form-field__label">Număr apartamente</label>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.375rem" }}>
              <input type="number" className="input" style={{ width: "100px" }} value={nrAp} min={1} max={999}
                onChange={e => updateNrAp(parseInt(e.target.value) || 1)} />
              <span className="page-sub">{apartamente.length} rânduri</span>
            </div>
          </div>

          {/* Import XLS */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem", margin: "1rem 0 0.5rem" }}>
            <div>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => xlsInputRef.current?.click()}
                title="Importă date apartamente din fișier Excel"
              >
                ⬆ Importă XLS
              </button>
              <input
                ref={xlsInputRef}
                type="file"
                accept=".xls,.xlsx,.ods,.csv"
                style={{ display: "none" }}
                onChange={handleXlsImport}
              />
            </div>
            <div style={{ fontSize: "0.78rem", color: "#94a3b8", lineHeight: 1.55, paddingTop: "0.25rem" }}>
              Fișierul trebuie să aibă <strong style={{ color: "#a78bfa" }}>4 coloane</strong>, în această ordine:<br />
              <span style={{ color: "#cbd5e1" }}>
                Coloana 1: Nr. apartament &nbsp;·&nbsp;
                Coloana 2: Suprafață (m²) &nbsp;·&nbsp;
                Coloana 3: Nr. persoane &nbsp;·&nbsp;
                Coloana 4: Cotă parte
              </span><br />
              Primul rând cu text (antet) este ignorat automat.
            </div>
          </div>

          <div className="table-wrap" style={{ marginTop: "1rem" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nr.*</th><th>Scară</th><th>Etaj</th><th>Suprafață (m²)</th><th>Nr. persoane</th><th>Cotă parte</th>
                </tr>
              </thead>
              <tbody>
                {apartamente.map((ap, i) => (
                  <tr key={i}>
                    <td><input type="text"   className="input input--sm" value={ap.numar}     onChange={e => setApartamente(p => p.map((r,j)=>j===i?{...r,numar:e.target.value}:r))}     style={{width:"60px"}} /></td>
                    <td><input type="text"   className="input input--sm" value={ap.scara}     onChange={e => setApartamente(p => p.map((r,j)=>j===i?{...r,scara:e.target.value}:r))}     style={{width:"52px"}} placeholder="A" /></td>
                    <td><input type="number" className="input input--sm" value={ap.etaj}      onChange={e => setApartamente(p => p.map((r,j)=>j===i?{...r,etaj:e.target.value}:r))}      style={{width:"60px"}} /></td>
                    <td><input type="number" className="input input--sm" value={ap.suprafata} onChange={e => setApartamente(p => p.map((r,j)=>j===i?{...r,suprafata:e.target.value}:r))} style={{width:"80px"}} step="0.01" /></td>
                    <td><input type="number" className="input input--sm" value={ap.nrPersone} onChange={e => setApartamente(p => p.map((r,j)=>j===i?{...r,nrPersone:e.target.value}:r))} style={{width:"60px"}} min={0} /></td>
                    <td><input type="number" className="input input--sm" value={ap.cotaParte} onChange={e => setApartamente(p => p.map((r,j)=>j===i?{...r,cotaParte:e.target.value}:r))} style={{width:"80px"}} step="0.0001" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="wizard__footer">
            <button className="btn btn--secondary" onClick={() => { silentSaveStep(2).then(() => setStep(1)); }}>← Înapoi</button>
            <button className="btn btn--primary" onClick={saveApartamente} disabled={saving}>{saving ? "Se salvează..." : "Continuă →"}</button>
          </div>
        </div>
      )}

      {/* ── Step 3: Proprietari ─────────────────────────────────────────── */}
      {step === 3 && (
        <div className="wizard__body">
          <h2 className="wizard__step-title">Proprietari / Locatari</h2>

          <div className="contur-tabs" style={{ marginBottom: "1.5rem" }}>
            {(["date", "emailuri"] as const).map(t => (
              <button key={t} type="button"
                className={`contur-tab${propTab === t ? " contur-tab--active" : ""}`}
                onClick={() => setPropTab(t)}
              >
                {t === "date" ? "Date personale" : "Email-uri"}
              </button>
            ))}
          </div>

          {propTab === "date" && (
            <div className="contur-tab-body">
              <p className="wizard__step-desc" style={{ marginBottom: "1rem" }}>Asociază un proprietar principal fiecărui apartament.</p>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: "60px" }}>Ap.</th>
                      <th>Nume și prenume</th>
                      <th style={{ width: "160px" }}>Telefon</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proprietari.map((p, i) => (
                      <tr key={i}>
                        <td style={{ color: "#a78bfa", fontWeight: 700 }}>{p.numar}</td>
                        <td><input type="text" className="input input--sm" value={p.numeComplet}
                          onChange={e => setProprietari(prev => prev.map((r,j)=>j===i?{...r,numeComplet:e.target.value}:r))}
                          style={{ width: "100%" }} placeholder="ex: Ion Ionescu" /></td>
                        <td><input type="text" className="input input--sm" value={p.telefon}
                          onChange={e => setProprietari(prev => prev.map((r,j)=>j===i?{...r,telefon:e.target.value}:r))}
                          style={{ width: "100%" }} placeholder="07xx xxx xxx" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {propTab === "emailuri" && (
            <div className="contur-tab-body">
              <p className="wizard__step-desc" style={{ marginBottom: "1rem" }}>Adaugă adresele de email pentru fiecare proprietar (poți adăuga mai multe).</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {proprietari.map((p, i) => (
                  <div key={i} className="dash-panel" style={{ padding: "0.875rem 1rem" }}>
                    <div style={{ fontWeight: 700, color: "#a78bfa", marginBottom: "0.625rem", fontSize: "0.875rem" }}>
                      Ap. {p.numar}{p.numeComplet ? ` — ${p.numeComplet}` : ""}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                      {p.emailuri.map((email, ei) => (
                        <div key={ei} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                          <input
                            type="email" className="input input--sm"
                            value={email}
                            onChange={e => updateEmail(i, ei, e.target.value)}
                            style={{ flex: 1, maxWidth: "360px" }}
                            placeholder="email@exemplu.ro"
                          />
                          {p.emailuri.length > 1 && (
                            <button type="button" className="fond-row__del" onClick={() => removeEmail(i, ei)}>×</button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button type="button" className="btn btn--secondary"
                      style={{ marginTop: "0.5rem", padding: "0.25rem 0.625rem", fontSize: "0.8125rem" }}
                      onClick={() => addEmail(i)}>
                      + Email
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="wizard__footer">
            <button className="btn btn--secondary" onClick={() => { silentSaveStep(3).then(() => setStep(2)); }}>← Înapoi</button>
            <button className="btn btn--primary" onClick={saveProprietari} disabled={saving}>{saving ? "Se salvează..." : "Continuă →"}</button>
          </div>
        </div>
      )}

      {/* ── Step 4: Solduri inițiale ─────────────────────────────────────── */}
      {step === 4 && (
        <div className="wizard__body">
          <h2 className="wizard__step-title">Solduri inițiale — Întreținere</h2>
          <p className="wizard__step-desc">Restanțele la întreținere la data preluării. Lasă gol dacă nu există.</p>
          <div className="table-wrap" style={{ marginTop: "1rem" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: "60px" }}>Ap.</th>
                  <th>Proprietar</th>
                  <th style={{ textAlign: "right", width: "190px" }}>Restanță întreținere (lei)</th>
                  <th style={{ textAlign: "right", width: "190px" }}>Restanță curentă (lei)</th>
                </tr>
              </thead>
              <tbody>
                {solduri.map((s, i) => (
                  <tr key={i}>
                    <td style={{ color: "#a78bfa", fontWeight: 700 }}>{s.numar}</td>
                    <td style={{ color: "#94a3b8", fontSize: "0.8125rem" }}>{proprietari[i]?.numeComplet || "—"}</td>
                    <td style={{ textAlign: "right" }}>
                      <input type="number" className="input input--sm" value={s.restantaIntretinere}
                        onChange={e => setSolduri(p => p.map((r,j)=>j===i?{...r,restantaIntretinere:e.target.value}:r))}
                        style={{ width: "150px", textAlign: "right" }} step="0.01" min={0} placeholder="" />
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <input type="number" className="input input--sm" value={s.restantaCurenta}
                        onChange={e => setSolduri(p => p.map((r,j)=>j===i?{...r,restantaCurenta:e.target.value}:r))}
                        style={{ width: "150px", textAlign: "right" }} step="0.01" min={0} placeholder="" />
                    </td>
                  </tr>
                ))}
              </tbody>
              {(totalRestante > 0 || totalCurente > 0) && (
                <tfoot>
                  <tr>
                    <td colSpan={2} style={{ paddingTop: "0.75rem", fontWeight: 700, fontSize: "0.8125rem", color: "#94a3b8" }}>Total:</td>
                    <td style={{ textAlign: "right", fontWeight: 800, color: "#f87171", paddingTop: "0.75rem" }}>
                      {totalRestante > 0 ? `${totalRestante.toFixed(2)} lei` : "—"}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 800, color: "#f87171", paddingTop: "0.75rem" }}>
                      {totalCurente > 0 ? `${totalCurente.toFixed(2)} lei` : "—"}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <div className="wizard__footer">
            <button className="btn btn--secondary" onClick={() => { silentSaveStep(4).then(() => setStep(3)); }}>← Înapoi</button>
            <button className="btn btn--primary" onClick={saveSolduri} disabled={saving}>{saving ? "Se salvează..." : "Continuă →"}</button>
          </div>
        </div>
      )}

      {/* ── Step 5: Fonduri ──────────────────────────────────────────────── */}
      {step === 5 && (
        <div className="wizard__body">
          <h2 className="wizard__step-title">Fonduri asociație</h2>
          <p className="wizard__step-desc">Selectează fondurile pe care le gestionezi.</p>
          <div className="fond-list">
            {fonduri.map((f, i) => (
              <div key={i} className="fond-row">
                <label className="fond-row__label">
                  <input type="checkbox" checked={f.isEnabled}
                    onChange={e => setFonduri(prev => prev.map((r,j) => j===i ? {...r, isEnabled: e.target.checked} : r))}
                    className="fond-row__check" />
                  <span className="fond-row__name">{f.name}</span>
                </label>
                {i >= DEFAULT_FONDURI.length && (
                  <button type="button" className="fond-row__del"
                    onClick={() => setFonduri(prev => prev.filter((_,j) => j!==i))}>×</button>
                )}
              </div>
            ))}
          </div>
          <div className="fond-add">
            <input type="text" className="input fond-add__input" placeholder="Adaugă fond nou..."
              value={newFondName} onChange={e => setNewFondName(e.target.value)}
              onKeyDown={e => { if (e.key==="Enter" && newFondName.trim()) { setFonduri(p => [...p, {name:newFondName.trim(), isEnabled:true, sortOrder:p.length}]); setNewFondName(""); }}} />
            <button type="button" className="btn btn--secondary"
              onClick={() => { if (newFondName.trim()) { setFonduri(p => [...p, {name:newFondName.trim(), isEnabled:true, sortOrder:p.length}]); setNewFondName(""); }}}>
              + Adaugă
            </button>
          </div>
          <div className="wizard__footer">
            <button className="btn btn--secondary" onClick={() => { silentSaveStep(5).then(() => setStep(4)); }}>← Înapoi</button>
            <button className="btn btn--primary" onClick={saveFonduri} disabled={saving}>{saving ? "Se salvează..." : "Continuă →"}</button>
          </div>
        </div>
      )}

      {/* ── Step 6: Restanțe fonduri ─────────────────────────────────────── */}
      {step === 6 && (
        <div className="wizard__body">
          <h2 className="wizard__step-title">Restanțe — Fonduri</h2>
          <p className="wizard__step-desc">Sumele pe care proprietarii le datorează pe fonduri la data preluării. Lasă gol dacă nu există restanțe.</p>
          {fondActive.length === 0 ? (
            <div className="dash-panel__empty">Niciun fond activ.</div>
          ) : (
            <div className="table-wrap" style={{ marginTop: "1rem" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: "60px" }}>Ap.</th>
                    <th>Proprietar</th>
                    {fondActive.map(f => <th key={f.id??f.name} style={{ textAlign:"right", whiteSpace:"nowrap" }}>{f.name} (lei)</th>)}
                  </tr>
                </thead>
                <tbody>
                  {apsWithFonduri.map(({ ap, prop, rows }) => (
                    <tr key={ap.numar}>
                      <td style={{ color: "#a78bfa", fontWeight: 700 }}>{ap.numar}</td>
                      <td style={{ color: "#94a3b8", fontSize: "0.8125rem" }}>{prop?.numeComplet || "—"}</td>
                      {fondActive.map(f => {
                        const gi = soldFonduri.findIndex(sf => sf.numar===ap.numar && sf.fondName===f.name);
                        return (
                          <td key={f.id??f.name} style={{ textAlign: "right" }}>
                            <input type="number" className="input input--sm" value={soldFonduri[gi]?.restanta ?? ""}
                              onChange={e => gi>=0 && setSoldFonduri(prev=>prev.map((s,j)=>j===gi?{...s,restanta:e.target.value}:s))}
                              style={{ width: "110px", textAlign: "right" }} step="0.01" min={0} placeholder="" />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="wizard__footer">
            <button className="btn btn--secondary" onClick={() => { silentSaveStep(6).then(() => setStep(5)); }}>← Înapoi</button>
            <button className="btn btn--primary" onClick={saveSoldFonduri} disabled={saving}>{saving ? "Se salvează..." : "Continuă →"}</button>
          </div>
        </div>
      )}

      {/* ── Step 7: Solduri fonduri (contribuții acumulate) ──────────────── */}
      {step === 7 && (
        <div className="wizard__body">
          <h2 className="wizard__step-title">Solduri — Fonduri</h2>
          <p className="wizard__step-desc">Contribuțiile acumulate de proprietari la fiecare fond de-a lungul timpului. Lasă gol dacă nu există sold acumulat.</p>
          {fondActive.length === 0 ? (
            <div className="dash-panel__empty">Niciun fond activ.</div>
          ) : (
            <div className="table-wrap" style={{ marginTop: "1rem" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: "60px" }}>Ap.</th>
                    <th>Proprietar</th>
                    {fondActive.map(f => <th key={f.id ?? f.name} style={{ textAlign: "right", whiteSpace: "nowrap" }}>{f.name} (lei)</th>)}
                  </tr>
                </thead>
                <tbody>
                  {apsWithFonduri.map(({ ap, prop }) => (
                    <tr key={ap.numar}>
                      <td style={{ color: "#a78bfa", fontWeight: 700 }}>{ap.numar}</td>
                      <td style={{ color: "#94a3b8", fontSize: "0.8125rem" }}>{prop?.numeComplet || "—"}</td>
                      {fondActive.map(f => {
                        const gi = soldContribFonduri.findIndex(sf => sf.numar === ap.numar && sf.fondName === f.name);
                        return (
                          <td key={f.id ?? f.name} style={{ textAlign: "right" }}>
                            <input type="number" className="input input--sm" value={soldContribFonduri[gi]?.sold ?? ""}
                              onChange={e => gi >= 0 && setSoldContribFonduri(prev => prev.map((s, j) => j === gi ? { ...s, sold: e.target.value } : s))}
                              style={{ width: "110px", textAlign: "right" }} step="0.01" min={0} placeholder="" />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="wizard__footer">
            <button className="btn btn--secondary" onClick={() => { silentSaveStep(7).then(() => setStep(6)); }}>← Înapoi</button>
            <button className="btn btn--primary" onClick={saveSolduriContribFonduri} disabled={saving}>{saving ? "Se salvează..." : "Continuă →"}</button>
          </div>
        </div>
      )}

      {/* ── Step 8: Sold casă / bancă + prima listă de plată ───────────── */}
      {step === 8 && (
        <div className="wizard__body">
          <h2 className="wizard__step-title">Sold casă / bancă inițial</h2>
          <p className="wizard__step-desc">Introdu soldurile inițiale ale casieriei și ale conturilor bancare la data preluării.</p>

          {/* Sold casă */}
          <div className="dash-panel" style={{ padding: "1.25rem 1.5rem" }}>
            <div style={{ fontWeight: 700, color: "#a78bfa", marginBottom: "1rem", fontSize: "0.9rem" }}>Casă</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className="form-field">
                <label className="form-field__label">Sold casă (lei)</label>
                <input type="number" className="input" step="0.01" min="0" placeholder="0.00"
                  value={soldCasa} onChange={e => setSoldCasa(e.target.value)} />
              </div>
              <div className="form-field">
                <label className="form-field__label">La data de</label>
                <input type="date" className="input" value={dataSoldCasa} onChange={e => setDateSoldCasa(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Sold bancă */}
          <div className="dash-panel" style={{ padding: "1.25rem 1.5rem" }}>
            <div style={{ fontWeight: 700, color: "#a78bfa", marginBottom: "1rem", fontSize: "0.9rem" }}>Conturi bancare</div>
            {banci.map((b, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "0.75rem", marginBottom: "0.75rem", alignItems: "flex-end" }}>
                <div className="form-field" style={{ marginBottom: 0 }}>
                  {i === 0 && <label className="form-field__label">Bancă</label>}
                  <input type="text" className="input" placeholder="ex: BCR"
                    value={b.name} onChange={e => setBanci(prev => prev.map((r, j) => j === i ? { ...r, name: e.target.value } : r))} />
                </div>
                <div className="form-field" style={{ marginBottom: 0 }}>
                  {i === 0 && <label className="form-field__label">Sold (lei)</label>}
                  <input type="number" className="input" step="0.01" min="0" placeholder="0.00"
                    value={b.sold} onChange={e => setBanci(prev => prev.map((r, j) => j === i ? { ...r, sold: e.target.value } : r))} />
                </div>
                <div className="form-field" style={{ marginBottom: 0 }}>
                  {i === 0 && <label className="form-field__label">La data de</label>}
                  <input type="date" className="input"
                    value={b.data} onChange={e => setBanci(prev => prev.map((r, j) => j === i ? { ...r, data: e.target.value } : r))} />
                </div>
                <button type="button" className="fond-row__del" style={{ marginBottom: "2px" }}
                  onClick={() => setBanci(prev => prev.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
            <button type="button" className="btn btn--secondary" style={{ marginTop: "0.25rem" }}
              onClick={() => setBanci(prev => [...prev, { name: "", sold: "", data: new Date().toISOString().slice(0, 10) }])}>
              + Adaugă cont bancar
            </button>
          </div>

          {/* Prima listă de plată */}
          <div className="dash-panel" style={{ padding: "1.25rem 1.5rem" }}>
            <div style={{ fontWeight: 700, color: "#a78bfa", marginBottom: "1rem", fontSize: "0.9rem" }}>Prima listă de plată</div>
            <p className="wizard__step-desc" style={{ marginTop: "-0.5rem", marginBottom: "1rem" }}>
              Selectează luna și anul pentru care se va genera prima listă de întreținere.
            </p>
            <div style={{ display: "flex", gap: "1rem", alignItems: "flex-end", flexWrap: "wrap" }}>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-field__label">Luna</label>
                <select className="input" value={primaListaLuna} onChange={e => setPrimaListaLuna(e.target.value)} style={{ minWidth: "160px" }}>
                  {LUNI_NAMES.map((l, i) => (
                    <option key={i + 1} value={i + 1}>{l}</option>
                  ))}
                </select>
              </div>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-field__label">Anul</label>
                <input type="number" className="input" style={{ width: "100px" }}
                  value={primaListaAn} onChange={e => setPrimaListaAn(e.target.value)} min={2000} max={2100} />
              </div>
            </div>
          </div>

          <div className="wizard__footer">
            <button className="btn btn--secondary" onClick={() => { silentSaveStep(8).then(() => setStep(7)); }}>← Înapoi</button>
            <button className="btn btn--primary" onClick={saveSoldInitial} disabled={saving}>{saving ? "Se salvează..." : "Continuă →"}</button>
          </div>
        </div>
      )}

      {/* ── Step 9: Contoare ─────────────────────────────────────────────── */}
      {step === 9 && (
        <div className="wizard__body">
          <h2 className="wizard__step-title">Configurare contoare</h2>
          <p className="wizard__step-desc">Selectează tipurile de contoare existente în asociație și locațiile lor.</p>

          <div className="contur-tabs">
            {conturTabsVisible.map(t => (
              <button key={t} type="button"
                className={`contur-tab${conturTab===t?" contur-tab--active":""}`}
                onClick={() => setConturTab(t)}>
                {conturTabLabel[t]}
              </button>
            ))}
          </div>

          {conturTab === "tipuri" && (
            <div className="contur-tab-body">
              <p className="wizard__step-desc" style={{ marginBottom: "1rem" }}>Bifează tipurile de contoare prezente în asociație:</p>
              <div className="fond-list">
                {([
                  { key: "apa",      label: "Apă (rece / caldă)" },
                  { key: "electric", label: "Electric" },
                  { key: "gaz",      label: "Gaz" },
                ] as const).map(({ key, label }) => (
                  <div key={key} className="fond-row">
                    <label className="fond-row__label">
                      <input type="checkbox" checked={conturCfg[key].enabled}
                        onChange={e => {
                          setConturCfg(prev => ({ ...prev, [key]: { ...prev[key], enabled: e.target.checked } }));
                          if (e.target.checked) setConturTab(key as any);
                        }}
                        className="fond-row__check" />
                      <span className="fond-row__name">{label}</span>
                    </label>
                  </div>
                ))}
              </div>
              {(conturCfg.apa.enabled || conturCfg.electric.enabled || conturCfg.gaz.enabled) && (
                <p style={{ fontSize: "0.8125rem", color: "#a78bfa", marginTop: "1rem" }}>
                  ← Configurează detaliile în tab-urile din stânga
                </p>
              )}
            </div>
          )}

          {conturTab === "apa" && (
            <div className="contur-tab-body">
              <LocatiiSection title="Apă rece" locatii={APA_LOCATII} labels={APA_LABELS}
                selected={conturCfg.apa.rece.locatii} custom={conturCfg.apa.rece.custom}
                onToggle={loc => { setConturCfg(prev => ({ ...prev, apa: { ...prev.apa, rece: { ...prev.apa.rece, enabled: true } } })); toggleApaLoc("rece", loc); }}
                onAddCustom={val => { setConturCfg(prev => ({ ...prev, apa: { ...prev.apa, rece: { ...prev.apa.rece, enabled: true } } })); addApaCustom("rece", val); }}
                onRemoveCustom={idx => removeApaCustom("rece", idx)}
              />
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", margin: "1.25rem 0" }} />
              <LocatiiSection title="Apă caldă" locatii={APA_LOCATII} labels={APA_LABELS}
                selected={conturCfg.apa.calda.locatii} custom={conturCfg.apa.calda.custom}
                onToggle={loc => { setConturCfg(prev => ({ ...prev, apa: { ...prev.apa, calda: { ...prev.apa.calda, enabled: true } } })); toggleApaLoc("calda", loc); }}
                onAddCustom={val => { setConturCfg(prev => ({ ...prev, apa: { ...prev.apa, calda: { ...prev.apa.calda, enabled: true } } })); addApaCustom("calda", val); }}
                onRemoveCustom={idx => removeApaCustom("calda", idx)}
              />
            </div>
          )}

          {conturTab === "electric" && (
            <div className="contur-tab-body">
              <LocatiiSection title="Electric — locații" locatii={SIMPLE_LOCATII} labels={SIMPLE_LABELS}
                selected={conturCfg.electric.locatii} custom={conturCfg.electric.custom}
                onToggle={loc => toggleSimpleLoc("electric", loc)}
                onAddCustom={val => addSimpleCustom("electric", val)}
                onRemoveCustom={idx => removeSimpleCustom("electric", idx)}
              />
            </div>
          )}

          {conturTab === "gaz" && (
            <div className="contur-tab-body">
              <LocatiiSection title="Gaz — locații" locatii={SIMPLE_LOCATII} labels={SIMPLE_LABELS}
                selected={conturCfg.gaz.locatii} custom={conturCfg.gaz.custom}
                onToggle={loc => toggleSimpleLoc("gaz", loc)}
                onAddCustom={val => addSimpleCustom("gaz", val)}
                onRemoveCustom={idx => removeSimpleCustom("gaz", idx)}
              />
            </div>
          )}

          <div className="wizard__footer">
            <button className="btn btn--secondary" onClick={() => setStep(8)}>← Înapoi</button>
            <button className="btn btn--primary" onClick={saveContoare} disabled={saving}>{saving ? "Se salvează..." : "Continuă →"}</button>

          </div>
        </div>
      )}

      {/* ── Step 10: Indecși contoare ────────────────────────────────────── */}
      {step === 10 && (
        <div className="wizard__body">
          <h2 className="wizard__step-title">Indecși contoare</h2>
          <p className="wizard__step-desc">Introdu indexul vechi și indexul nou pentru fiecare contor. Lasă gol dacă nu ai valori.</p>

          {apsWithIndex.length === 0 ? (
            <div className="dash-panel__empty">Niciun contor configurat — apasă Continuă.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {apsWithIndex.map(({ ap, prop, rows }) => (
                <div key={ap.numar} className="dash-panel" style={{ padding: "1rem 1.25rem" }}>
                  <div style={{ fontWeight: 700, color: "#a78bfa", marginBottom: "0.75rem", fontSize: "0.9rem" }}>
                    Ap. {ap.numar}{prop?.numeComplet ? ` — ${prop.numeComplet}` : ""}
                  </div>
                  <table className="data-table" style={{ fontSize: "0.8125rem" }}>
                    <thead>
                      <tr>
                        <th>Tip contor</th>
                        <th>Locație</th>
                        <th style={{ width: "130px" }}>Serie contor</th>
                        <th style={{ textAlign: "right", width: "120px" }}>Index vechi</th>
                        <th style={{ textAlign: "right", width: "120px" }}>Index nou</th>
                        <th style={{ textAlign: "right", width: "90px" }}>Consum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(r => {
                        const gi   = indexRows.findIndex(ir => ir.contorId === r.contorId);
                        const row  = indexRows[gi];
                        const consum    = row ? getConsum(row) : "—";
                        const isNeg     = consum.startsWith("⚠");
                        const isNeutral = consum === "—";
                        return (
                          <tr key={r.contorId}>
                            <td>{TIP_LABEL[r.tip] ?? r.tip}</td>
                            <td style={{ color: "#94a3b8" }}>{r.denumire || r.locatie}</td>
                            <td>
                              <input type="text" className="input input--sm" value={row?.numarSerie ?? ""}
                                onChange={e => gi >= 0 && updateIndex(gi, "numarSerie", e.target.value)}
                                style={{ width: "120px" }} placeholder="ex: 12345678" />
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <input type="number" className="input input--sm" value={row?.indexVechi ?? ""}
                                onChange={e => gi >= 0 && updateIndex(gi, "indexVechi", e.target.value)}
                                style={{ width: "108px", textAlign: "right" }} step="0.001" placeholder="" />
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <input type="number" className="input input--sm" value={row?.indexNou ?? ""}
                                onChange={e => gi >= 0 && updateIndex(gi, "indexNou", e.target.value)}
                                style={{ width: "108px", textAlign: "right" }} step="0.001" placeholder="" />
                            </td>
                            <td style={{ textAlign: "right", fontWeight: 600, color: isNeg ? "#f87171" : isNeutral ? "#475569" : "#4ade80" }}>
                              {consum}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}

          <div className="wizard__footer">
            <button className="btn btn--secondary" onClick={() => setStep(9)}>← Înapoi</button>
            <button className="btn btn--primary" onClick={saveIndecsi} disabled={saving}>{saving ? "Se salvează..." : "Continuă →"}</button>
          </div>
        </div>
      )}

      {/* ── Step 11: Finalizare ──────────────────────────────────────────── */}
      {step === 11 && (
        <div className="wizard__body wizard__body--center">
          <div className="wizard__success-icon">✓</div>
          <h2 className="wizard__step-title" style={{ textAlign: "center" }}>Inițializare completă!</h2>
          <p className="wizard__step-desc" style={{ textAlign: "center" }}>
            Asociația <strong>{displayName}</strong> a fost configurată cu succes.
          </p>
          <div className="wizard__summary">
            <div className="wizard__sum-item">
              <span className="wizard__sum-val">{apartamente.filter(a => a.numar).length}</span>
              <span className="wizard__sum-label">Apartamente</span>
            </div>
            <div className="wizard__sum-item">
              <span className="wizard__sum-val">{nrProprietari}</span>
              <span className="wizard__sum-label">Proprietari</span>
            </div>
            <div className="wizard__sum-item">
              <span className="wizard__sum-val">{fondActive.length}</span>
              <span className="wizard__sum-label">Fonduri</span>
            </div>
            <div className="wizard__sum-item">
              <span className="wizard__sum-val">{indexRows.length}</span>
              <span className="wizard__sum-label">Contoare</span>
            </div>
            {(totalRestante > 0 || totalCurente > 0) && (
              <div className="wizard__sum-item wizard__sum-item--warn">
                <span className="wizard__sum-val">{(totalRestante + totalCurente).toFixed(2)}</span>
                <span className="wizard__sum-label">Lei restanțe</span>
              </div>
            )}
            {(soldCasa || banci.some(b => b.sold)) && (
              <div className="wizard__sum-item">
                <span className="wizard__sum-val">
                  {(parseFloat(soldCasa || "0") + banci.reduce((s, b) => s + (parseFloat(b.sold || "0")), 0)).toFixed(2)}
                </span>
                <span className="wizard__sum-label">Lei în conturi</span>
              </div>
            )}
            {primaListaLuna && primaListaAn && (
              <div className="wizard__sum-item">
                <span className="wizard__sum-val">{LUNI_NAMES[parseInt(primaListaLuna) - 1]} {primaListaAn}</span>
                <span className="wizard__sum-label">Prima listă</span>
              </div>
            )}
          </div>
          <div className="wizard__footer wizard__footer--center">
            <button className="btn btn--secondary" onClick={() => setStep(10)}>← Înapoi</button>
            <button className="btn btn--primary btn--lg" onClick={finalizeaza} disabled={saving}>
              {saving ? "Se finalizează..." : "Finalizează și mergi la asociație →"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
