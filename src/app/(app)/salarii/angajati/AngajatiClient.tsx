"use client"

import { useState, useCallback, useEffect } from "react"
import { useAsociatie } from "@/lib/AsociatieContext"

interface Angajat {
  id:                string
  nume:              string
  prenume:           string | null
  cnp:               string | null
  functie:           string | null
  tipContract:       string
  dataAngajare:      string | null
  dataIncetare:      string | null
  salariuBrut:       number
  deducerePersonala: number
  normaDeLucru:      number
  contBancar:        string | null
  banca:             string | null
  email:             string | null
  telefon:           string | null
  isActive:          boolean
}

const TIP_CONTRACT = ["CIM", "PFA", "Convenție civilă", "Zilier"]
const FUNCTII      = ["Administrator", "Îngrijitor", "Contabil", "Casier", "Electrician", "Instalator", "Alta"]

const emptyForm = {
  nume: "", prenume: "", cnp: "", functie: "", tipContract: "CIM",
  dataAngajare: "", salariuBrut: "", deducerePersonala: "0",
  normaDeLucru: "8", contBancar: "", banca: "", email: "", telefon: "",
}

export default function AngajatiClient() {
  const { activeId: asociatieId, activeName } = useAsociatie()

  const [angajati, setAngajati] = useState<Angajat[]>([])
  const [loading,  setLoading]  = useState(true)
  const [modal,    setModal]    = useState<"adauga" | "editeaza" | null>(null)
  const [selected, setSelected] = useState<Angajat | null>(null)
  const [form,     setForm]     = useState({ ...emptyForm })
  const [saving,   setSaving]   = useState(false)
  const [err,      setErr]      = useState("")
  const [showAll,  setShowAll]  = useState(false)

  const fetch_ = useCallback(async (asocId: string, all: boolean) => {
    if (!asocId) return
    setLoading(true)
    try {
      const r    = await fetch(`/api/salarii/angajati?asociatieId=${asocId}${all ? "&all=true" : ""}`)
      const data = await r.json()
      setAngajati(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (asociatieId) fetch_(asociatieId, showAll) }, [asociatieId, showAll, fetch_])

  function openAdauga() {
    setForm({ ...emptyForm })
    setSelected(null)
    setErr("")
    setModal("adauga")
  }

  function openEditeaza(a: Angajat) {
    setForm({
      nume:              a.nume,
      prenume:           a.prenume           ?? "",
      cnp:               a.cnp               ?? "",
      functie:           a.functie           ?? "",
      tipContract:       a.tipContract,
      dataAngajare:      a.dataAngajare ? a.dataAngajare.split("T")[0] : "",
      salariuBrut:       String(a.salariuBrut),
      deducerePersonala: String(a.deducerePersonala),
      normaDeLucru:      String(a.normaDeLucru),
      contBancar:        a.contBancar ?? "",
      banca:             a.banca     ?? "",
      email:             a.email     ?? "",
      telefon:           a.telefon   ?? "",
    })
    setSelected(a)
    setErr("")
    setModal("editeaza")
  }

  function closeModal() { setModal(null); setSelected(null); setErr("") }

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSave() {
    if (!form.nume.trim()) { setErr("Numele este obligatoriu"); return }
    if (!form.salariuBrut || isNaN(parseFloat(form.salariuBrut))) { setErr("Salariul brut este invalid"); return }

    setSaving(true)
    setErr("")
    try {
      const body = { ...form, asociatieId }
      const url  = modal === "editeaza" ? `/api/salarii/angajati/${selected!.id}` : "/api/salarii/angajati"
      const meth = modal === "editeaza" ? "PUT" : "POST"
      const r    = await fetch(url, { method: meth, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const data = await r.json()
      if (!r.ok) { setErr(data.error || "Eroare"); return }

      closeModal()
      fetch_(asociatieId, showAll)
    } finally {
      setSaving(false)
    }
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

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="page-kicker">Salarii</p>
          <h1 className="page-title">Angajați</h1>
          <p className="page-sub">{activeName || "Selectează o asociație"} — {activi.length} activi</p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8125rem", color: "var(--text-muted, #9ca3af)", cursor: "pointer" }}>
            <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />
            Incluzi inactivi
          </label>
          <button onClick={openAdauga} className="btn btn--primary" disabled={!asociatieId}>
            + Angajat nou
          </button>
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
                <th style={{ textAlign: "right" }}>Deducere</th>
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
                  </td>
                  <td style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#9ca3af" }}>{a.cnp || "—"}</td>
                  <td>{a.functie || "—"}</td>
                  <td>{a.tipContract}</td>
                  <td>{a.dataAngajare ? new Date(a.dataAngajare).toLocaleDateString("ro-RO") : "—"}</td>
                  <td style={{ textAlign: "right" }}><strong>{a.salariuBrut.toFixed(2)}</strong> <span style={{ fontSize: "0.7rem", color: "#9ca3af" }}>RON</span></td>
                  <td style={{ textAlign: "right" }}>{a.deducerePersonala > 0 ? a.deducerePersonala.toFixed(2) : "—"}</td>
                  <td>
                    <span className={`pill ${a.isActive ? "pill--green" : "pill--gray"}`}>
                      {a.isActive ? "Activ" : "Inactiv"}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "0.375rem" }}>
                      <button onClick={() => openEditeaza(a)} className="btn-action">Editează</button>
                      {a.isActive
                        ? <button onClick={() => handleDeactivate(a)} className="btn-action btn-action--danger">Dezactivează</button>
                        : <button onClick={() => handleActivate(a)}  className="btn-action">Activează</button>
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
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) closeModal() }}>
          <div className="modal">
            <div className="modal__header">
              <h2 className="modal__title">{modal === "adauga" ? "Angajat nou" : "Editează angajat"}</h2>
              <button className="modal__close" onClick={closeModal}>✕</button>
            </div>
            <div className="modal__body">
              <div className="form-grid form-grid--2">
                <div className="form-field">
                  <label className="form-field__label">Nume *</label>
                  <input className="input" value={form.nume} onChange={e => set("nume", e.target.value)} placeholder="Popescu" />
                </div>
                <div className="form-field">
                  <label className="form-field__label">Prenume</label>
                  <input className="input" value={form.prenume} onChange={e => set("prenume", e.target.value)} placeholder="Ion" />
                </div>
                <div className="form-field">
                  <label className="form-field__label">CNP</label>
                  <input className="input" value={form.cnp} onChange={e => set("cnp", e.target.value)} placeholder="1234567890123" maxLength={13} />
                </div>
                <div className="form-field">
                  <label className="form-field__label">Funcție</label>
                  <select className="input" value={form.functie} onChange={e => set("functie", e.target.value)}>
                    <option value="">— selectează —</option>
                    {FUNCTII.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label className="form-field__label">Tip contract</label>
                  <select className="input" value={form.tipContract} onChange={e => set("tipContract", e.target.value)}>
                    {TIP_CONTRACT.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label className="form-field__label">Data angajare</label>
                  <input className="input" type="date" value={form.dataAngajare} onChange={e => set("dataAngajare", e.target.value)} style={{ colorScheme: "dark" }} />
                </div>
                <div className="form-field">
                  <label className="form-field__label">Salariu brut lunar (RON) *</label>
                  <input className="input" type="number" min="0" step="0.01" value={form.salariuBrut} onChange={e => set("salariuBrut", e.target.value)} placeholder="4050" />
                </div>
                <div className="form-field">
                  <label className="form-field__label">Deducere personală (RON)</label>
                  <input className="input" type="number" min="0" step="0.01" value={form.deducerePersonala} onChange={e => set("deducerePersonala", e.target.value)} placeholder="0" />
                </div>
                <div className="form-field">
                  <label className="form-field__label">Normă de lucru (ore/zi)</label>
                  <input className="input" type="number" min="1" max="8" step="0.5" value={form.normaDeLucru} onChange={e => set("normaDeLucru", e.target.value)} />
                </div>
                <div className="form-field">
                  <label className="form-field__label">Telefon</label>
                  <input className="input" value={form.telefon} onChange={e => set("telefon", e.target.value)} placeholder="07xx xxx xxx" />
                </div>
                <div className="form-field">
                  <label className="form-field__label">Email</label>
                  <input className="input" type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="angajat@email.ro" />
                </div>
                <div className="form-field">
                  <label className="form-field__label">Bancă</label>
                  <input className="input" value={form.banca} onChange={e => set("banca", e.target.value)} placeholder="BCR, BRD, ING..." />
                </div>
                <div className="form-field form-field--full">
                  <label className="form-field__label">Cont bancar (IBAN)</label>
                  <input className="input" value={form.contBancar} onChange={e => set("contBancar", e.target.value)} placeholder="RO49AAAA1B31007593840000" />
                </div>
              </div>
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
    </div>
  )
}
