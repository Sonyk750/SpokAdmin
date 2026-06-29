"use client"

import { useState, useCallback, useEffect } from "react"
import { useAsociatie } from "@/lib/AsociatieContext"
import DocumenteAngajatModal from "./DocumenteAngajatModal"
import RoDate from "@/components/RoDate"

// ─── Types ────────────────────────────────────────────────────────────────────

interface PersoanaIntretinere { id: string; nume: string; prenume: string | null; cnp: string | null; relatie: string | null }
interface Coasigurat          { id: string; nume: string; prenume: string | null; cnp: string | null; relatie: string | null }

interface Angajat {
  id: string; organizationId: string; asociatieId: string
  nume: string; prenume: string | null; cnp: string | null
  adresa: string | null; judet: string | null; mentiuni: string | null
  tipContract: string; functie: string | null; detaliiFunctie: string | null
  nivelStudii: string | null; nrContract: string | null
  normaDeLucru: number; dataAngajare: string | null
  dataIntrareVigoare: string | null; dataIncetare: string | null; modIncetare: string | null
  salariuBrut: number; bonuriMasa: number; deducerePersonala: number
  functiaDeBase: boolean; cassCasMinimEconomie: boolean; singurulVenit: boolean
  pensionar: boolean; invaliditate: string; gradHandicap: string
  platesteCASS: boolean; cassMinimEconomie: boolean
  platestePensie: boolean; platesteImpozit: boolean; impozitBazaBrut: boolean
  asocSanatate: boolean; asocSomaj: boolean; asocPensie: boolean
  asocConcedii: boolean; asocFondRisc: boolean; asocCAM: boolean
  contBancar: string | null; banca: string | null
  email: string | null; telefon: string | null; isActive: boolean
  persoaneIntretinere: PersoanaIntretinere[]; coasigurati: Coasigurat[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TIP_CONTRACT = ["CIM", "Contract de mandat", "Convenție civilă"]
const FUNCTII      = ["Administrator", "Îngrijitor", "Contabil", "Casier", "Electrician", "Instalator", "Femeie de serviciu", "Alta"]
const NIVEL_STUDII = ["Școală generală", "Liceu", "Școală profesională", "Colegiu", "Facultate", "Masterat", "Doctorat"]
const MOD_INCETARE = ["Acordul părților", "Demisie", "Concediere", "Pensionare", "Deces", "Altul"]
const INVALIDITATE = [["fara", "Fără"], ["grad1", "Gradul I"], ["grad2", "Gradul II"], ["grad3", "Gradul III"]]
const GRAD_HANDICAP = [["fara", "Fără"], ["usor", "Ușor"], ["mediu", "Mediu"], ["accentuat", "Accentuat"], ["grav", "Grav"]]
const JUDETE = [
  "ALBA","ARAD","ARGEȘ","BACĂU","BIHOR","BISTRIȚA-NĂSĂUD","BOTOȘANI","BRĂILA","BRAȘOV","BUCUREȘTI",
  "BUZĂU","CĂLĂRAȘI","CARAȘ-SEVERIN","CLUJ","CONSTANȚA","COVASNA","DÂMBOVIȚA","DOLJ","GALAȚI","GIURGIU",
  "GORJ","HARGHITA","HUNEDOARA","IALOMIȚA","IAȘI","ILFOV","MARAMUREȘ","MEHEDINȚI","MUREȘ","NEAMȚ",
  "OLT","PRAHOVA","SATU MARE","SĂLAJ","SIBIU","SUCEAVA","TELEORMAN","TIMIȘ","TULCEA","VASLUI","VÂLCEA","VRANCEA",
]

const emptyForm = {
  // General
  nume: "", prenume: "", cnp: "", adresa: "", judet: "BUCUREȘTI", mentiuni: "",
  tipContract: "CIM",
  functiaDeBase: true, cassCasMinimEconomie: true, singurulVenit: false,
  pensionar: false, invaliditate: "fara", gradHandicap: "fara",
  // Contributii
  platesteCASS: true, cassMinimEconomie: false,
  platestePensie: true, platesteImpozit: true, impozitBazaBrut: false,
  asocSanatate: false, asocSomaj: false, asocPensie: false,
  asocConcedii: false, asocFondRisc: false, asocCAM: true,
  // Salariu
  functie: "", detaliiFunctie: "", nivelStudii: "", nrContract: "",
  normaDeLucru: "8", salariuBrut: "", bonuriMasa: "0", deducerePersonala: "0",
  dataAngajare: "", dataIntrareVigoare: "", dataIncetare: "", modIncetare: "",
  contBancar: "", banca: "", email: "", telefon: "",
}

type FormState = typeof emptyForm

// ─── Sub-modal: Persoane ──────────────────────────────────────────────────────

function PersoaneModal({
  titlu, endpoint, angajatId, onClose,
}: { titlu: string; endpoint: string; angajatId: string; onClose: () => void }) {
  const [list,     setList]     = useState<PersoanaIntretinere[]>([])
  const [loading,  setLoading]  = useState(true)
  const [form,     setForm]     = useState({ nume: "", prenume: "", cnp: "", relatie: "" })
  const [saving,   setSaving]   = useState(false)
  const [err,      setErr]      = useState("")

  useEffect(() => {
    fetch(`/api/salarii/${endpoint}?angajatId=${angajatId}`)
      .then(r => r.json()).then(d => { setList(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [angajatId, endpoint])

  async function handleAdd() {
    if (!form.nume.trim()) { setErr("Numele este obligatoriu"); return }
    setSaving(true); setErr("")
    try {
      const r = await fetch(`/api/salarii/${endpoint}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ angajatId, ...form }),
      })
      if (!r.ok) { setErr((await r.json()).error || "Eroare"); return }
      const nou = await r.json()
      setList(l => [...l, nou])
      setForm({ nume: "", prenume: "", cnp: "", relatie: "" })
    } finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/salarii/${endpoint}?id=${id}`, { method: "DELETE" })
    setList(l => l.filter(x => x.id !== id))
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal__header">
          <h2 className="modal__title">{titlu}</h2>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="modal__body">
          {loading ? <p style={{ color: "#9ca3af" }}>Se încarcă...</p> : (
            <>
              {list.length > 0 && (
                <div className="table-wrap" style={{ marginBottom: "1rem" }}>
                  <table className="data-table" style={{ fontSize: "0.8rem" }}>
                    <thead><tr><th>Nume</th><th>CNP</th><th>Relație</th><th></th></tr></thead>
                    <tbody>
                      {list.map(p => (
                        <tr key={p.id}>
                          <td><strong>{p.nume} {p.prenume ?? ""}</strong></td>
                          <td style={{ fontFamily: "monospace", color: "#9ca3af" }}>{p.cnp || "—"}</td>
                          <td>{p.relatie || "—"}</td>
                          <td><button onClick={() => handleDelete(p.id)} className="btn-action btn-action--danger" style={{ fontSize: "0.7rem" }}>Șterge</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", marginBottom: "0.5rem" }}>Adaugă</p>
              <div className="form-grid form-grid--2">
                <div className="form-field">
                  <label className="form-field__label">Nume *</label>
                  <input className="input" value={form.nume} onChange={e => setForm(f => ({ ...f, nume: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label className="form-field__label">Prenume</label>
                  <input className="input" value={form.prenume} onChange={e => setForm(f => ({ ...f, prenume: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label className="form-field__label">CNP</label>
                  <input className="input" value={form.cnp} onChange={e => setForm(f => ({ ...f, cnp: e.target.value }))} maxLength={13} />
                </div>
                <div className="form-field">
                  <label className="form-field__label">Relație</label>
                  <input className="input" value={form.relatie} onChange={e => setForm(f => ({ ...f, relatie: e.target.value }))} placeholder="soț/soție, copil, etc." />
                </div>
              </div>
              {err && <p style={{ color: "#f87171", fontSize: "0.8rem", marginTop: "0.5rem" }}>{err}</p>}
            </>
          )}
        </div>
        <div className="modal__footer">
          <button className="btn btn--secondary" onClick={onClose}>Închide</button>
          <button className="btn btn--primary" onClick={handleAdd} disabled={saving}>
            {saving ? "Se adaugă..." : "+ Adaugă"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Checkbox helper ──────────────────────────────────────────────────────────

function Chk({ label, checked, onChange, disabled, indent }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; indent?: boolean
}) {
  return (
    <label style={{
      display: "flex", alignItems: "center", gap: "0.5rem", cursor: disabled ? "default" : "pointer",
      opacity: disabled ? 0.45 : 1, paddingLeft: indent ? "1.25rem" : 0, marginBottom: "0.35rem",
    }}>
      <input type="checkbox" checked={checked} disabled={disabled}
        onChange={e => onChange(e.target.checked)}
        style={{ width: 15, height: 15, accentColor: "#7c3aed", flexShrink: 0 }} />
      <span style={{ fontSize: "0.85rem", color: "#e2e8f0" }}>{label}</span>
    </label>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AngajatiClient() {
  const { activeId: asociatieId, activeName } = useAsociatie()

  const [angajati,   setAngajati]   = useState<Angajat[]>([])
  const [loading,    setLoading]    = useState(true)
  const [modal,      setModal]      = useState<"adauga" | "editeaza" | null>(null)
  const [activeTab,  setActiveTab]  = useState<"general" | "contributii" | "salariu">("general")
  const [selected,   setSelected]   = useState<Angajat | null>(null)
  const [form,       setForm]       = useState<FormState>({ ...emptyForm })
  const [saving,     setSaving]     = useState(false)
  const [err,        setErr]        = useState("")
  const [showAll,    setShowAll]    = useState(false)
  const [docAngajat, setDocAngajat] = useState<Angajat | null>(null)
  const [subModal,   setSubModal]   = useState<{ type: "persoane" | "coasigurati"; angajatId: string } | null>(null)

  const fetch_ = useCallback(async (asocId: string, all: boolean) => {
    if (!asocId) return
    setLoading(true)
    try {
      const r    = await fetch(`/api/salarii/angajati?asociatieId=${asocId}${all ? "&all=true" : ""}`)
      const data = await r.json()
      setAngajati(Array.isArray(data) ? data : [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { if (asociatieId) fetch_(asociatieId, showAll) }, [asociatieId, showAll, fetch_])

  function setF(k: keyof FormState, v: any) { setForm(f => ({ ...f, [k]: v })) }

  function openAdauga() {
    setForm({ ...emptyForm }); setSelected(null); setErr(""); setActiveTab("general"); setModal("adauga")
  }

  function openEditeaza(a: Angajat) {
    setForm({
      nume: a.nume, prenume: a.prenume ?? "", cnp: a.cnp ?? "",
      adresa: a.adresa ?? "", judet: a.judet ?? "BUCUREȘTI", mentiuni: a.mentiuni ?? "",
      tipContract: a.tipContract,
      functiaDeBase: a.functiaDeBase, cassCasMinimEconomie: a.cassCasMinimEconomie,
      singurulVenit: a.singurulVenit, pensionar: a.pensionar,
      invaliditate: a.invaliditate, gradHandicap: a.gradHandicap,
      platesteCASS: a.platesteCASS, cassMinimEconomie: a.cassMinimEconomie,
      platestePensie: a.platestePensie, platesteImpozit: a.platesteImpozit,
      impozitBazaBrut: a.impozitBazaBrut,
      asocSanatate: a.asocSanatate, asocSomaj: a.asocSomaj, asocPensie: a.asocPensie,
      asocConcedii: a.asocConcedii, asocFondRisc: a.asocFondRisc, asocCAM: a.asocCAM,
      functie: a.functie ?? "", detaliiFunctie: a.detaliiFunctie ?? "",
      nivelStudii: a.nivelStudii ?? "", nrContract: a.nrContract ?? "",
      normaDeLucru: String(a.normaDeLucru), salariuBrut: String(a.salariuBrut),
      bonuriMasa: String(a.bonuriMasa), deducerePersonala: String(a.deducerePersonala),
      dataAngajare: a.dataAngajare ? a.dataAngajare.split("T")[0] : "",
      dataIntrareVigoare: a.dataIntrareVigoare ? a.dataIntrareVigoare.split("T")[0] : "",
      dataIncetare: a.dataIncetare ? a.dataIncetare.split("T")[0] : "",
      modIncetare: a.modIncetare ?? "",
      contBancar: a.contBancar ?? "", banca: a.banca ?? "",
      email: a.email ?? "", telefon: a.telefon ?? "",
    })
    setSelected(a); setErr(""); setActiveTab("general"); setModal("editeaza")
  }

  function closeModal() { setModal(null); setSelected(null); setErr("") }

  // Calculator: costul total = brut + CAM angajator
  const brutCalc  = parseFloat(form.salariuBrut) || 0
  const camCalc   = form.asocCAM ? Math.round(brutCalc * 0.0225 * 100) / 100 : 0
  const costTotal = Math.round((brutCalc + camCalc) * 100) / 100

  async function handleSave() {
    if (!form.nume.trim()) { setErr("Numele este obligatoriu"); setActiveTab("general"); return }
    if (!form.salariuBrut || isNaN(parseFloat(form.salariuBrut))) { setErr("Salariul brut este invalid"); setActiveTab("salariu"); return }

    setSaving(true); setErr("")
    try {
      const body = { ...form, asociatieId }
      const url  = modal === "editeaza" ? `/api/salarii/angajati/${selected!.id}` : "/api/salarii/angajati"
      const meth = modal === "editeaza" ? "PUT" : "POST"
      const r    = await fetch(url, { method: meth, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const data = await r.json()
      if (!r.ok) { setErr(data.error || "Eroare"); return }
      closeModal()
      fetch_(asociatieId, showAll)
    } finally { setSaving(false) }
  }

  async function handleDeactivate(a: Angajat) {
    if (!confirm(`Dezactivezi angajatul ${a.nume} ${a.prenume ?? ""}?`)) return
    await fetch(`/api/salarii/angajati/${a.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    })
    fetch_(asociatieId, showAll)
  }

  async function handleActivate(a: Angajat) {
    await fetch(`/api/salarii/angajati/${a.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    })
    fetch_(asociatieId, showAll)
  }

  const activi   = angajati.filter(a => a.isActive)
  const inactivi = angajati.filter(a => !a.isActive)

  // ─── Tab panels ─────────────────────────────────────────────────────────────

  const tabGeneral = (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Tip contract */}
      <div>
        <p className="form-field__label" style={{ marginBottom: "0.4rem" }}>Tip contract</p>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {TIP_CONTRACT.map(t => (
            <button key={t} onClick={() => setF("tipContract", t)}
              className={form.tipContract === t ? "btn btn--primary btn--sm" : "btn btn--secondary btn--sm"}
              style={{ fontSize: "0.8125rem" }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Checkboxes setari */}
      <div className="sal-section-box">
        <p className="sal-section-box__titlu">Alte setări</p>
        <Chk label="Funcția de bază (se aplică deducere personală)" checked={form.functiaDeBase} onChange={v => setF("functiaDeBase", v)} />
        <Chk label="CAS și CASS la cel puțin minimul pe economie" checked={form.cassCasMinimEconomie} onChange={v => setF("cassCasMinimEconomie", v)} />
        <Chk label="Singurul venit pentru care plătesc contribuții sociale" checked={form.singurulVenit} onChange={v => setF("singurulVenit", v)} indent disabled={!form.cassCasMinimEconomie} />
        <Chk label="Pensionar" checked={form.pensionar} onChange={v => setF("pensionar", v)} />

        <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
          <div className="form-field" style={{ flex: 1, minWidth: 160 }}>
            <label className="form-field__label">Invaliditate</label>
            <select className="input" value={form.invaliditate} onChange={e => setF("invaliditate", e.target.value)}>
              {INVALIDITATE.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="form-field" style={{ flex: 1, minWidth: 160 }}>
            <label className="form-field__label">Grad de handicap</label>
            <select className="input" value={form.gradHandicap} onChange={e => setF("gradHandicap", e.target.value)}>
              {GRAD_HANDICAP.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
          {selected && (
            <>
              <button className="btn btn--secondary btn--sm"
                onClick={() => setSubModal({ type: "persoane", angajatId: selected.id })}>
                Persoane în întreținere ({selected.persoaneIntretinere.length})
              </button>
              <button className="btn btn--secondary btn--sm"
                onClick={() => setSubModal({ type: "coasigurati", angajatId: selected.id })}>
                Coasigurați ({selected.coasigurati.length})
              </button>
            </>
          )}
          {!selected && <p style={{ fontSize: "0.75rem", color: "#6b7280" }}>Salvați angajatul pentru a adăuga persoane în întreținere / coasigurați.</p>}
        </div>
      </div>

      {/* Informatii angajat */}
      <div className="form-grid form-grid--2">
        <div className="form-field">
          <label className="form-field__label">Nume *</label>
          <input className="input" value={form.nume} onChange={e => setF("nume", e.target.value)} placeholder="Popescu" />
        </div>
        <div className="form-field">
          <label className="form-field__label">Prenume</label>
          <input className="input" value={form.prenume} onChange={e => setF("prenume", e.target.value)} placeholder="Ion" />
        </div>
        <div className="form-field">
          <label className="form-field__label">CNP</label>
          <input className="input" value={form.cnp} onChange={e => setF("cnp", e.target.value)} maxLength={13} placeholder="1234567890123" />
        </div>
        <div className="form-field">
          <label className="form-field__label">Județ (casă asigurări)</label>
          <select className="input" value={form.judet} onChange={e => setF("judet", e.target.value)}>
            {JUDETE.map(j => <option key={j} value={j}>{j}</option>)}
          </select>
        </div>
        <div className="form-field form-field--full">
          <label className="form-field__label">Adresă</label>
          <input className="input" value={form.adresa} onChange={e => setF("adresa", e.target.value)} placeholder="Str. Exemplu nr. 1, Sector 1" />
        </div>
        <div className="form-field">
          <label className="form-field__label">Telefon</label>
          <input className="input" value={form.telefon} onChange={e => setF("telefon", e.target.value)} placeholder="07xx xxx xxx" />
        </div>
        <div className="form-field">
          <label className="form-field__label">Email</label>
          <input className="input" type="email" value={form.email} onChange={e => setF("email", e.target.value)} />
        </div>
        <div className="form-field form-field--full">
          <label className="form-field__label">Mențiuni</label>
          <input className="input" value={form.mentiuni} onChange={e => setF("mentiuni", e.target.value)} />
        </div>
      </div>
    </div>
  )

  const tabContributii = (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div className="sal-section-box">
        <p className="sal-section-box__titlu">Contribuții din partea angajatului</p>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.35rem" }}>
          <Chk label="Sănătate la casa de asigurări:" checked={form.platesteCASS} onChange={v => setF("platesteCASS", v)} />
          <select className="input" value={form.judet} onChange={e => setF("judet", e.target.value)}
            disabled={!form.platesteCASS}
            style={{ width: 200, opacity: form.platesteCASS ? 1 : 0.45 }}>
            {JUDETE.map(j => <option key={j} value={j}>{j}</option>)}
          </select>
        </div>
        <Chk label="Baza de calcul este salariul minim pe economie (în loc de net)" checked={form.cassMinimEconomie} onChange={v => setF("cassMinimEconomie", v)} indent disabled={!form.platesteCASS} />
        <Chk label="Pensie (CAS 25%)" checked={form.platestePensie} onChange={v => setF("platestePensie", v)} />
        <Chk label="Impozit pe venit (10%)" checked={form.platesteImpozit} onChange={v => setF("platesteImpozit", v)} />
        <Chk label="Baza de calcul este salariul brut (în loc de net)" checked={form.impozitBazaBrut} onChange={v => setF("impozitBazaBrut", v)} indent disabled={!form.platesteImpozit} />
      </div>

      <div className="sal-section-box">
        <p className="sal-section-box__titlu">Contribuții din partea asociației</p>
        <Chk label="Sănătate" checked={form.asocSanatate} onChange={v => setF("asocSanatate", v)} />
        <Chk label="Șomaj" checked={form.asocSomaj} onChange={v => setF("asocSomaj", v)} />
        <Chk label="Pensie" checked={form.asocPensie} onChange={v => setF("asocPensie", v)} />
        <Chk label="Concedii și indemnizații de la persoane juridice/fizice" checked={form.asocConcedii} onChange={v => setF("asocConcedii", v)} />
        <Chk label="Fond risc și accidente" checked={form.asocFondRisc} onChange={v => setF("asocFondRisc", v)} />
        <Chk label="Contribuția asiguratorie de muncă (CAM 2.25%)" checked={form.asocCAM} onChange={v => setF("asocCAM", v)} />
      </div>
    </div>
  )

  const tabSalariu = (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div className="form-grid form-grid--2">
        <div className="form-field">
          <label className="form-field__label">Funcție</label>
          <select className="input" value={form.functie} onChange={e => setF("functie", e.target.value)}>
            <option value="">— selectează —</option>
            {FUNCTII.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label className="form-field__label">Detalii funcție</label>
          <input className="input" value={form.detaliiFunctie} onChange={e => setF("detaliiFunctie", e.target.value)} />
        </div>
        <div className="form-field">
          <label className="form-field__label">Nivel studii</label>
          <select className="input" value={form.nivelStudii} onChange={e => setF("nivelStudii", e.target.value)}>
            <option value="">— selectează —</option>
            {NIVEL_STUDII.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label className="form-field__label">Nr. contract</label>
          <input className="input" value={form.nrContract} onChange={e => setF("nrContract", e.target.value)} placeholder="1" />
        </div>
        <div className="form-field">
          <label className="form-field__label">Normă (ore/zi)</label>
          <input className="input" type="number" min={1} max={8} step={0.5} value={form.normaDeLucru} onChange={e => setF("normaDeLucru", e.target.value)} />
        </div>
        <div className="form-field">
          <label className="form-field__label">Data contractului</label>
          <RoDate className="input" value={form.dataAngajare} onChange={v => setF("dataAngajare", v)} style={{ colorScheme: "dark" }} />
        </div>
        <div className="form-field">
          <label className="form-field__label">Prima zi lucrată</label>
          <RoDate className="input" value={form.dataIntrareVigoare} onChange={v => setF("dataIntrareVigoare", v)} style={{ colorScheme: "dark" }} />
        </div>
        <div className="form-field">
          <label className="form-field__label">Data încetare</label>
          <RoDate className="input" value={form.dataIncetare} onChange={v => setF("dataIncetare", v)} style={{ colorScheme: "dark" }} />
        </div>
        {form.dataIncetare && (
          <div className="form-field">
            <label className="form-field__label">Mod încetare</label>
            <select className="input" value={form.modIncetare} onChange={e => setF("modIncetare", e.target.value)}>
              <option value="">— selectează —</option>
              {MOD_INCETARE.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        )}
        <div className="form-field">
          <label className="form-field__label">Bancă</label>
          <input className="input" value={form.banca} onChange={e => setF("banca", e.target.value)} placeholder="BCR, BRD, ING..." />
        </div>
        <div className="form-field form-field--full">
          <label className="form-field__label">Cont bancar (IBAN)</label>
          <input className="input" value={form.contBancar} onChange={e => setF("contBancar", e.target.value)} placeholder="RO49AAAA1B31007593840000" />
        </div>
      </div>

      {/* Calculator salariu */}
      <div className="sal-section-box">
        <p className="sal-section-box__titlu">Calculator salariu</p>
        <div className="form-grid form-grid--2">
          <div className="form-field">
            <label className="form-field__label">Salariu brut (RON) *</label>
            <input className="input" type="number" min={0} step={0.01} value={form.salariuBrut}
              onChange={e => setF("salariuBrut", e.target.value)} placeholder="4050" />
          </div>
          <div className="form-field">
            <label className="form-field__label">Bonuri de masă (RON)</label>
            <input className="input" type="number" min={0} step={0.01} value={form.bonuriMasa}
              onChange={e => setF("bonuriMasa", e.target.value)} />
          </div>
          <div className="form-field">
            <label className="form-field__label">Deducere personală (RON)</label>
            <input className="input" type="number" min={0} step={0.01} value={form.deducerePersonala}
              onChange={e => setF("deducerePersonala", e.target.value)} />
          </div>
        </div>
        {brutCalc > 0 && (
          <div style={{ display: "flex", gap: "1rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
            <div className="sal-calc-chip">
              <span>Brut</span><strong>{brutCalc.toFixed(2)} RON</strong>
            </div>
            {form.asocCAM && (
              <div className="sal-calc-chip">
                <span>CAM angajator (2.25%)</span><strong>{camCalc.toFixed(2)} RON</strong>
              </div>
            )}
            <div className="sal-calc-chip sal-calc-chip--total">
              <span>Cost total asociație</span><strong>{costTotal.toFixed(2)} RON</strong>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="page-kicker">Salarii</p>
          <h1 className="page-title">Angajați</h1>
          <p className="page-sub">{activeName || "Selectează o asociație"} — {activi.length} activi</p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8125rem", color: "#9ca3af", cursor: "pointer" }}>
            <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />
            Incluzi inactivi
          </label>
          <button onClick={openAdauga} className="btn btn--primary" disabled={!asociatieId}>+ Angajat nou</button>
        </div>
      </div>

      {loading ? (
        <div className="spv-loading">Se încarcă...</div>
      ) : angajati.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state__icon">👷</span>
          <p className="empty-state__title">Niciun angajat</p>
          <p className="empty-state__desc">Adaugă primul angajat al asociației pentru a putea genera state de plată.</p>
          <button onClick={openAdauga} className="btn btn--primary" disabled={!asociatieId}>+ Angajat nou</button>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nume</th>
                <th>CNP</th>
                <th>Funcție</th>
                <th>Contract</th>
                <th>Data angajare</th>
                <th style={{ textAlign: "right" }}>Brut lunar</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {angajati.map(a => (
                <tr key={a.id} style={a.isActive ? {} : { opacity: 0.45 }}>
                  <td>
                    <strong>{a.nume} {a.prenume ?? ""}</strong>
                    {a.email && <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>{a.email}</div>}
                    {a.pensionar && <span className="pill pill--gray" style={{ fontSize: "0.65rem", padding: "1px 5px" }}>Pensionar</span>}
                  </td>
                  <td style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#9ca3af" }}>{a.cnp || "—"}</td>
                  <td>{a.functie || "—"}</td>
                  <td style={{ fontSize: "0.8rem" }}>{a.tipContract}</td>
                  <td>{a.dataAngajare ? new Date(a.dataAngajare).toLocaleDateString("ro-RO") : "—"}</td>
                  <td style={{ textAlign: "right" }}><strong>{a.salariuBrut.toFixed(2)}</strong> <span style={{ fontSize: "0.7rem", color: "#9ca3af" }}>RON</span></td>
                  <td><span className={`pill ${a.isActive ? "pill--green" : "pill--gray"}`}>{a.isActive ? "Activ" : "Inactiv"}</span></td>
                  <td>
                    <div style={{ display: "flex", gap: "0.375rem" }}>
                      <button onClick={() => setDocAngajat(a)} className="btn-action" title="Documente HR">Documente</button>
                      <button onClick={() => openEditeaza(a)} className="btn-action">Editează</button>
                      {a.isActive
                        ? <button onClick={() => handleDeactivate(a)} className="btn-action btn-action--danger">Dezactivează</button>
                        : <button onClick={() => handleActivate(a)} className="btn-action">Activează</button>
                      }
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {activi.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={5} style={{ padding: "0.75rem 1rem", fontSize: "0.75rem", color: "#9ca3af" }}>
                    Total: {activi.length} activ{activi.length !== 1 ? "i" : ""}
                    {inactivi.length > 0 && `, ${inactivi.length} inactiv${inactivi.length !== 1 ? "i" : ""}`}
                  </td>
                  <td style={{ textAlign: "right", padding: "0.75rem 1rem", fontWeight: 700 }}>
                    {activi.reduce((s, a) => s + a.salariuBrut, 0).toFixed(2)} RON
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* Modal angajat */}
      {modal && (
        <div className="modal-overlay">
          <div className="modal modal--wide">
            <div className="modal__header">
              <h2 className="modal__title">{modal === "adauga" ? "Angajat nou" : `Editează — ${selected?.nume} ${selected?.prenume ?? ""}`}</h2>
              <button className="modal__close" onClick={closeModal}>✕</button>
            </div>

            {/* Tabs */}
            <div className="sal-tabs">
              {(["general", "contributii", "salariu"] as const).map(t => (
                <button key={t} onClick={() => setActiveTab(t)}
                  className={`sal-tab${activeTab === t ? " sal-tab--active" : ""}`}>
                  {t === "general" ? "General" : t === "contributii" ? "Contribuții" : "Salariu"}
                </button>
              ))}
            </div>

            <div className="modal__body" style={{ minHeight: 340 }}>
              {activeTab === "general"      && tabGeneral}
              {activeTab === "contributii"  && tabContributii}
              {activeTab === "salariu"      && tabSalariu}
              {err && <p className="wizard__error" style={{ marginTop: "0.75rem" }}>{err}</p>}
            </div>

            <div className="modal__footer">
              <button className="btn btn--secondary" onClick={closeModal}>Anulează</button>
              <button className="btn btn--primary" onClick={handleSave} disabled={saving}>
                {saving ? "Se salvează..." : modal === "adauga" ? "Adaugă" : "Salvează"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Documente */}
      {docAngajat && asociatieId && (
        <DocumenteAngajatModal angajat={docAngajat} asociatieId={asociatieId} onClose={() => setDocAngajat(null)} />
      )}

      {/* Sub-modal persoane */}
      {subModal && (
        <PersoaneModal
          titlu={subModal.type === "persoane" ? "Persoane în întreținere" : "Coasigurați"}
          endpoint={subModal.type === "persoane" ? "persoane-intretinere" : "coasigurati"}
          angajatId={subModal.angajatId}
          onClose={() => { setSubModal(null); if (selected) fetch_(asociatieId, showAll) }}
        />
      )}
    </div>
  )
}
