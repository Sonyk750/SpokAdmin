"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAsociatie } from "@/lib/AsociatieContext";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Furnizor { id: string; nume: string; }

interface FacturaRow {
  id:             string;
  asociatieId:    string;
  asociatie:      { id: string; name: string };
  furnizorId:     string | null;
  furnizor:       { id: string; nume: string } | null;
  serie:          string | null;
  numar:          string | null;
  valoare:        number;
  tva:            number;
  dataEmiterii:   string | null;
  dataScadenta:   string | null;
  luna:           number | null;
  an:             number | null;
  status:         string;
  categorie:      string | null;
  distribuireJson:string | null;
  notes:          string | null;
  plati:          { suma: number }[];
  acoperit?:      number;
  rest?:          number;
  dinFond?:       boolean;
  fondPaid?:      number;
  fonduri?:       string[];
}

interface PlataRow { id: string; suma: number; data: string; metoda: string; fondName: string | null; notes: string | null; }
interface AvansMiscareRow { id: string; suma: number; tip: string; data: string; notes: string | null; plataId: string | null; }
interface PlataData {
  valoare: number; acoperit: number; rest: number; status: string; avansSold: number;
  plati: PlataRow[]; avansMiscari: AvansMiscareRow[];
}

interface ApRow {
  id:          string;
  numar:       string;
  scara:       string | null;
  nrPersone:   number;
  cotaParte:   number | null;
  suprafata:   number | null;
  proprietar:  string;
  consumByTip: Record<string, number>;
}

interface DistRow {
  apartamentId: string;
  numar:        string;
  proprietar:   string;
  suma:         number;
  coloane?:     Record<string, number>;
}

interface GrupDist {
  id:            string;
  name:          string;
  apartamentIds: string[];
}

interface FiltruDist {
  type:  "toate" | "scara" | "apartament" | "grup";
  value: string;
}

type CriteriuExt = "egal" | "persoane" | "cota_parte" | "suprafata" | "manual" | "consum";

interface Transa {
  id:         string;
  label:      string;
  valoare:    string;
  criteriu:   CriteriuExt;
  consumTip:  string;
  manualRows: Record<string, number>;
  filtru:     FiltruDist;
}

type ModalMode = "none" | "adauga" | "editeaza" | "distribuie" | "plata";

// ─── Constants ────────────────────────────────────────────────────────────────

const LUNI = [
  "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
  "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie",
];

const CRITERII_EXT: { value: CriteriuExt; label: string; desc: string }[] = [
  { value: "egal",       label: "Egal",           desc: "Sumă egală / apartament" },
  { value: "persoane",   label: "Nr. persoane",   desc: "Proporțional cu nr. persoane" },
  { value: "cota_parte", label: "Cotă parte",     desc: "Proporțional cu CPI" },
  { value: "suprafata",  label: "Suprafață",      desc: "Proporțional cu m²" },
  { value: "consum",     label: "Consum contoare",desc: "Proporțional cu consumul înregistrat" },
  { value: "manual",     label: "Manual",         desc: "Introduci suma pentru fiecare" },
];

const CONSUM_TIPURI: { value: string; label: string }[] = [
  { value: "apa_rece",  label: "Apă rece" },
  { value: "apa_calda", label: "Apă caldă" },
  { value: "electric",  label: "Electric" },
  { value: "gaz",       label: "Gaz" },
];

const STATUS_LABEL: Record<string, string> = { neplatita: "Neachitată", partial: "Parțial", platita: "Achitată" };
const STATUS_PILL:  Record<string, string> = { neplatita: "pill--red",  partial: "pill--yellow", platita: "pill--green" };

const METODE: { value: string; label: string }[] = [
  { value: "banca",  label: "Bancă" },
  { value: "casa",   label: "Casă" },
  { value: "online", label: "Online" },
];
const metodaLabel = (m: string) => METODE.find(x => x.value === m)?.label ?? m;

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt2(v: number) { return v.toFixed(2); }

function lunaPeriod(luna: number | null, an: number | null): string {
  if (!luna || !an) return "—";
  return `${LUNI[luna - 1]} ${an}`;
}

function uid() { return Math.random().toString(36).slice(2); }

function newTransa(valoare: number, consumTip = "apa_rece"): Transa {
  return {
    id: uid(), label: "", valoare: valoare > 0 ? String(valoare) : "",
    criteriu: "egal", consumTip, manualRows: {},
    filtru: { type: "toate", value: "" },
  };
}

function getFilteredAps(filtru: FiltruDist, allAps: ApRow[], grupuri: GrupDist[]): ApRow[] {
  if (filtru.type === "toate")       return allAps;
  if (filtru.type === "scara")       return allAps.filter(a => a.scara === filtru.value);
  if (filtru.type === "apartament")  return allAps.filter(a => a.id === filtru.value);
  if (filtru.type === "grup") {
    const g = grupuri.find(g => g.id === filtru.value);
    return g ? allAps.filter(a => g.apartamentIds.includes(a.id)) : allAps;
  }
  return allAps;
}

function calcTransaRows(t: Transa, aps: ApRow[]): { apartamentId: string; suma: number }[] {
  const val = parseFloat(t.valoare) || 0;
  if (aps.length === 0) return [];

  let sume: number[];

  if (t.criteriu === "egal") {
    sume = aps.map(() => val / aps.length);
  } else if (t.criteriu === "persoane") {
    const tot = aps.reduce((s, a) => s + a.nrPersone, 0);
    sume = aps.map(a => tot > 0 ? val * a.nrPersone / tot : 0);
  } else if (t.criteriu === "cota_parte") {
    const tot = aps.reduce((s, a) => s + (a.cotaParte ?? 0), 0);
    sume = aps.map(a => tot > 0 ? val * (a.cotaParte ?? 0) / tot : 0);
  } else if (t.criteriu === "suprafata") {
    const tot = aps.reduce((s, a) => s + (a.suprafata ?? 0), 0);
    sume = aps.map(a => tot > 0 ? val * (a.suprafata ?? 0) / tot : 0);
  } else if (t.criteriu === "consum") {
    const cons = aps.map(a => a.consumByTip[t.consumTip] ?? 0);
    const tot  = cons.reduce((s, v) => s + v, 0);
    sume = cons.map(c => tot > 0 ? val * c / tot : 0);
  } else {
    return aps.map(a => ({ apartamentId: a.id, suma: t.manualRows[a.id] ?? 0 }));
  }

  const rounded = sume.map(s => Math.round(s * 100) / 100);
  const diff = Math.round((val - rounded.reduce((s, v) => s + v, 0)) * 100) / 100;
  if (rounded.length > 0) rounded[rounded.length - 1] = Math.round((rounded[rounded.length - 1] + diff) * 100) / 100;
  return aps.map((a, i) => ({ apartamentId: a.id, suma: rounded[i] }));
}

function filtruLabel(filtru: FiltruDist, grupuri: GrupDist[]): string {
  if (filtru.type === "toate")      return "Toate ap.";
  if (filtru.type === "scara")      return `Scara ${filtru.value}`;
  if (filtru.type === "apartament") return `Ap. individual`;
  if (filtru.type === "grup") {
    const g = grupuri.find(g => g.id === filtru.value);
    return g ? `Grup: ${g.name}` : "Grup";
  }
  return "";
}

