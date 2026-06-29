"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"

type SpvStatus = {
  connected:  boolean
  expired?:   boolean
  expiresAt?: string
  hasRefresh?: boolean
}

type SpvConfig = {
  redirectUri: string
  authUrl:     string
  appUrl:      string
}

export default function SpvConectareClient() {
  const searchParams = useSearchParams()

  const [status,        setStatus]        = useState<SpvStatus | null>(null)
  const [config,        setConfig]        = useState<SpvConfig | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [disconnecting, setDisconnecting] = useState(false)
  const [message,       setMessage]       = useState<{ type: "success" | "error"; text: string } | null>(null)

  useEffect(() => {
    const ok  = searchParams.get("spv_success")
    const err = searchParams.get("spv_error")
    if (ok)  setMessage({ type: "success", text: "SPV conectat cu succes!" })
    if (err) setMessage({ type: "error",   text: `Eroare conectare SPV: ${err}` })

    async function load() {
      setLoading(true)
      try {
        const [sRes, cRes] = await Promise.all([
          fetch("/api/spv/status"),
          fetch("/api/spv/config"),
        ])
        setStatus(await sRes.json())
        setConfig(await cRes.json())
      } catch {
        setStatus({ connected: false })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [searchParams])

  async function handleDisconnect() {
    if (!confirm("Ești sigur că vrei să deconectezi SPV?")) return
    setDisconnecting(true)
    try {
      await fetch("/api/spv/disconnect", { method: "POST" })
      setStatus({ connected: false })
      setMessage({ type: "success", text: "SPV deconectat." })
    } catch {
      setMessage({ type: "error", text: "Eroare la deconectare." })
    } finally {
      setDisconnecting(false)
    }
  }

  const isNgrok    = config?.redirectUri?.includes("ngrok")
  const isLocalApp = config?.appUrl?.includes("localhost")

  return (
    <div className="page-shell">

      <div className="page-header">
        <div>
          <p className="page-kicker">SPV / e-Factură</p>
          <h1 className="page-title">Conectare SPV</h1>
          <p className="page-sub">Spațiul Privat Virtual ANAF — autentificare cu certificat digital</p>
        </div>
      </div>

      {message && (
        <div className={`spv-alert spv-alert--${message.type}`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="spv-alert__close">✕</button>
        </div>
      )}

      {config && isLocalApp && isNgrok && !status?.connected && (
        <div className="spv-warn">
          <span className="spv-warn__icon">⚠️</span>
          <div>
            <p className="spv-warn__title">ngrok trebuie să ruleze pentru conectarea SPV</p>
            <p className="spv-warn__desc">
              ANAF redirectează înapoi la URL-ul înregistrat. Dacă ngrok nu rulează, conexiunea va eșua.
            </p>
            <code className="spv-warn__code">ngrok http 3000</code>
            <p className="spv-warn__uri">
              Redirect URI înregistrat: <strong>{config.redirectUri}</strong>
            </p>
          </div>
        </div>
      )}

      <div className="spv-cards">

        {/* Status card */}
        <div className="spv-card">
          <p className="spv-card__label">Status conexiune</p>
          {loading ? (
            <p className="spv-card__loading">Se verifică...</p>
          ) : status?.connected ? (
            <>
              <div className="spv-status spv-status--ok">
                <span className="spv-status__dot spv-status__dot--green" />
                <span>Conectat</span>
              </div>
              {status.expiresAt && (
                <p className="spv-card__meta">
                  Expiră: {new Date(status.expiresAt).toLocaleString("ro-RO")}
                </p>
              )}
              {status.expired && (
                <p className="spv-card__warn">⚠️ Token expirat — reconectează-te</p>
              )}
              <div className="spv-card__actions">
                <a href="/api/spv/connect" className="btn btn--primary btn--sm">
                  🔄 Reconectează
                </a>
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="btn btn--danger btn--sm"
                >
                  {disconnecting ? "..." : "Deconectează"}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="spv-status spv-status--off">
                <span className="spv-status__dot spv-status__dot--gray" />
                <span>Neconectat</span>
              </div>
              <p className="spv-card__meta">
                Conectează-te cu certificatul digital DigiSign pentru a sincroniza facturile primite prin ANAF e-Factură.
              </p>
              <a href="/api/spv/connect" className="btn btn--primary">
                🔐 Conectează SPV
              </a>
            </>
          )}
        </div>

        {/* Info card */}
        <div className="spv-card">
          <p className="spv-card__label">Cum funcționează</p>
          <div className="spv-steps">
            <div className="spv-step">
              <span className="spv-step__num">1</span>
              <span>Apasă „Conectează SPV" — vei fi redirecționat la ANAF</span>
            </div>
            <div className="spv-step">
              <span className="spv-step__num">2</span>
              <span>Autentifică-te cu certificatul digital DigiSign</span>
            </div>
            <div className="spv-step">
              <span className="spv-step__num">3</span>
              <span>Revii automat și tokenul este salvat</span>
            </div>
            <div className="spv-step">
              <span className="spv-step__num">4</span>
              <span>Sincronizează facturile primite din secțiunea „Facturi primite"</span>
            </div>
          </div>
        </div>

        {/* Scopes card */}
        <div className="spv-card">
          <p className="spv-card__label">Permisiuni solicitate</p>
          <div className="spv-perms">
            <div className="spv-perm">
              <span className="spv-perm__icon">📥</span>
              <div>
                <strong>e-Factura inbox</strong>
                <p>Citire facturi primite de la furnizori</p>
              </div>
            </div>
            <div className="spv-perm">
              <span className="spv-perm__icon">⬇️</span>
              <div>
                <strong>Descărcare XML</strong>
                <p>Descărcare fișiere ZIP cu facturile UBL</p>
              </div>
            </div>
          </div>
          <p className="spv-card__note">
            Tokenul este stocat criptat și nu este niciodată partajat cu terți.
          </p>
        </div>
      </div>
    </div>
  )
}
