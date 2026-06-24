"use client"

import { useState, useEffect } from "react"

type SpvConfig = { redirectUri: string; authUrl: string; appUrl: string }

export default function SetariSpvPage() {
  const [config,  setConfig]  = useState<SpvConfig | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/spv/config")
      .then(r => r.json())
      .then(d => { setConfig(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="page-kicker">SPV / e-Factură</p>
          <h1 className="page-title">Setări SPV</h1>
          <p className="page-sub">Configurare conexiune ANAF</p>
        </div>
      </div>

      <div className="spv-card">
        <p className="spv-card__label">Configurare OAuth ANAF</p>
        {loading ? (
          <p className="spv-card__loading">Se încarcă...</p>
        ) : config ? (
          <div className="info-list">
            <div className="info-row">
              <span className="info-row__label">URL autorizare</span>
              <span className="info-row__value" style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>
                {config.authUrl || "—"}
              </span>
            </div>
            <div className="info-row">
              <span className="info-row__label">Redirect URI înregistrat</span>
              <span className="info-row__value" style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>
                {config.redirectUri || "—"}
              </span>
            </div>
            <div className="info-row">
              <span className="info-row__label">URL aplicație</span>
              <span className="info-row__value" style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>
                {config.appUrl || "—"}
              </span>
            </div>
          </div>
        ) : (
          <p style={{ color: "#9ca3af", fontSize: "0.875rem" }}>Nu s-a putut încărca configurarea.</p>
        )}
        <p className="spv-card__note" style={{ marginTop: "1rem" }}>
          Aceste valori sunt setate în variabilele de mediu ale serverului.
          Editează fișierul <code>.env</code> pentru a le modifica.
        </p>
      </div>

      <div className="spv-card">
        <p className="spv-card__label">Variabile de mediu necesare</p>
        <div className="info-list">
          {[
            ["SPV_CLIENT_ID",     "ID-ul clientului OAuth înregistrat la ANAF"],
            ["SPV_CLIENT_SECRET", "Secretul clientului OAuth"],
            ["SPV_AUTH_URL",      "URL-ul de autorizare ANAF"],
            ["SPV_TOKEN_URL",     "URL-ul de obținere token"],
            ["SPV_REDIRECT_URI",  "URI-ul de redirect (trebuie înregistrat la ANAF)"],
            ["SPV_SCOPE",         "Scopul OAuth (implicit: efactura)"],
          ].map(([key, desc]) => (
            <div className="info-row" key={key}>
              <span className="info-row__label" style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#a78bfa" }}>
                {key}
              </span>
              <span className="info-row__value" style={{ fontSize: "0.75rem" }}>{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
