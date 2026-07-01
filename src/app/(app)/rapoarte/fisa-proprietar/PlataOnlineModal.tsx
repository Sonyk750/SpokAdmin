"use client";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

const CardPaymentForm = dynamic(() => import("@/app/components/CardPaymentForm"), { ssr: false });

interface Pozitie {
  tip: string;
  denumire: string;
  suma: number;
  fondId?: string;
}

interface SoldData {
  numar: string;
  restantaIntretinere: number;
  intretinereCurenta: number;
  fonduri: { id: string; name: string; restanta: number }[];
}

interface Props {
  apartamentId: string;
  asociatieId: string;
  numarAp: string;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = "loading" | "summary" | "payment" | "success";

function buildPozitii(sold: SoldData): Pozitie[] {
  const poz: Pozitie[] = [];
  if (sold.restantaIntretinere > 0.005)
    poz.push({ tip: "intretinere", denumire: "Restanță întreținere", suma: Math.round(sold.restantaIntretinere * 100) / 100 });
  if (sold.intretinereCurenta > 0.005)
    poz.push({ tip: "intretinere_curenta", denumire: "Întreținere curentă", suma: Math.round(sold.intretinereCurenta * 100) / 100 });
  for (const f of sold.fonduri) {
    if (f.restanta > 0.005)
      poz.push({ tip: "fond", denumire: `Fond ${f.name}`, suma: Math.round(f.restanta * 100) / 100, fondId: f.id });
  }
  return poz;
}

export default function PlataOnlineModal({ apartamentId, asociatieId, numarAp, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>("loading");
  const [pozitii, setPozitii] = useState<Pozitie[]>([]);
  const [clientSecret, setClientSecret] = useState("");
  const [error, setError] = useState("");

  const suma = pozitii.reduce((s, p) => s + p.suma, 0);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({ apartamentId, asociatieId });
    fetch(`/api/incasari/sold-curent?${params}`)
      .then(r => r.json())
      .then((data: SoldData) => {
        const poz = buildPozitii(data);
        if (poz.length === 0) { setError("Nu există sume de plată pentru acest apartament."); setStep("summary"); return; }
        setPozitii(poz);
        setStep("summary");
      })
      .catch(() => { setError("Eroare la încărcarea soldului. Încearcă din nou."); setStep("summary"); });
  }, [apartamentId, asociatieId]);

