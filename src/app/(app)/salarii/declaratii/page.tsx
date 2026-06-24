"use client"

import { useState, useEffect, useCallback } from "react"
import { useAsociatie } from "@/lib/AsociatieContext"

const LUNI_FULL = ["Ianuarie","Februarie","Martie","Aprilie","Mai","Iunie","Iulie","August","Septembrie","Octombrie","Noiembrie","Decembrie"]

interface Stat {
  id: string; luna: number; an: number; status: string
  totalBrut: number; totalNet: number; totalCas: number
  totalCass: number; totalImpozit: number; totalCam: number
  randuri: { angajat: { nume: string; prenume: string|null; cnp: string|null; functie: string|null }; salariuBrut: number; cas: number; cass: number; impozit: number; cam: number; salariuNet: number; zileLucrate: number }[]
}

export default function DeclaratiiPage() {
  const { activeId: asociatieId, activeName } = useAsociatie()
  const now = new Date()
  const [luna,    setLuna]    = useState(now.getMonth() + 1)
  const [an,      setAn]      = useState(now.getFullYear())
  const [stat,    setStat]    = useState<Stat | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchStat = useCallback(async (asocId: string, l: number, a: number) => {
    if (!asocId) return
    setLoading(true)
    try {
      const r    = await fetch(`/api/salarii/state-plata?asociatieId=${asocId}&luna=${l}&an=${a}`)
      const data = await r.json()
      setStat(Array.isArray(data) && data.length > 0 ? data[0] : null)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { if (asociatieId) fetchStat(asociatieId, luna, an) }, [asociatieId, luna, an, fetchStat])

  const ani = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i)

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="page-kicker">Salarii</p>
          <h1 className="page-title">Declarație D112</h1>
          <p className="page-sub">{activeName || "Selectează o asociație"} — declarație lunară privind obligațiile de plată</p>
        </div>
        <div className="spv-toolbar">
          <select className="spv-date-input" value={luna} onChange={e => setLuna(+e.target.value)}>
            {LUNI_FULL.map((l, i) => <option key={i+1} value={i+1}>{l}</option>)}
          </select>
          <select className="spv-date-input" value={an} onChange={e => setAn(+e.target.value)}>
            {ani.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="spv-loading">Se încarcă...</div>
      ) : !stat ? (
        <div className="empty-state">
          <span className="empty-state__icon">📄</span>
          <p className="empty-state__title">Nu există stat de plată pentru {LUNI_FULL[luna-1]} {an}</p>
          <p className="empty-state__desc">Generează mai întâi un stat de plată din secțiunea State de plată.</p>
          <a href="/salarii/state-de-plata" className="btn btn--primary">→ State de plată</a>
        </div>
      ) : (
        <>
          <div className="sal-d112-info">
            <div className="spv-card">
              <p className="spv-card__label">Sumar D112 — {LUNI_FULL[stat.luna-1]} {stat.an}</p>
              <div className="info-list">
                <div className="info-row"><span className="info-row__label">Nr. angajați</span><span className="info-row__value">{stat.randuri.length}</span></div>
                <div className="info-row"><span className="info-row__label">Total venituri brute</span><span className="info-row__value">{stat.totalBrut.toFixed(2)} RON</span></div>
                <div className="info-row"><span className="info-row__label">CAS angajați (25%)</span><span className="info-row__value" style={{ color: "#f87171" }}>{stat.totalCas.toFixed(2)} RON</span></div>
                <div className="info-row"><span className="info-row__label">CASS angajați (10%)</span><span className="info-row__value" style={{ color: "#f87171" }}>{stat.totalCass.toFixed(2)} RON</span></div>
                <div className="info-row"><span className="info-row__label">Impozit venit (10%)</span><span className="info-row__value" style={{ color: "#fde047" }}>{stat.totalImpozit.toFixed(2)} RON</span></div>
                <div className="info-row"><span className="info-row__label">CAM angajator (2.25%)</span><span className="info-row__value" style={{ color: "#a78bfa" }}>{stat.totalCam.toFixed(2)} RON</span></div>
                <div className="info-row" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", marginTop: "0.5rem", paddingTop: "0.75rem" }}>
                  <span className="info-row__label" style={{ fontWeight: 700 }}>Total obligații buget</span>
                  <span className="info-row__value" style={{ fontWeight: 800, color: "#fff" }}>
                    {(stat.totalCas + stat.totalCass + stat.totalImpozit + stat.totalCam).toFixed(2)} RON
                  </span>
                </div>
              </div>
            </div>

            <div className="spv-card">
              <p className="spv-card__label">Detaliu per angajat</p>
              <div className="table-wrap" style={{ marginTop: "0.5rem" }}>
                <table className="data-table" style={{ fontSize: "0.8rem" }}>
                  <thead>
                    <tr>
                      <th>Angajat</th>
                      <th>CNP</th>
                      <th style={{ textAlign: "right" }}>Brut</th>
                      <th style={{ textAlign: "right" }}>CAS</th>
                      <th style={{ textAlign: "right" }}>CASS</th>
                      <th style={{ textAlign: "right" }}>Impozit</th>
                      <th style={{ textAlign: "right" }}>CAM</th>
                      <th style={{ textAlign: "right" }}>Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stat.randuri.map((r, i) => (
                      <tr key={i}>
                        <td><strong>{r.angajat.nume} {r.angajat.prenume ?? ""}</strong><br /><small style={{ color: "#9ca3af" }}>{r.angajat.functie || ""}</small></td>
                        <td style={{ fontFamily: "monospace", fontSize: "0.7rem", color: "#9ca3af" }}>{r.angajat.cnp || "—"}</td>
                        <td style={{ textAlign: "right" }}>{r.salariuBrut.toFixed(2)}</td>
                        <td style={{ textAlign: "right", color: "#f87171" }}>{r.cas.toFixed(2)}</td>
                        <td style={{ textAlign: "right", color: "#f87171" }}>{r.cass.toFixed(2)}</td>
                        <td style={{ textAlign: "right", color: "#fde047" }}>{r.impozit.toFixed(2)}</td>
                        <td style={{ textAlign: "right", color: "#a78bfa" }}>{r.cam.toFixed(2)}</td>
                        <td style={{ textAlign: "right", color: "#4ade80", fontWeight: 700 }}>{r.salariuNet.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="sal-op-nota">
            <strong>📌 D112</strong> se depune electronic prin <a href="https://www.anaf.ro/anaf/internet/RO/servicii-online/e-services" target="_blank" rel="noopener noreferrer" style={{ color: "#a78bfa" }}>portalul ANAF</a> sau
            prin SPV cu semnătură digitală, până pe <strong>25 ale lunii următoare</strong>.
            Datele afișate aici sunt preluate din statul de plată generat în aplicație.
          </div>
        </>
      )}
    </div>
  )
}
