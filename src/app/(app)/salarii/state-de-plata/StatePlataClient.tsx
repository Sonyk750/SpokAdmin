"use client"

import { useState, useEffect, useCallback } from "react"
import { useAsociatie } from "@/lib/AsociatieContext"

interface AngajatMini { id: string; nume: string; prenume: string | null; functie: string | null; contBancar: string | null; banca: string | null }

interface Rand {
  id:           string
  angajat:      AngajatMini
  zileLucrate:  number
  zileLibere:   number
  oreSupliment: number
  salariuBrut:  number
  deducere:     number
  cas:          number
  cass:         number
  impozit:      number
  altRetineri:  number
  cam:          number
  salariuNet:   number
}

interface Stat {
  id:           string
  luna:         number
  an:           number
  status:       string
  totalBrut:    number
  totalNet:     number
  totalCas:     number
  totalCass:    number
  totalImpozit: number
  totalCam:     number
  randuri:      Rand[]
}

const LUNI = ["Ian","Feb","Mar","Apr","Mai","Iun","Iul","Aug","Sep","Oct","Nov","Dec"]
const LUNI_FULL = ["Ianuarie","Februarie","Martie","Aprilie","Mai","Iunie","Iulie","August","Septembrie","Octombrie","Noiembrie","Decembrie"]

const STATUS_PILL: Record<string,string> = {
  draft:  "pill pill--yellow",
  semnat: "pill pill--violet",
  platit: "pill pill--green",
}
const STATUS_LABEL: Record<string,string> = { draft: "Draft", semnat: "Semnat", platit: "Plătit" }

function fmt2(v: number) { return v.toFixed(2) }