  async function handleProceed() {
    setError("");
    setStep("loading");
    try {
      const res = await fetch("/api/proprietar/plata/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apartamentId, asociatieId, pozitii }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Eroare la inițializarea plății"); setStep("summary"); return; }
      setClientSecret(data.clientSecret);
      setStep("payment");
    } catch {
      setError("Eroare de rețea. Încearcă din nou.");
      setStep("summary");
    }
  }

  function handlePaymentSuccess() {
    setStep("success");
    setTimeout(() => { onSuccess(); onClose(); }, 3000);
  }

  return (
    <>
      <div
        onClick={step !== "payment" ? onClose : undefined}
        style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)" }}
      />
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 201, width: "min(480px, 95vw)",
        background: "#0d1117", border: "1px solid rgba(124,58,237,0.3)",
        borderRadius: "1.5rem",
        boxShadow: "0 24px 80px rgba(0,0,0,0.7), 0 0 60px rgba(124,58,237,0.15)",
        overflow: "hidden", maxHeight: "90vh", overflowY: "auto",
      }}>
        {/* Header */}
        <div style={{
          padding: "1.5rem 1.75rem",
          background: "linear-gradient(135deg, rgba(124,58,237,0.12), rgba(6,182,212,0.04))",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        }}>
          <div>
            <p style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#a78bfa", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "0.375rem" }}>
              Plată online
            </p>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#fff", margin: 0 }}>
              Cota întreținere · Ap. {numarAp}
            </h2>
          </div>
          {step !== "payment" && (
            <button onClick={onClose} style={{
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              color: "#9ca3af", width: "2rem", height: "2rem", borderRadius: "0.5rem",
              cursor: "pointer", fontSize: "1.125rem", display: "flex", alignItems: "center", justifyContent: "center",
            }}>×</button>
          )}
        </div>

        <div style={{ padding: "1.75rem" }}>

          {step === "loading" && (
            <div style={{ textAlign: "center", padding: "2rem 0", color: "#9ca3af" }}>
              <div style={{ fontSize: "2rem", marginBottom: "0.75rem", animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</div>
              <p>Se încarcă soldul...</p>
              <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
            </div>
          )}

          {step === "summary" && (
            <>
              {pozitii.length > 0 && (
                <>
                  <p style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#6b7280", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "0.75rem" }}>
                    Detaliu plată
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.25rem" }}>
                    {pozitii.map((p, i) => (
                      <div key={i} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
                        borderRadius: "0.75rem", padding: "0.75rem 1rem",
                      }}>
                        <span style={{ fontSize: "0.875rem", color: "#d1d5db" }}>{p.denumire}</span>
                        <span style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#fff" }}>{p.suma.toFixed(2)} lei</span>
                      </div>
                    ))}
                  </div>

                  <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.25)",
                    borderRadius: "0.75rem", padding: "1rem 1.25rem", marginBottom: "1.5rem",
                  }}>
                    <span style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#d1d5db" }}>Total de plată</span>
                    <span style={{ fontSize: "1.5rem", fontWeight: 800, color: "#a78bfa" }}>{suma.toFixed(2)} lei</span>
                  </div>
                </>
              )}

              <div style={{
                display: "flex", gap: "0.625rem", alignItems: "flex-start",
                background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.15)",
                borderRadius: "0.75rem", padding: "0.875rem 1rem", marginBottom: "1.5rem",
              }}>
                <span style={{ fontSize: "1rem", flexShrink: 0 }}>🔒</span>
                <p style={{ fontSize: "0.8125rem", color: "#9ca3af", lineHeight: 1.5, margin: 0 }}>
                  Plata este procesată securizat prin <strong style={{ color: "#d1d5db" }}>Stripe</strong>. Datele cardului nu sunt stocate pe serverele noastre.
                </p>
              </div>

              {error && (
                <p style={{ padding: "0.75rem 1rem", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: "0.75rem", color: "#f87171", fontSize: "0.875rem", marginBottom: "1rem" }}>
                  {error}
                </p>
              )}

              {pozitii.length > 0 && (
                <button
                  onClick={handleProceed}
                  style={{
                    width: "100%", padding: "1rem", background: "#7c3aed",
                    color: "#fff", border: "none", borderRadius: "0.75rem",
                    fontSize: "1rem", fontWeight: 700, cursor: "pointer",
                    boxShadow: "0 0 24px rgba(124,58,237,0.4)", transition: "background 0.2s",
                  }}
                >
                  Continuă către plată →
                </button>
              )}
            </>
          )}

          {step === "payment" && clientSecret && (
            <>
              <p style={{ fontSize: "0.8125rem", color: "#9ca3af", marginBottom: "1.25rem", textAlign: "center" }}>
                Introdu datele cardului pentru a finaliza plata de{" "}
                <strong style={{ color: "#fff" }}>{suma.toFixed(2)} lei</strong>
              </p>
              <CardPaymentForm
                clientSecret={clientSecret}
                onSuccess={handlePaymentSuccess}
                onCancel={onClose}
                suma={suma}
              />
            </>
          )}

          {step === "success" && (
            <div style={{ textAlign: "center", padding: "2rem 0" }}>
              <div style={{
                width: "4rem", height: "4rem", borderRadius: "50%",
                background: "rgba(34,197,94,0.15)", border: "2px solid #22c55e",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 1.25rem", fontSize: "1.75rem",
              }}>✓</div>
              <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#fff", marginBottom: "0.5rem" }}>Plată confirmată!</h3>
              <p style={{ color: "#9ca3af", fontSize: "0.9375rem", lineHeight: 1.6 }}>
                Plata de <strong style={{ color: "#4ade80" }}>{suma.toFixed(2)} lei</strong> a fost procesată cu succes.
                <br />Contul tău a fost actualizat.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
