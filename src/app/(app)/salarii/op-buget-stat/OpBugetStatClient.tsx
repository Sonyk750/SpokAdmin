"use client"

import { useState, useEffect, useCallback } from "react"
import { useAsociatie } from "@/lib/AsociatieContext"

// Conturi ANAF pentru plata obligatiilor salariale
const CONTURI_ANAF = [
  {
    key:   "cas",
    label: "CAS — contribuția la pensii",
    cota:  "25% angajat",
    iban:  "RO37TREZ999502XXX004XXXX",  // cont indicativ ANAF CAS
    detalii: "Contribuția de asigurări sociale (angajat 25%)",
    culoare: "red",
  },
  {
    key:   "cass",
    label: "CASS — contribuția la sănătate",
    cota:  "10% angajat",
    iban:  "RO07TREZ999502XXX005XXXX",  // cont indicativ ANAF CASS
    detalii: "Contribuția de asigurări sociale de sănătate (angajat 10%)",
    culoare: "orange",
  },
  {
    key:   "impozit",
    label: "Impozit pe venit din salarii",
    cota:  "10% din baza impozabilă",
    iban:  "RO29TREZ999502XXX013XXXX",  // cont indicativ impozit venit
    detalii: "Impozit pe veniturile din salarii și asimilate salariilor",
    culoare: "yellow",
  },
  {
    key:   "cam",
    label: "CAM — contribuția asiguratorie",
    cota:  "2.25% angajator",
    iban:  "RO37TREZ999502XXX010XXXX",  // cont indicativ CAM
    detalii: "Contribuția asiguratorie pentru muncă (angajator 2.25%)",
    culoare: "violet",
  },
]

interface Stat {
  id:           string
  luna:         number
  an:           number
  status:       string
  totalCas:     number
  totalCass:    number
  totalImpozit: number
  totalCam:     number
  totalBrut:    number
  totalNet:     number
}

const LUNI_FULL = ["Ianuarie","Februarie","Martie","Aprilie","Mai","Iunie","Iulie","August","Septembrie","Octombrie","Noiembrie","Decembrie"]