export default function StatePlataClient({ defaultLuna, defaultAn }: { defaultLuna: number; defaultAn: number }) {
  const { activeId: asociatieId, activeName } = useAsociatie()

  const [luna,       setLuna]       = useState(defaultLuna)
  const [an,         setAn]         = useState(defaultAn)
  const [liste,      setListe]      = useState<Stat[]>([])
  const [selected,   setSelected]   = useState<Stat | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [generating, setGenerating] = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [msg,        setMsg]        = useState<{ type: "success"|"error"; text: string } | null>(null)
  // zile lucratoare editable per luna curentă
  const [zileLunaDefault, setZileLunaDefault] = useState(22)
  // randuri locale editabile
  const [randuri,    setRanduri]    = useState<Rand[]>([])

  const fetchListe = useCallback(async (asocId: string, l: number, a: number) => {
    if (!asocId) return
    setLoading(true)
    try {
      const r    = await fetch(`/api/salarii/state-plata?asociatieId=${asocId}&luna=${l}&an=${a}`)
      const data = await r.json()
      const arr  = Array.isArray(data) ? data : []
      setListe(arr)
      if (arr.length > 0) {
        setSelected(arr[0])
        setRanduri(arr[0].randuri)
      } else {
        setSelected(null)
        setRanduri([])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (asociatieId) fetchListe(asociatieId, luna, an)
  }, [asociatieId, luna, an, fetchListe])

  // Calculeaza zile lucratoare implicit pentru luna/an
  useEffect(() => {
    const zile = new Date(an, luna, 0).getDate()
    let luc = 0
    for (let z = 1; z <= zile; z++) {
      const zi = new Date(an, luna - 1, z).getDay()
      if (zi !== 0 && zi !== 6) luc++
    }
    setZileLunaDefault(luc)
  }, [luna, an])

  async function handleGenereaza() {
    setGenerating(true)
    setMsg(null)
    try {
      const r = await fetch("/api/salarii/state-plata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asociatieId, luna, an }),
      })
      const data = await r.json()
      if (!r.ok) { setMsg({ type: "error", text: data.error || "Eroare" }); return }
      setSelected(data)
      setRanduri(data.randuri)
      setListe([data])
      setMsg({ type: "success", text: "Stat generat cu succes." })
    } finally {
      setGenerating(false)
    }
  }

  function setRandVal(id: string, key: keyof Rand, val: string) {
    setRanduri(prev => prev.map(r => r.id === id ? { ...r, [key]: parseFloat(val) || 0 } : r))
  }

  async function handleSaveRanduri() {
    if (!selected) return
    setSaving(true)
    setMsg(null)
    try {
      const body = {
        randuri: randuri.map(r => ({
          id:                r.id,
          zileLucrate:       r.zileLucrate,
          zileLibere:        r.zileLibere,
          oreSupliment:      r.oreSupliment,
          altRetineri:       r.altRetineri,
          zileLucratoareLuna: zileLunaDefault,
        })),
      }
      const res  = await fetch(`/api/salarii/state-plata/${selected.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setMsg({ type: "error", text: data.error || "Eroare" }); return }
      setSelected(data)
      setRanduri(data.randuri)
      setMsg({ type: "success", text: "Salvat." })
    } finally {
      setSaving(false)
    }
  }

  async function handleStatus(status: string) {
    if (!selected) return
    setSaving(true)
    try {
      const res  = await fetch(`/api/salarii/state-plata/${selected.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
      })
      const data = await res.json()
      if (res.ok) { setSelected(data); setRanduri(data.randuri); setListe([data]) }
    } finally {
      setSaving(false)
    }
  }

  async function handleStergeStat() {
    if (!selected || !confirm("Ștergi statul de plată?")) return
    setSaving(true)
    try {
      const res = await fetch(`/api/salarii/state-plata/${selected.id}`, { method: "DELETE" })
      if (res.ok) { setSelected(null); setRanduri([]); setListe([]) }
    } finally {
      setSaving(false)
    }
  }

  const totalBrut    = randuri.reduce((s, r) => s + r.salariuBrut, 0)
  const totalCas     = randuri.reduce((s, r) => s + r.cas,         0)
  const totalCass    = randuri.reduce((s, r) => s + r.cass,        0)
  const totalImpozit = randuri.reduce((s, r) => s + r.impozit,     0)
  const totalNet     = randuri.reduce((s, r) => s + r.salariuNet,  0)
  const totalCam     = randuri.reduce((s, r) => s + r.cam,         0)

  const ani = Array.from({ length: 5 }, (_, i) => defaultAn - 2 + i)

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="page-kicker">Salarii</p>
          <h1 className="page-title">State de plată</h1>
          <p className="page-sub">{activeName || "Selectează o asociație"}</p>
        </div>
        <div className="spv-toolbar">
          <select className="spv-date-input" value={luna} onChange={e => setLuna(+e.target.value)}>
            {LUNI_FULL.map((l, i) => <option key={i+1} value={i+1}>{l}</option>)}
          </select>
          <select className="spv-date-input" value={an} onChange={e => setAn(+e.target.value)}>
            {ani.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          {selected && (
            <div style={{ display: "flex", gap: "0.375rem" }}>
              {selected.status === "draft" && (
                <>
                  <button onClick={handleSaveRanduri} disabled={saving} className="btn btn--primary btn--sm">
                    {saving ? "..." : "💾 Salvează"}
                  </button>
                  <button onClick={() => handleStatus("semnat")} disabled={saving} className="btn btn--secondary btn--sm">Semnează</button>
                  <button onClick={handleStergeStat} disabled={saving} className="btn btn--secondary btn--sm" style={{ color: "#f87171" }}>Șterge</button>
                </>
              )}
              {selected.status === "semnat" && (
                <button onClick={() => handleStatus("platit")} disabled={saving} className="btn btn--primary btn--sm">✅ Marchează plătit</button>
              )}
            </div>
          )}
        </div>
      </div>

      {msg && (
        <div className={`spv-alert spv-alert--${msg.type}`}>
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} className="spv-alert__close">✕</button>
        </div>
      )}

      {loading ? (
        <div className="spv-loading">Se încarcă...</div>
      ) : !selected ? (
        <div className="empty-state">
          <span className="empty-state__icon">📋</span>
          <p className="empty-state__title">Nu există stat pentru {LUNI_FULL[luna-1]} {an}</p>
          <p className="empty-state__desc">
            Generează un stat de plată pentru toți angajații activi ai asociației.
            Zile lucrătoare detectate automat: <strong>{zileLunaDefault}</strong>.
          </p>
          <button onClick={handleGenereaza} disabled={generating || !asociatieId} className="btn btn--primary">
            {generating ? "Se generează..." : "📋 Generează stat de plată"}
          </button>
        </div>
      ) : (
        <>
          {/* Header stat */}
          <div className="sal-stat-header">
            <div className="sal-stat-meta">
              <span>{LUNI_FULL[selected.luna-1]} {selected.an}</span>
              <span className={STATUS_PILL[selected.status]}>{STATUS_LABEL[selected.status]}</span>
            </div>
            {selected.status === "draft" && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem", color: "#9ca3af" }}>
                <label>Zile lucrătoare lună:</label>
                <input
                  type="number" min="1" max="23"
                  value={zileLunaDefault}
                  onChange={e => setZileLunaDefault(+e.target.value)}
                  className="spv-date-input"
                  style={{ width: "4rem" }}
                />
              </div>
            )}
          </div>

          {/* Tabel randuri */}
          <div className="table-wrap" style={{ overflowX: "auto" }}>
            <table className="data-table sal-table">
              <thead>
                <tr>
                  <th>Angajat</th>
                  <th style={{ textAlign: "right" }}>Zile lucrate</th>
                  <th style={{ textAlign: "right" }}>Ore suplimt.</th>
                  <th style={{ textAlign: "right" }}>Brut</th>
                  <th style={{ textAlign: "right" }}>CAS 25%</th>
                  <th style={{ textAlign: "right" }}>CASS 10%</th>
                  <th style={{ textAlign: "right" }}>Impozit 10%</th>
                  <th style={{ textAlign: "right" }}>Alte rețineri</th>
                  <th style={{ textAlign: "right", color: "#4ade80" }}>NET</th>
                  <th style={{ textAlign: "right", color: "#a78bfa", fontSize: "0.65rem" }}>CAM angaj.</th>
                </tr>
              </thead>
              <tbody>
                {randuri.map(r => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.angajat.nume} {r.angajat.prenume ?? ""}</strong>
                      {r.angajat.functie && <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>{r.angajat.functie}</div>}
                      {r.angajat.banca   && <div style={{ fontSize: "0.7rem", color: "#6b7280" }}>{r.angajat.banca} · {r.angajat.contBancar || "—"}</div>}
                    </td>
                    <td style={{ textAlign: "right", width: "6rem" }}>
                      {selected.status === "draft" ? (
                        <input
                          type="number" min="0" max={zileLunaDefault} step="1"
                          value={r.zileLucrate}
                          onChange={e => setRandVal(r.id, "zileLucrate", e.target.value)}
                          className="sal-input"
                        />
                      ) : r.zileLucrate}
                    </td>
                    <td style={{ textAlign: "right", width: "6rem" }}>
                      {selected.status === "draft" ? (
                        <input
                          type="number" min="0" step="0.5"
                          value={r.oreSupliment}
                          onChange={e => setRandVal(r.id, "oreSupliment", e.target.value)}
                          className="sal-input"
                        />
                      ) : r.oreSupliment || "—"}
                    </td>
                    <td style={{ textAlign: "right" }}>{fmt2(r.salariuBrut)}</td>
                    <td style={{ textAlign: "right", color: "#f87171" }}>{fmt2(r.cas)}</td>
                    <td style={{ textAlign: "right", color: "#f87171" }}>{fmt2(r.cass)}</td>
                    <td style={{ textAlign: "right", color: "#f87171" }}>{fmt2(r.impozit)}</td>
                    <td style={{ textAlign: "right", width: "7rem" }}>
                      {selected.status === "draft" ? (
                        <input
                          type="number" min="0" step="0.01"
                          value={r.altRetineri}
                          onChange={e => setRandVal(r.id, "altRetineri", e.target.value)}
                          className="sal-input"
                        />
                      ) : r.altRetineri > 0 ? fmt2(r.altRetineri) : "—"}
                    </td>
                    <td style={{ textAlign: "right", color: "#4ade80", fontWeight: 700 }}>{fmt2(r.salariuNet)}</td>
                    <td style={{ textAlign: "right", color: "#a78bfa", fontSize: "0.75rem" }}>{fmt2(r.cam)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="sal-total-row">
                  <td colSpan={3} style={{ padding: "0.875rem 1rem", fontWeight: 700, fontSize: "0.8125rem" }}>TOTAL</td>
                  <td style={{ textAlign: "right", fontWeight: 700, padding: "0.875rem 1rem" }}>{fmt2(totalBrut)}</td>
                  <td style={{ textAlign: "right", color: "#f87171", padding: "0.875rem 1rem" }}>{fmt2(totalCas)}</td>
                  <td style={{ textAlign: "right", color: "#f87171", padding: "0.875rem 1rem" }}>{fmt2(totalCass)}</td>
                  <td style={{ textAlign: "right", color: "#f87171", padding: "0.875rem 1rem" }}>{fmt2(totalImpozit)}</td>
                  <td style={{ padding: "0.875rem 1rem" }} />
                  <td style={{ textAlign: "right", color: "#4ade80", fontWeight: 800, padding: "0.875rem 1rem", fontSize: "1rem" }}>{fmt2(totalNet)}</td>
                  <td style={{ textAlign: "right", color: "#a78bfa", padding: "0.875rem 1rem", fontSize: "0.75rem" }}>{fmt2(totalCam)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Sumar contributii */}
          <div className="sal-sumar">
            <div className="sal-sumar__card sal-sumar__card--blue">
              <p className="sal-sumar__label">Fond brut salarial</p>
              <p className="sal-sumar__val">{fmt2(totalBrut)} <span>RON</span></p>
            </div>
            <div className="sal-sumar__card sal-sumar__card--red">
              <p className="sal-sumar__label">CAS angajați (25%)</p>
              <p className="sal-sumar__val">{fmt2(totalCas)} <span>RON</span></p>
            </div>
            <div className="sal-sumar__card sal-sumar__card--red">
              <p className="sal-sumar__label">CASS angajați (10%)</p>
              <p className="sal-sumar__val">{fmt2(totalCass)} <span>RON</span></p>
            </div>
            <div className="sal-sumar__card sal-sumar__card--orange">
              <p className="sal-sumar__label">Impozit venit (10%)</p>
              <p className="sal-sumar__val">{fmt2(totalImpozit)} <span>RON</span></p>
            </div>
            <div className="sal-sumar__card sal-sumar__card--green">
              <p className="sal-sumar__label">Net de plată</p>
              <p className="sal-sumar__val">{fmt2(totalNet)} <span>RON</span></p>
            </div>
            <div className="sal-sumar__card sal-sumar__card--violet">
              <p className="sal-sumar__label">CAM angajator (2.25%)</p>
              <p className="sal-sumar__val">{fmt2(totalCam)} <span>RON</span></p>
            </div>
          </div>

          <p style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: "0.25rem" }}>
            Cost total angajator = Brut + CAM = <strong style={{ color: "#d1d5db" }}>{fmt2(totalBrut + totalCam)} RON</strong>
          </p>
        </>
      )}
    </div>
  )
}