// ─── Empty form ───────────────────────────────────────────────────────────────

function emptyForm(defaultLuna: number, defaultAn: number) {
  return {
    furnizorNume: "", serie: "", numar: "", valoare: "",
    dataEmiterii: "", dataScadenta: "",
    luna: String(defaultLuna), an: String(defaultAn), notes: "",
  };
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props { furnizori: Furnizor[]; defaultLuna: number; defaultAn: number; }

// ─── Component ────────────────────────────────────────────────────────────────

export default function FacturiClient({ furnizori: initialFurnizori, defaultLuna, defaultAn }: Props) {

  const { activeId: asociatieId } = useAsociatie();

  // ── Filters ──────────────────────────────────────────────────────────────
  const [fStatus, setFStatus] = useState("");
  const [fLuna,   setFLuna]   = useState("");
  const [fAn,     setFAn]     = useState("");

  // ── Data ─────────────────────────────────────────────────────────────────
  const [facturi,   setFacturi]   = useState<FacturaRow[]>([]);
  const [furnizori, setFurnizori] = useState<Furnizor[]>(initialFurnizori);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  // ── Modal state ───────────────────────────────────────────────────────────
  const [modal,    setModal]    = useState<ModalMode>("none");
  const [selected, setSelected] = useState<FacturaRow | null>(null);
  const [form,     setForm]     = useState(emptyForm(defaultLuna, defaultAn));
  const [saving,   setSaving]   = useState(false);
  const [formErr,  setFormErr]  = useState<string | null>(null);

  // ── PDF import ────────────────────────────────────────────────────────────
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfMsg,     setPdfMsg]     = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Distribuire state ─────────────────────────────────────────────────────
  const [distAps,     setDistAps]     = useState<ApRow[]>([]);
  const [distLoading, setDistLoading] = useState(false);
  const [transse,     setTransse]     = useState<Transa[]>([]);
  const [distSaving,  setDistSaving]  = useState(false);
  const [distErr,     setDistErr]     = useState<string | null>(null);

  // ── Grupuri state ─────────────────────────────────────────────────────────
  const [grupuri,     setGrupuri]     = useState<GrupDist[]>([]);
  const [grupLoading, setGrupLoading] = useState(false);
  const [grupForm, setGrupForm] = useState<{ transaId: string; name: string; selected: string[] } | null>(null);
  const [grupNameErr, setGrupNameErr] = useState(false);

  // ── Plată state ─────────────────────────────────────────────────────────────
  const [plataData,   setPlataData]   = useState<PlataData | null>(null);
  const [plataForm,   setPlataForm]   = useState({ suma: "", metoda: "banca", fondId: "", data: todayISO(), notes: "" });
  const [fonduriList, setFonduriList] = useState<{ id: string; name: string; sold: number }[]>([]);
  const [plataLoading,setPlataLoading]= useState(false);
  const [plataSaving, setPlataSaving] = useState(false);
  const [plataErr,    setPlataErr]    = useState<string | null>(null);

  // ── Avans disponibil la furnizorul din formularul de adăugare ───────────────
  const [avansFurnizor, setAvansFurnizor] = useState(0);

  // ── Derived ───────────────────────────────────────────────────────────────

  const availableConsumuri = CONSUM_TIPURI.filter(ct =>
    distAps.some(a => (a.consumByTip[ct.value] ?? 0) > 0)
  );

  const scari = [...new Set(distAps.map(a => a.scara).filter(Boolean))].sort() as string[];

  const transaRows = transse.map(t => {
    const filteredAps = getFilteredAps(t.filtru, distAps, grupuri);
    return { t, filteredAps, rows: calcTransaRows(t, filteredAps) };
  });

  const aggregatedRows: DistRow[] = distAps.map(ap => {
    const coloane: Record<string, number> = {};
    let suma = 0;
    for (const { t, rows } of transaRows) {
      const label = t.label || `Distribuire ${transse.indexOf(t) + 1}`;
      const r = rows.find(r => r.apartamentId === ap.id);
      const s = r?.suma ?? 0;
      coloane[label] = s;
      suma += s;
    }
    return { apartamentId: ap.id, numar: ap.numar, proprietar: ap.proprietar, suma: Math.round(suma * 100) / 100, coloane };
  });

  const totalTransse = transse.reduce((s, t) => s + (parseFloat(t.valoare) || 0), 0);
  const aggTotal     = aggregatedRows.reduce((s, r) => s + r.suma, 0);
  const transseDiff  = selected ? Math.abs(totalTransse - selected.valoare) : 0;

  // ── Fetch facturi ─────────────────────────────────────────────────────────

  const fetchFacturi = useCallback(async () => {
    if (!asociatieId) { setFacturi([]); return; }
    setLoading(true); setError(null);
    const params = new URLSearchParams({ asociatieId });
    if (fStatus) params.set("status", fStatus);
    if (fLuna)   params.set("luna",   fLuna);
    if (fAn)     params.set("an",     fAn);
    try {
      const res  = await fetch(`/api/facturi?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Eroare");
      setFacturi(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [asociatieId, fStatus, fLuna, fAn]);

  useEffect(() => { fetchFacturi(); }, [fetchFacturi]);

  // ── Avans disponibil la furnizorul selectat (în formularul de adăugare) ─────
  useEffect(() => {
    if (modal !== "adauga" || !asociatieId) { setAvansFurnizor(0); return; }
    const furn = furnizori.find(f => f.nume.trim().toLowerCase() === form.furnizorNume.trim().toLowerCase());
    if (!furn) { setAvansFurnizor(0); return; }
    let cancelled = false;
    fetch(`/api/avans-furnizor?asociatieId=${asociatieId}&furnizorId=${furn.id}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setAvansFurnizor(Number(d?.sold) || 0); })
      .catch(() => { if (!cancelled) setAvansFurnizor(0); });
    return () => { cancelled = true; };
  }, [modal, form.furnizorNume, asociatieId, furnizori]);

  // ── Open modals ───────────────────────────────────────────────────────────

  function openAdauga() {
    setSelected(null); setForm(emptyForm(defaultLuna, defaultAn));
    setFormErr(null); setPdfMsg(null); setModal("adauga");
  }

  function openEditeaza(f: FacturaRow) {
    setSelected(f);
    setForm({
      furnizorNume: f.furnizor?.nume ?? "", serie: f.serie ?? "", numar: f.numar ?? "",
      valoare: String(f.valoare),
      dataEmiterii: f.dataEmiterii ? f.dataEmiterii.slice(0, 10) : "",
      dataScadenta: f.dataScadenta ? f.dataScadenta.slice(0, 10) : "",
      luna: f.luna ? String(f.luna) : String(defaultLuna),
      an:   f.an   ? String(f.an)   : String(defaultAn),
      notes: f.notes ?? "",
    });
    setFormErr(null); setPdfMsg(null); setModal("editeaza");
  }

  async function openDistribuie(f: FacturaRow) {
    setSelected(f); setTransse([]); setDistErr(null); setGrupForm(null);
    setModal("distribuie"); setDistLoading(true);
    try {
      const params = new URLSearchParams();
      if (f.luna) params.set("luna", String(f.luna));
      if (f.an)   params.set("an",   String(f.an));

      const [apRes, grpRes] = await Promise.all([
        fetch(`/api/asociatii/${f.asociatieId}/apartamente?${params}`),
        fetch(`/api/asociatii/${f.asociatieId}/grupuri`),
      ]);
      const apJson  = await apRes.json();
      const grpJson = await grpRes.json();
      if (!apRes.ok) throw new Error(apJson.error ?? "Eroare");

      const aps: ApRow[]    = apJson.apartamente;
      const grps: GrupDist[] = Array.isArray(grpJson) ? grpJson : [];
      setDistAps(aps);
      setGrupuri(grps);

      const firstConsum = CONSUM_TIPURI.find(ct => aps.some(a => (a.consumByTip[ct.value] ?? 0) > 0))?.value ?? "apa_rece";

      if (f.distribuireJson) {
        try {
          const raw = JSON.parse(f.distribuireJson);
          const isOldFormat = Array.isArray(raw);
          const existing: DistRow[] = isOldFormat ? raw : raw.rows;
          const savedCriteriu:   Record<string, string> = isOldFormat ? {} : (raw.criteriuByCol  ?? {});
          const savedConsumTips: Record<string, string> = isOldFormat ? {} : (raw.consumTipByCol ?? {});

          const colNames = [...new Set(existing.flatMap(r => Object.keys(r.coloane ?? {})))];
          if (colNames.length > 0) {
            const rebuilt: Transa[] = colNames.map(label => {
              const manualRows: Record<string, number> = {};
              let total = 0;
              for (const row of existing) {
                const val = row.coloane?.[label] ?? 0;
                manualRows[row.apartamentId] = val;
                total += val;
              }
              const savedCrit     = savedCriteriu[label]   as CriteriuExt | undefined;
              const savedConsTip  = savedConsumTips[label] ?? firstConsum;
              return {
                id: uid(), label,
                valoare: String(Math.round(total * 100) / 100),
                criteriu:  savedCrit ?? "manual",
                consumTip: savedConsTip,
                manualRows,
                filtru: { type: "toate", value: "" },
              };
            });
            setTransse(rebuilt);
          } else {
            const manualRows: Record<string, number> = {};
            for (const row of existing) manualRows[row.apartamentId] = row.suma;
            setTransse([{ id: uid(), label: "Distribuire", valoare: String(Math.round(existing.reduce((s, r) => s + r.suma, 0) * 100) / 100), criteriu: "manual", consumTip: firstConsum, manualRows, filtru: { type: "toate", value: "" } }]);
          }
        } catch {
          setTransse([newTransa(f.valoare, firstConsum)]);
        }
      } else {
        setTransse([newTransa(f.valoare, firstConsum)]);
      }
    } catch (e: any) {
      setDistErr(e.message);
    } finally {
      setDistLoading(false);
    }
  }

  // ── Plată facturi ───────────────────────────────────────────────────────────

  async function loadPlataData(facturaId: string) {
    setPlataLoading(true);
    try {
      const res  = await fetch(`/api/facturi/${facturaId}/plati`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Eroare");
      setPlataData(json);
      return json as PlataData;
    } catch (e: any) {
      setPlataErr(e.message);
      return null;
    } finally {
      setPlataLoading(false);
    }
  }

  async function openPlata(f: FacturaRow) {
    setSelected(f); setModal("plata"); setPlataErr(null); setPlataData(null);
    fetch(`/api/asociatii/${f.asociatieId}/fonduri`)
      .then(r => r.json())
      .then(d => setFonduriList(Array.isArray(d) ? d : []))
      .catch(() => setFonduriList([]));
    const data = await loadPlataData(f.id);
    const rest = data?.rest ?? 0;
    setPlataForm({ suma: rest > 0 ? String(rest) : "", metoda: "banca", fondId: "", data: todayISO(), notes: "" });
  }

  async function submitPlata() {
    if (!selected) return;
    const suma = parseFloat(plataForm.suma);
    if (!plataForm.suma || isNaN(suma) || suma <= 0) return setPlataErr("Suma trebuie să fie un număr pozitiv.");
    const fondSel = fonduriList.find(f => f.id === plataForm.fondId);
    if (fondSel && fondSel.sold <= 0) return setPlataErr(`Fondul "${fondSel.name}" nu are sold disponibil — alege alt fond sau plătește fără fond.`);
    setPlataSaving(true); setPlataErr(null);
    try {
      const res = await fetch(`/api/facturi/${selected.id}/plati`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suma, metoda: plataForm.metoda, fondId: plataForm.fondId || undefined, data: plataForm.data || undefined, notes: plataForm.notes.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Eroare server");
      await loadPlataData(selected.id);
      setPlataForm(prev => ({ ...prev, suma: "", notes: "" }));
      fetchFacturi();
    } catch (e: any) {
      setPlataErr(e.message);
    } finally {
      setPlataSaving(false);
    }
  }

  async function deletePlata(plataId: string) {
    if (!selected) return;
    if (!confirm("Anulezi această plată?")) return;
    setPlataErr(null);
    try {
      const res = await fetch(`/api/facturi/${selected.id}/plati/${plataId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Eroare");
      await loadPlataData(selected.id);
      fetchFacturi();
    } catch (e: any) {
      setPlataErr(e.message);
    }
  }

  function closeModal() {
    setModal("none"); setSelected(null);
    setDistAps([]); setTransse([]); setGrupuri([]);
    setGrupForm(null); setPdfMsg(null);
    setPlataData(null); setPlataErr(null);
  }

  // ── Form update ───────────────────────────────────────────────────────────

  function setF(field: string, val: string) { setForm(prev => ({ ...prev, [field]: val })); }

  // ── PDF import ────────────────────────────────────────────────────────────

  async function handlePdfFile(file: File) {
    setPdfLoading(true); setPdfMsg(null);
    try {
      const fd = new FormData(); fd.append("pdf", file);
      const res  = await fetch("/api/facturi/import-pdf", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Eroare import");
      setForm(prev => ({
        ...prev,
        furnizorNume: data.furnizor     ?? prev.furnizorNume,
        serie:        data.serie        ?? prev.serie,
        numar:        data.numar        ?? prev.numar,
        valoare:      data.valoare != null ? String(data.valoare) : prev.valoare,
        dataEmiterii: data.dataEmiterii ?? prev.dataEmiterii,
      }));
      setPdfMsg("Factură citită cu succes. Verificați datele înainte de salvare.");
    } catch (e: any) {
      setPdfMsg(`Eroare: ${e.message}`);
    } finally {
      setPdfLoading(false);
    }
  }

  // ── Save factură ──────────────────────────────────────────────────────────

  async function saveFactura() {
    const valoare = parseFloat(form.valoare);
    if (!asociatieId) return setFormErr("Selectează o asociație din antet.");
    if (!form.valoare || isNaN(valoare) || valoare <= 0) return setFormErr("Valoarea trebuie să fie un număr pozitiv.");
    setSaving(true); setFormErr(null);
    try {
      const payload = {
        asociatieId, valoare,
        furnizorNume: form.furnizorNume.trim() || undefined,
        serie:        form.serie.trim()  || undefined,
        numar:        form.numar.trim()  || undefined,
        dataEmiterii: form.dataEmiterii  || undefined,
        dataScadenta: form.dataScadenta  || undefined,
        luna:         form.luna ? parseInt(form.luna) : undefined,
        an:           form.an   ? parseInt(form.an)   : undefined,
        notes:        form.notes.trim()  || undefined,
      };
      let res: Response;
      if (modal === "adauga") {
        res = await fetch("/api/facturi", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      } else {
        res = await fetch(`/api/facturi/${selected!.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Eroare server");
      const freshFurn = await fetch("/api/furnizori").then(r => r.json());
      setFurnizori(freshFurn);
      closeModal(); fetchFacturi();
    } catch (e: any) {
      setFormErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  // ── Delete factură ────────────────────────────────────────────────────────

  async function deleteFactura(f: FacturaRow) {
    if (!confirm(`Ștergi factura ${f.furnizor?.nume ?? ""}${f.serie ? " " + f.serie : ""}${f.numar ? "/" + f.numar : ""}?`)) return;
    try {
      const res = await fetch(`/api/facturi/${f.id}`, { method: "DELETE" });
      if (!res.ok) { const j = await res.json(); throw new Error(j.error); }
      fetchFacturi();
    } catch (e: any) { alert(e.message); }
  }

  // ── Tranșe management ─────────────────────────────────────────────────────

  function updateTransa(id: string, field: keyof Transa, value: string) {
    setTransse(prev => prev.map(t => {
      if (t.id !== id) return t;
      const updated = { ...t, [field]: value };
      if (field === "consumTip") {
        const tip = CONSUM_TIPURI.find(ct => ct.value === value);
        if (tip) updated.label = tip.label;
      }
      return updated;
    }));
  }

  function setTransaCriteriu(id: string, criteriu: CriteriuExt) {
    setTransse(prev => prev.map(t => {
      if (t.id !== id) return t;
      const updated: Transa = { ...t, criteriu };
      if (criteriu === "consum") {
        const firstTip = availableConsumuri[0];
        if (firstTip) { updated.label = firstTip.label; updated.consumTip = firstTip.value; }
      }
      return updated;
    }));
  }

  function updateTransaFiltru(id: string, type: FiltruDist["type"], value: string) {
    setTransse(prev => prev.map(t => t.id === id ? { ...t, filtru: { type, value } } : t));
  }

  function updateManualRow(transaId: string, apId: string, val: string) {
    const n = parseFloat(val);
    setTransse(prev => prev.map(t =>
      t.id === transaId ? { ...t, manualRows: { ...t.manualRows, [apId]: isNaN(n) ? 0 : n } } : t
    ));
  }

  function addTransa() {
    const firstConsum = availableConsumuri[0]?.value ?? "apa_rece";
    setTransse(prev => [...prev, {
      id: uid(), label: "", valoare: "0", criteriu: "egal",
      consumTip: firstConsum, manualRows: {}, filtru: { type: "toate", value: "" },
    }]);
  }

  function removeTransa(id: string) { setTransse(prev => prev.filter(t => t.id !== id)); }

  // ── Grupuri ───────────────────────────────────────────────────────────────

  async function saveGrup(transaId: string) {
    if (!grupForm || !selected) return;
    if (!grupForm.name.trim()) { setGrupNameErr(true); return; }
    setGrupNameErr(false);
    setGrupLoading(true);
    try {
      const res = await fetch(`/api/asociatii/${selected.asociatieId}/grupuri`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: grupForm.name.trim(), apartamentIds: grupForm.selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const newGrup: GrupDist = { id: data.id, name: data.name, apartamentIds: data.apartamentIds };
      setGrupuri(prev => [...prev, newGrup]);
      updateTransaFiltru(transaId, "grup", data.id);
      setGrupForm(null);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setGrupLoading(false);
    }
  }

  async function deleteGrup(grupId: string) {
    if (!selected) return;
    if (!confirm("Ștergi acest grup?")) return;
    try {
      await fetch(`/api/asociatii/${selected.asociatieId}/grupuri/${grupId}`, { method: "DELETE" });
      setGrupuri(prev => prev.filter(g => g.id !== grupId));
      // Reset any transse using this group
      setTransse(prev => prev.map(t =>
        t.filtru.type === "grup" && t.filtru.value === grupId
          ? { ...t, filtru: { type: "toate", value: "" } }
          : t
      ));
    } catch (e: any) { alert(e.message); }
  }

  // ── Confirm distribuire ───────────────────────────────────────────────────

  async function confirmDistribuire() {
    if (!selected) return;

    const totalDist = Math.round(aggregatedRows.reduce((s, r) => s + r.suma, 0) * 100) / 100;
    if (totalDist > Math.round((selected.valoare + 0.01) * 100) / 100) {
      setDistErr(
        `Nu se poate distribui ${fmt2(totalDist)} lei — valoarea facturii este ${fmt2(selected.valoare)} lei (depășire: ${fmt2(totalDist - selected.valoare)} lei).`
      );
      return;
    }

    setDistSaving(true); setDistErr(null);
    try {
      const criteriuByCol: Record<string, string> = {};
      const consumTipByCol: Record<string, string> = {};
      transse.forEach((t, i) => {
        const label = t.label || `Distribuire ${i + 1}`;
        criteriuByCol[label] = t.criteriu;
        if (t.criteriu === "consum" && t.consumTip) {
          consumTipByCol[label] = t.consumTip;
        }
      });

      const rows = aggregatedRows.map(r => ({
        apartamentId: r.apartamentId, numar: r.numar, proprietar: r.proprietar,
        suma: r.suma, coloane: r.coloane,
      }));
      const res = await fetch(`/api/facturi/${selected.id}/distribuie`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, criteriuByCol, consumTipByCol }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Eroare");
      closeModal(); fetchFacturi();
    } catch (e: any) {
      setDistErr(e.message);
    } finally {
      setDistSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const pdfIsErr = pdfMsg?.startsWith("Eroare");

  return (
    <div className="page-shell">

      <div className="page-header">
        <div>
          <h1 className="page-title">Facturi</h1>
          <p className="page-sub">Gestionarea facturilor de la furnizori</p>
        </div>
        <button className="btn btn--primary" onClick={openAdauga} disabled={!asociatieId}>
          + Factură nouă
        </button>
      </div>

      {!asociatieId && (
        <div className="wizard__error" style={{ marginBottom: "1.25rem" }}>
          Selectează o asociație din antetul paginii.
        </div>
      )}

      <div className="lp-controls">
        <div className="form-field">
          <label className="form-field__label">Status</label>
          <select className="input" value={fStatus} onChange={e => setFStatus(e.target.value)}>
            <option value="">Toate</option>
            <option value="neplatita">Neachitată</option>
            <option value="partial">Parțial</option>
            <option value="platita">Achitată</option>
          </select>
        </div>
        <div className="form-field">
          <label className="form-field__label">Luna</label>
          <select className="input" style={{ width: "130px" }} value={fLuna} onChange={e => setFLuna(e.target.value)}>
            <option value="">Toate</option>
            {LUNI.map((l, i) => <option key={i + 1} value={i + 1}>{l}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label className="form-field__label">Anul</label>
          <input type="number" className="input" style={{ width: "90px" }} placeholder="Toate"
            value={fAn} onChange={e => setFAn(e.target.value)} min={2000} max={2100} />
        </div>
      </div>

      {error && <div className="wizard__error">{error}</div>}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Furnizor</th>
              <th>Serie / Nr.</th>
              <th style={{ textAlign: "right" }}>Valoare (lei)</th>
              <th style={{ textAlign: "right" }}>Rest (lei)</th>
              <th>Perioadă</th>
              <th>Status</th>
              <th style={{ textAlign: "center" }}>Distribuit</th>
              <th style={{ textAlign: "right" }}>Acțiuni</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} style={{ textAlign: "center", color: "#475569", padding: "2rem" }}>Se încarcă...</td></tr>
            )}
            {!loading && facturi.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: "center", color: "#475569", padding: "2rem" }}>
                Nicio factură{fStatus || fLuna || fAn ? " pentru filtrele selectate" : ""}.
              </td></tr>
            )}
            {facturi.map(f => (
              <tr key={f.id}>
                <td style={{ fontWeight: 600 }}>{f.furnizor?.nume ?? <span style={{ color: "#475569" }}>—</span>}</td>
                <td style={{ color: "#94a3b8", fontFamily: "monospace", fontSize: "0.8rem" }}>
                  {[f.serie, f.numar].filter(Boolean).join("/") || "—"}
                </td>
                <td style={{ textAlign: "right", fontWeight: 700, color: "#a78bfa" }}>{fmt2(f.valoare)}</td>
                <td style={{ textAlign: "right", fontWeight: 700, color: (f.rest ?? f.valoare) > 0.01 ? "#f87171" : "#4ade80" }}>
                  {fmt2(f.rest ?? f.valoare)}
                </td>
                <td>{lunaPeriod(f.luna, f.an)}</td>
                <td><span className={`pill ${STATUS_PILL[f.status] ?? "pill--gray"}`}>{STATUS_LABEL[f.status] ?? f.status}</span></td>
                <td style={{ textAlign: "center" }}>
                  {f.distribuireJson
                    ? <span style={{ color: "#4ade80", fontWeight: 700 }}>✓</span>
                    : <span style={{ color: "#475569" }}>—</span>}
                  {f.dinFond && (
                    <span title={`${fmt2(f.fondPaid ?? 0)} lei din fond${f.fonduri?.length ? " (" + f.fonduri.join(", ") + ")" : ""} — partea aceasta nu se distribuie în lista de întreținere`}
                      style={{ display: "block", color: "#38bdf8", fontWeight: 700, fontSize: "0.62rem", marginTop: 2 }}>
                      −{fmt2(f.fondPaid ?? 0)} fond
                    </span>
                  )}
                </td>
                <td style={{ textAlign: "right" }}>
                  <div style={{ display: "flex", gap: "0.375rem", justifyContent: "flex-end" }}>
                    <button className="btn-action" onClick={() => openPlata(f)} title="Achită / plăți">💳</button>
                    <button className="btn-action" onClick={() => openDistribuie(f)} title="Distribuire pe apartamente">⊞</button>
                    <button className="btn-action" onClick={() => openEditeaza(f)} title="Editează">✎</button>
                    <button className="btn-action btn-action--danger" onClick={() => deleteFactura(f)} title="Șterge">×</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Modal Adaugă / Editează ────────────────────────────────────────── */}
      {(modal === "adauga" || modal === "editeaza") && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal__header">
              <h2 className="modal__title">{modal === "adauga" ? "Factură nouă" : "Editează factură"}</h2>
              <button className="modal__close" onClick={closeModal}>✕</button>
            </div>
            <div className="modal__body">
              <div className="pdf-import">
                <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" style={{ display: "none" }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handlePdfFile(f); e.target.value = ""; }} />
                <button type="button" className="btn btn--secondary pdf-import__btn"
                  disabled={pdfLoading} onClick={() => fileInputRef.current?.click()}>
                  {pdfLoading ? "Se citește..." : "📄 Importă din PDF"}
                </button>
                {pdfMsg && <span className={pdfIsErr ? "pdf-import__msg--err" : "pdf-import__msg--ok"}>{pdfMsg}</span>}
              </div>

              <div className="form-grid form-grid--2">
                <div className="form-field form-field--full">
                  <label className="form-field__label">Furnizor</label>
                  <input type="text" className="input" placeholder="Tastează sau selectează..." list="furnizori-list"
                    value={form.furnizorNume} onChange={e => setF("furnizorNume", e.target.value)} />
                  <datalist id="furnizori-list">{furnizori.map(f => <option key={f.id} value={f.nume} />)}</datalist>
                  {modal === "adauga" && avansFurnizor > 0.01 && (
                    <div style={{ fontSize: "0.78rem", color: "#4ade80", marginTop: "0.375rem" }}>
                      ⓘ Avans disponibil la acest furnizor: <strong>{fmt2(avansFurnizor)} lei</strong> — se aplică automat pe factură la salvare.
                    </div>
                  )}
                </div>
                <div className="form-field">
                  <label className="form-field__label">Serie</label>
                  <input type="text" className="input" placeholder="ex: FACT" value={form.serie} onChange={e => setF("serie", e.target.value)} />
                </div>
                <div className="form-field">
                  <label className="form-field__label">Număr</label>
                  <input type="text" className="input" placeholder="ex: 001" value={form.numar} onChange={e => setF("numar", e.target.value)} />
                </div>
                <div className="form-field form-field--full">
                  <label className="form-field__label">Valoare (lei) *</label>
                  <input type="number" className="input" step="0.01" min="0.01" value={form.valoare} onChange={e => setF("valoare", e.target.value)} />
                </div>
                <div className="form-field">
                  <label className="form-field__label">Data emiterii</label>
                  <input type="date" className="input" value={form.dataEmiterii} onChange={e => setF("dataEmiterii", e.target.value)} />
                </div>
                <div className="form-field">
                  <label className="form-field__label">Scadentă</label>
                  <input type="date" className="input" value={form.dataScadenta} onChange={e => setF("dataScadenta", e.target.value)} />
                </div>
                <div className="form-field">
                  <label className="form-field__label">Luna în care se distribuie</label>
                  <select className="input" value={form.luna} onChange={e => setF("luna", e.target.value)}>
                    <option value="">—</option>
                    {LUNI.map((l, i) => <option key={i + 1} value={i + 1}>{l}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label className="form-field__label">Anul</label>
                  <input type="number" className="input" min={2000} max={2100} value={form.an} onChange={e => setF("an", e.target.value)} />
                </div>
                <div className="form-field form-field--full">
                  <label className="form-field__label">Note</label>
                  <textarea className="input" rows={2} style={{ resize: "vertical" }} value={form.notes} onChange={e => setF("notes", e.target.value)} />
                </div>
              </div>

              {formErr && <div className="wizard__error" style={{ marginTop: "1rem" }}>{formErr}</div>}
              <div className="modal__footer">
                <button className="btn btn--secondary" onClick={closeModal}>Anulează</button>
                <button className="btn btn--primary" onClick={saveFactura} disabled={saving}>
                  {saving ? "Se salvează..." : modal === "adauga" ? "Adaugă factură" : "Salvează"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Plată ────────────────────────────────────────────────────── */}
      {modal === "plata" && selected && (() => {
        const restNow = plataData?.rest ?? 0;
        const sumaN   = parseFloat(plataForm.suma) || 0;
        const surplus = Math.round((sumaN - restNow) * 100) / 100;
        const hasFurnizor = !!selected.furnizor;
        return (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal__header">
              <div>
                <h2 className="modal__title">Plăți factură</h2>
                <p style={{ fontSize: "0.8125rem", color: "#94a3b8", marginTop: "0.25rem" }}>
                  {selected.furnizor?.nume ?? "Furnizor necunoscut"}
                  {selected.serie || selected.numar ? ` · ${[selected.serie, selected.numar].filter(Boolean).join("/")}` : ""}
                  {" · "}<strong style={{ color: "#a78bfa" }}>{fmt2(selected.valoare)} lei</strong>
                </p>
              </div>
              <button className="modal__close" onClick={closeModal}>✕</button>
            </div>
            <div className="modal__body">
              {plataLoading && !plataData && <div style={{ textAlign: "center", color: "#475569", padding: "1.5rem" }}>Se încarcă...</div>}

              {plataData && (<>
                {/* Sumar */}
                <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", padding: "0.75rem 1rem", background: "#0f172a", borderRadius: "0.5rem", marginBottom: "1rem" }}>
                  <div><div style={{ fontSize: "0.6rem", textTransform: "uppercase", color: "#475569", fontWeight: 700 }}>Valoare</div><div style={{ fontWeight: 800, color: "#a78bfa" }}>{fmt2(plataData.valoare)}</div></div>
                  <div><div style={{ fontSize: "0.6rem", textTransform: "uppercase", color: "#475569", fontWeight: 700 }}>Plătit</div><div style={{ fontWeight: 800, color: "#4ade80" }}>{fmt2(plataData.acoperit)}</div></div>
                  <div><div style={{ fontSize: "0.6rem", textTransform: "uppercase", color: "#475569", fontWeight: 700 }}>Rest</div><div style={{ fontWeight: 800, color: plataData.rest > 0.01 ? "#f87171" : "#4ade80" }}>{fmt2(plataData.rest)}</div></div>
                  <div><div style={{ fontSize: "0.6rem", textTransform: "uppercase", color: "#475569", fontWeight: 700 }}>Status</div><div><span className={`pill ${STATUS_PILL[plataData.status] ?? "pill--gray"}`}>{STATUS_LABEL[plataData.status] ?? plataData.status}</span></div></div>
                  {hasFurnizor && (
                    <div><div style={{ fontSize: "0.6rem", textTransform: "uppercase", color: "#475569", fontWeight: 700 }}>Avans furnizor</div><div style={{ fontWeight: 800, color: plataData.avansSold > 0.01 ? "#38bdf8" : "#64748b" }}>{fmt2(plataData.avansSold)}</div></div>
                  )}
                </div>

                {/* Formular plată nouă */}
                <div className="form-grid form-grid--2">
                  <div className="form-field">
                    <label className="form-field__label">Sumă (lei) *</label>
                    <input type="number" className="input" step="0.01" min="0.01" value={plataForm.suma}
                      onChange={e => setPlataForm(p => ({ ...p, suma: e.target.value }))} />
                  </div>
                  <div className="form-field">
                    <label className="form-field__label">Sursa banilor</label>
                    <select className="input" value={plataForm.metoda} onChange={e => setPlataForm(p => ({ ...p, metoda: e.target.value }))}>
                      {METODE.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                  <div className="form-field">
                    <label className="form-field__label">Fond</label>
                    <select className="input" value={plataForm.fondId} onChange={e => setPlataForm(p => ({ ...p, fondId: e.target.value }))}>
                      <option value="">— fără fond —</option>
                      {fonduriList.map(f => {
                        const insuf = f.sold <= 0;
                        return (
                          <option key={f.id} value={f.id} style={insuf ? { color: "#f87171" } : undefined}>
                            {insuf ? "⚠ " : ""}{f.name} ({f.sold.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} lei)
                          </option>
                        );
                      })}
                    </select>
                    {(() => {
                      const sel = fonduriList.find(f => f.id === plataForm.fondId);
                      if (!sel || sel.sold > 0) return null;
                      return (
                        <p style={{ color: "#f87171", fontSize: "0.78rem", marginTop: "0.3rem" }}>
                          Fondul &quot;{sel.name}&quot; nu are sold disponibil ({sel.sold.toLocaleString("ro-RO", { minimumFractionDigits: 2 })} lei) — plata nu este posibilă.
                        </p>
                      );
                    })()}
                  </div>
                  <div className="form-field">
                    <label className="form-field__label">Data</label>
                    <input type="date" className="input" value={plataForm.data} onChange={e => setPlataForm(p => ({ ...p, data: e.target.value }))} />
                  </div>
                  <div className="form-field">
                    <label className="form-field__label">Note</label>
                    <input type="text" className="input" value={plataForm.notes} onChange={e => setPlataForm(p => ({ ...p, notes: e.target.value }))} />
                  </div>
                </div>

                {surplus > 0.01 && hasFurnizor && (
                  <div style={{ fontSize: "0.8rem", color: "#38bdf8", marginTop: "0.5rem" }}>
                    ⓘ Surplus de <strong>{fmt2(surplus)} lei</strong> → se adaugă ca avans la {selected.furnizor?.nume}.
                  </div>
                )}
                {surplus > 0.01 && !hasFurnizor && (
                  <div style={{ fontSize: "0.8rem", color: "#fbbf24", marginTop: "0.5rem" }}>
                    ⚠ Suma depășește restul, dar factura nu are furnizor — atribuie un furnizor (editează factura) pentru a putea înregistra avansul.
                  </div>
                )}

                <div style={{ marginTop: "0.75rem" }}>
                  <button className="btn btn--primary" onClick={submitPlata} disabled={plataSaving}>
                    {plataSaving ? "Se înregistrează..." : "Înregistrează plata"}
                  </button>
                </div>

                {/* Istoric */}
                {(plataData.plati.length > 0 || plataData.avansMiscari.length > 0) && (
                  <div style={{ marginTop: "1.25rem" }}>
                    <div className="form-field__label" style={{ marginBottom: "0.5rem" }}>Istoric</div>
                    <div className="table-wrap">
                      <table className="data-table" style={{ fontSize: "0.8125rem" }}>
                        <thead><tr><th>Data</th><th>Tip</th><th style={{ textAlign: "right" }}>Sumă</th><th /></tr></thead>
                        <tbody>
                          {plataData.plati.map(p => (
                            <tr key={p.id}>
                              <td style={{ color: "#94a3b8", whiteSpace: "nowrap" }}>{new Date(p.data).toLocaleDateString("ro-RO")}</td>
                              <td>Plată · {metodaLabel(p.metoda)}{p.fondName ? ` · ${p.fondName}` : ""}{p.notes ? ` — ${p.notes}` : ""}</td>
                              <td style={{ textAlign: "right", fontWeight: 700, color: "#4ade80" }}>{fmt2(p.suma)}</td>
                              <td style={{ textAlign: "right" }}>
                                <button className="btn-action btn-action--danger" title="Anulează plata" onClick={() => deletePlata(p.id)}>×</button>
                              </td>
                            </tr>
                          ))}
                          {plataData.avansMiscari.map(m => (
                            <tr key={m.id}>
                              <td style={{ color: "#94a3b8", whiteSpace: "nowrap" }}>{new Date(m.data).toLocaleDateString("ro-RO")}</td>
                              <td style={{ color: "#38bdf8" }}>{m.tip === "consum" ? "Aplicat din avans" : "Avans (supraplată)"}{m.notes ? ` — ${m.notes}` : ""}</td>
                              <td style={{ textAlign: "right", fontWeight: 700, color: "#38bdf8" }}>{m.tip === "consum" ? fmt2(Math.abs(m.suma)) : `+${fmt2(m.suma)}`}</td>
                              <td />
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>)}

              {plataErr && <div className="wizard__error" style={{ marginTop: "1rem" }}>{plataErr}</div>}

              <div className="modal__footer">
                <button className="btn btn--secondary" onClick={closeModal}>Închide</button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {/* ── Modal Distribuire ──────────────────────────────────────────────── */}
      {modal === "distribuie" && selected && (
        <div className="modal-overlay">
          <div className="modal modal--wide">
            <div className="modal__header">
              <div>
                <h2 className="modal__title">Distribuire pe apartamente</h2>
                <p style={{ fontSize: "0.8125rem", color: "#94a3b8", marginTop: "0.25rem" }}>
                  {selected.furnizor?.nume ?? "Furnizor necunoscut"}
                  {selected.serie || selected.numar ? ` · ${[selected.serie, selected.numar].filter(Boolean).join("/")}` : ""}
                  {" · "}<strong style={{ color: "#a78bfa" }}>{fmt2(selected.valoare)} lei</strong>
                  {" · "}{lunaPeriod(selected.luna, selected.an)}
                </p>
              </div>
              <button className="modal__close" onClick={closeModal}>✕</button>
            </div>
            <div className="modal__body">

              {selected.dinFond && (
                <div style={{ background: "rgba(56,189,248,0.1)", border: "1px solid #38bdf8", borderRadius: "0.5rem", padding: "0.75rem 1rem", marginBottom: "1rem", fontSize: "0.82rem", color: "#7dd3fc" }}>
                  ⓘ Din această factură, <strong>{fmt2(selected.fondPaid ?? 0)} lei</strong> sunt acoperiți din fond{selected.fonduri?.length ? ` (${selected.fonduri.join(", ")})` : ""}.
                  {" "}În lista de întreținere se distribuie doar restul de <strong>{fmt2(Math.max(0, selected.valoare - (selected.fondPaid ?? 0)))} lei</strong> (proporțional). Poți distribui valoarea totală aici — sistemul scade automat partea din fond.
                </div>
              )}

              {distLoading && <div style={{ textAlign: "center", color: "#475569", padding: "2rem" }}>Se încarcă...</div>}
              {!distLoading && distAps.length === 0 && <div className="dash-panel__empty">Niciun apartament inițializat.</div>}

              {!distLoading && distAps.length > 0 && (<>

                {/* ── Distribuiri ───────────────────────────────────────── */}
                <div className="dist-transse">
                  {transse.map((t, ti) => {
                    const filteredAps = getFilteredAps(t.filtru, distAps, grupuri);
                    const tRows = transaRows.find(tr => tr.t.id === t.id)?.rows ?? [];
                    const manualTotal = t.criteriu === "manual" ? tRows.reduce((s, r) => s + r.suma, 0) : null;
                    const tVal = parseFloat(t.valoare) || 0;
                    const manualDiff = manualTotal !== null ? Math.abs(manualTotal - tVal) : 0;

                    return (
                      <div key={t.id} className="dist-transa">
                        {/* Header row */}
                        <div className="dist-transa__header">
                          <span className="dist-transa__nr">Distribuire {ti + 1}</span>
                          <div className="dist-transa__inputs">
                            <input type="text" className="input input--sm dist-transa__label"
                              placeholder="ex: Apă rece"
                              value={t.label}
                              onChange={e => updateTransa(t.id, "label", e.target.value)}
                            />
                            <div className="dist-transa__val-wrap">
                              <input type="number" className="input input--sm dist-transa__val"
                                step="0.01"
                                placeholder={fmt2(selected.valoare)}
                                value={t.valoare}
                                onChange={e => updateTransa(t.id, "valoare", e.target.value)}
                              />
                              <span className="dist-transa__currency">lei</span>
                            </div>
                          </div>
                          <button className="btn-action btn-action--danger dist-transa__remove"
                            onClick={() => removeTransa(t.id)} title="Șterge distribuire">🗑</button>
                        </div>

                        {/* Criteriu */}
                        <div className="dist-criterii dist-criterii--compact">
                          {CRITERII_EXT.filter(c => c.value !== "consum" || availableConsumuri.length > 0).map(c => (
                            <button key={c.value} type="button" title={c.desc}
                              className={`dist-criteriu dist-criteriu--sm${t.criteriu === c.value ? " dist-criteriu--active" : ""}`}
                              onClick={() => setTransaCriteriu(t.id, c.value)}>
                              {c.label}
                            </button>
                          ))}
                        </div>

                        {/* Consum tip */}
                        {t.criteriu === "consum" && (
                          <div className="dist-consum-tips">
                            {availableConsumuri.map(ct => (
                              <button key={ct.value} type="button"
                                className={`dist-consum-tip${t.consumTip === ct.value ? " dist-consum-tip--active" : ""}`}
                                onClick={() => updateTransa(t.id, "consumTip", ct.value)}>
                                {ct.label}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Filtru apartamente */}
                        <div className="dist-filtru">
                          <label className="dist-filtru__label">Apartamente:</label>
                          <select className="input input--sm dist-filtru__select"
                            value={`${t.filtru.type}:${t.filtru.value}`}
                            onChange={e => {
                              const val = e.target.value;
                              if (val === "nou_grup") {
                                setGrupForm({ transaId: t.id, name: "", selected: [] });
                                return;
                              }
                              const colonIdx = val.indexOf(":");
                              const type  = val.slice(0, colonIdx) as FiltruDist["type"];
                              const value = val.slice(colonIdx + 1);
                              updateTransaFiltru(t.id, type, value);
                            }}>
                            <option value="toate:">Toate apartamentele ({distAps.length})</option>
                            {scari.length > 1 && scari.map(s => (
                              <option key={s} value={`scara:${s}`}>
                                Scara {s} ({distAps.filter(a => a.scara === s).length} ap.)
                              </option>
                            ))}
                            <optgroup label="Un singur apartament">
                              {distAps.map(ap => (
                                <option key={ap.id} value={`apartament:${ap.id}`}>
                                  Ap. {ap.numar}{ap.proprietar ? ` — ${ap.proprietar}` : ""}
                                </option>
                              ))}
                            </optgroup>
                            {grupuri.length > 0 && (
                              <optgroup label="Grupuri salvate">
                                {grupuri.map(g => (
                                  <option key={g.id} value={`grup:${g.id}`}>
                                    {g.name} ({g.apartamentIds.length} ap.)
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            <option value="nou_grup">⊕ Grup nou...</option>
                          </select>
                          {t.filtru.type !== "toate" && (
                            <span className="dist-filtru__badge">
                              {filteredAps.length} ap. selectate
                            </span>
                          )}
                          {t.filtru.type === "grup" && (
                            <button type="button" className="dist-filtru__del"
                              title="Șterge grupul"
                              onClick={() => deleteGrup(t.filtru.value)}>
                              ×
                            </button>
                          )}
                        </div>

                        {/* Grup nou — inline form */}
                        {grupForm?.transaId === t.id && (
                          <div className="dist-grup-form">
                            <div className="dist-grup-form__title">Grup nou de apartamente</div>
                            <input type="text"
                              className={`input input--sm${grupNameErr ? " input--error" : ""}`}
                              placeholder="Numele grupului (ex: Scara A, Etaj 2, Pomi...)"
                              value={grupForm.name}
                              onChange={e => {
                                setGrupNameErr(false);
                                setGrupForm(prev => prev ? { ...prev, name: e.target.value } : null);
                              }}
                            />
                            {grupNameErr && (
                              <div style={{ fontSize: "0.75rem", color: "#f87171", marginTop: "-0.25rem" }}>
                                Introduceți un nume pentru grup.
                              </div>
                            )}
                            <div className="dist-grup-form__aps">
                              {distAps.map(ap => (
                                <label key={ap.id} className="dist-grup-ap">
                                  <input type="checkbox"
                                    checked={grupForm.selected.includes(ap.id)}
                                    onChange={e => {
                                      const ids = e.target.checked
                                        ? [...grupForm.selected, ap.id]
                                        : grupForm.selected.filter(id => id !== ap.id);
                                      setGrupForm(prev => prev ? { ...prev, selected: ids } : null);
                                    }}
                                  />
                                  <span>Ap. {ap.numar}{ap.scara ? ` · Sc. ${ap.scara}` : ""}{ap.proprietar ? ` — ${ap.proprietar}` : ""}</span>
                                </label>
                              ))}
                            </div>
                            <div className="dist-grup-form__actions">
                              <button type="button" className="btn btn--secondary btn--sm"
                                onClick={() => { setGrupForm(null); setGrupNameErr(false); }}>Anulează</button>
                              <button type="button" className="btn btn--primary btn--sm"
                                disabled={grupLoading || grupForm.selected.length === 0}
                                onClick={() => saveGrup(t.id)}>
                                {grupLoading ? "Se salvează..." : `Salvează grup (${grupForm.selected.length} ap.)`}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Manual total warning */}
                        {t.criteriu === "manual" && manualDiff > 0.02 && (
                          <div style={{ fontSize: "0.75rem", color: "#fbbf24", marginTop: "0.375rem" }}>
                            Total introdus: {fmt2(manualTotal!)} lei · diferență față de valoarea tranșei: {fmt2(manualDiff)} lei
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <div className="dist-transse__footer">
                    <button type="button" className="btn btn--secondary btn--sm" onClick={addTransa}>
                      + Adaugă distribuire
                    </button>
                    <div className="dist-total">
                      <span className="dist-total__label">Total distribuiri:</span>
                      <span className={`dist-total__val${transseDiff > 0.02 ? " dist-total__val--err" : " dist-total__val--ok"}`}>
                        {fmt2(totalTransse)} lei
                      </span>
                      <span className="dist-total__sep">/</span>
                      <span className="dist-total__factura">{fmt2(selected.valoare)} lei</span>
                      {transseDiff > 0.02 && (
                        <span className="dist-total__diff">nedistribuit: {fmt2(transseDiff)} lei</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Previzualizare ─────────────────────────────────────── */}
                {transse.length > 0 && (
                  <div style={{ marginTop: "1.25rem" }}>
                    <div className="form-field__label" style={{ marginBottom: "0.5rem" }}>Previzualizare distribuire</div>
                    <div className="table-wrap" style={{ maxHeight: "320px", overflowY: "auto", overflowX: "auto" }}>
                      <table className="data-table" style={{ minWidth: `${300 + transse.length * 120}px` }}>
                        <thead>
                          <tr>
                            <th style={{ width: "52px" }}>Ap.</th>
                            <th>Proprietar</th>
                            {transse.map((t, i) => (
                              <th key={t.id} style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                {t.label || `Distribuire ${i + 1}`}
                                {t.filtru.type !== "toate" && (
                                  <span style={{ display: "block", fontSize: "0.65rem", color: "#64748b", fontWeight: 400 }}>
                                    {filtruLabel(t.filtru, grupuri)}
                                  </span>
                                )}
                              </th>
                            ))}
                            {transse.length > 1 && <th style={{ textAlign: "right", fontWeight: 700 }}>Total</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {aggregatedRows.map(row => (
                            <tr key={row.apartamentId}>
                              <td style={{ color: "#a78bfa", fontWeight: 700 }}>{row.numar}</td>
                              <td style={{ color: "#94a3b8", fontSize: "0.8rem" }}>{row.proprietar || "—"}</td>
                              {transse.map(t => {
                                const label = t.label || `Distribuire ${transse.indexOf(t) + 1}`;
                                const suma  = row.coloane?.[label] ?? 0;
                                const filteredAps = getFilteredAps(t.filtru, distAps, grupuri);
                                const inFilter = filteredAps.some(a => a.id === row.apartamentId);
                                return (
                                  <td key={t.id} style={{ textAlign: "right" }}>
                                    {t.criteriu === "manual" && inFilter ? (
                                      <input type="number" className="input input--sm" step="0.01"
                                        style={{ width: "100px", textAlign: "right" }}
                                        value={t.manualRows[row.apartamentId] === 0 ? "" : (t.manualRows[row.apartamentId] ?? "")}
                                        placeholder="0.00"
                                        onChange={e => updateManualRow(t.id, row.apartamentId, e.target.value)}
                                      />
                                    ) : suma > 0 ? (
                                      <span style={{ color: "#a78bfa", fontWeight: 600 }}>{fmt2(suma)}</span>
                                    ) : (
                                      <span style={{ color: "#334155" }}>—</span>
                                    )}
                                  </td>
                                );
                              })}
                              {transse.length > 1 && (
                                <td style={{ textAlign: "right", fontWeight: 700, color: row.suma > 0 ? "#e2e8f0" : "#334155" }}>
                                  {row.suma > 0 ? fmt2(row.suma) : "—"}
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ borderTop: "2px solid #334155" }}>
                            <td colSpan={2} style={{ color: "#64748b", fontSize: "0.8rem", padding: "0.5rem 0.75rem" }}>Total</td>
                            {transaRows.map(({ t, rows }) => {
                              const col = rows.reduce((s, r) => s + r.suma, 0);
                              return <td key={t.id} style={{ textAlign: "right", fontWeight: 700, color: "#a78bfa", padding: "0.5rem 0.75rem" }}>{fmt2(col)}</td>;
                            })}
                            {transse.length > 1 && (
                              <td style={{ textAlign: "right", fontWeight: 700, color: "#e2e8f0", padding: "0.5rem 0.75rem" }}>{fmt2(aggTotal)}</td>
                            )}
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

              </>)}

              {distErr && <div className="wizard__error" style={{ marginTop: "1rem" }}>{distErr}</div>}

              <div className="modal__footer">
                <button className="btn btn--secondary" onClick={closeModal}>Anulează</button>
                <button className="btn btn--primary"
                  onClick={confirmDistribuire}
                  disabled={distSaving || distAps.length === 0 || transse.length === 0}>
                  {distSaving ? "Se salvează..." : "Confirmă distribuirea"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