export default function OpBugetStatClient({ defaultLuna, defaultAn }: { defaultLuna: number; defaultAn: number }) {
  const { activeId: asociatieId, activeName } = useAsociatie()

  const [luna,    setLuna]    = useState(defaultLuna)
  const [an,      setAn]      = useState(defaultAn)
  const [stat,    setStat]    = useState<Stat | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied,  setCopied]  = useState<string | null>(null)

  const fetchStat = useCallback(async (asocId: string, l: number, a: number) => {
    if (!asocId) return
    setLoading(true)
    try {
      const r    = await fetch(`/api/salarii/state-plata?asociatieId=${asocId}&luna=${l}&an=${a}`)
      const data = await r.json()
      setStat(Array.isArray(data) && data.length > 0 ? data[0] : null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (asociatieId) fetchStat(asociatieId, luna, an) }, [asociatieId, luna, an, fetchStat])

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 1800)
    })
  }

  const valori: Record<string, number> = stat
    ? { cas: stat.totalCas, cass: stat.totalCass, impozit: stat.totalImpozit, cam: stat.totalCam }
    : { cas: 0, cass: 0, impozit: 0, cam: 0 }

  const totalBuget = Object.values(valori).reduce((s, v) => s + v, 0)
  const scadenta   = `25.${String(luna < 12 ? luna + 1 : 1).padStart(2, "0")}.${luna < 12 ? an : an + 1}`

  const ani = Array.from({ length: 5 }, (_, i) => defaultAn - 2 + i)

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="page-kicker">Salarii</p>
          <h1 className="page-title">OP Buget de stat</h1>
          <p className="page-sub">
            {activeName || "Selectează o asociație"} — scadență <strong>{scadenta}</strong>
          </p>
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
          <span className="empty-state__icon">🏦</span>
          <p className="empty-state__title">Nu există stat de plată pentru {LUNI_FULL[luna-1]} {an}</p>
          <p className="empty-state__desc">Generează mai întâi un stat de plată pentru a vedea obligațiile la bugetul de stat.</p>
          <a href="/salarii/state-de-plata" className="btn btn--primary">→ State de plată</a>
        </div>
      ) : (
        <>
          <div className="sal-op-info">
            <span className="sal-op-info__label">Perioadă</span>
            <span className="sal-op-info__val">{LUNI_FULL[stat.luna-1]} {stat.an}</span>
            <span className="sal-op-info__sep">·</span>
            <span className="sal-op-info__label">Scadență plată</span>
            <span className="sal-op-info__val">{scadenta}</span>
            <span className="sal-op-info__sep">·</span>
            <span className="sal-op-info__label">Total obligații</span>
            <span className="sal-op-info__val sal-op-info__val--big">{totalBuget.toFixed(2)} RON</span>
          </div>

          <div className="sal-op-cards">
            {CONTURI_ANAF.map(c => {
              const suma = valori[c.key] ?? 0
              return (
                <div key={c.key} className={`sal-op-card sal-op-card--${c.culoare}`}>
                  <div className="sal-op-card__top">
                    <div>
                      <p className="sal-op-card__label">{c.label}</p>
                      <p className="sal-op-card__cota">{c.cota}</p>
                    </div>
                    <p className="sal-op-card__suma">{suma.toFixed(2)} <span>RON</span></p>
                  </div>
                  <div className="sal-op-card__iban">
                    <span className="sal-op-card__iban-label">IBAN beneficiar ANAF</span>
                    <div className="sal-op-card__iban-row">
                      <code>{c.iban}</code>
                      <button
                        onClick={() => copy(c.iban, c.key + "_iban")}
                        className="sal-op-card__copy"
                        title="Copiază IBAN"
                      >
                        {copied === c.key + "_iban" ? "✓" : "📋"}
                      </button>
                    </div>
                  </div>
                  <div className="sal-op-card__desc">
                    <p>{c.detalii}</p>
                    <div className="sal-op-card__op-fields">
                      <div className="sal-op-card__op-row">
                        <span>Sumă</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                          <strong>{suma.toFixed(2)} RON</strong>
                          <button onClick={() => copy(suma.toFixed(2), c.key + "_suma")} className="sal-op-card__copy">
                            {copied === c.key + "_suma" ? "✓" : "📋"}
                          </button>
                        </div>
                      </div>
                      <div className="sal-op-card__op-row">
                        <span>Explicație OP</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                          <small style={{ color: "#9ca3af" }}>
                            {c.detalii.split(" ")[0].toUpperCase()} {LUNI_FULL[stat.luna-1].substring(0,3).toUpperCase()} {stat.an}
                          </small>
                          <button
                            onClick={() => copy(`${c.detalii.split(" ")[0].toUpperCase()} ${LUNI_FULL[stat.luna-1].substring(0,3).toUpperCase()} ${stat.an}`, c.key + "_exp")}
                            className="sal-op-card__copy"
                          >
                            {copied === c.key + "_exp" ? "✓" : "📋"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="sal-op-total">
            <span>Total de virat la bugetul de stat pentru {LUNI_FULL[stat.luna-1]} {stat.an}</span>
            <strong>{totalBuget.toFixed(2)} RON</strong>
          </div>

          <div className="sal-op-nota">
            <strong>⚠️ Important:</strong> IBAN-urile afișate sunt indicative. Verifică conturile actualizate pe{" "}
            <a href="https://www.anaf.ro" target="_blank" rel="noopener noreferrer" style={{ color: "#a78bfa" }}>anaf.ro</a>{" "}
            sau la trezoreria locală înainte de a efectua plățile.
            Scadența este <strong>25 ale lunii următoare</strong> perioadei de raportare.
          </div>
        </>
      )}
    </div>
  )
}
