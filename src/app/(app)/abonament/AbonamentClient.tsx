"use client";
import { useState } from "react";
import { SPOK_PLANS, type SpokPlan } from "@/lib/billing";

interface OrgInfo {
  plan: string;
  subscriptionStatus: string | null;
  currentPeriodEnd: Date | null;
  stripeSubscriptionId: string | null;
}

const PLAN_FEATURES: Record<string, string[]> = {
  start:    ["Pana la 20 de apartamente", "Liste de plata & intretinere", "Registru fond rulment", "Platforma proprietari", "Suport email"],
  standard: ["Tot ce include Start", "Contabilitate & registre complete", "Incasari & plati online", "Rapoarte complete + export PDF", "Suport prioritar"],
  pro:      ["Tot ce include Standard", "e-Factura ANAF (SPV)", "Salarizare & declaratii", "Asistent AI inclus", "Contoare & repartizare consum"],
};

const PLAN_LABEL: Record<string, { color: string; border: string; bg: string }> = {
  start:    { color: "#67e8f9", border: "rgba(6,182,212,0.3)",  bg: "rgba(6,182,212,0.07)"  },
  standard: { color: "#a78bfa", border: "rgba(124,58,237,0.3)", bg: "rgba(124,58,237,0.08)" },
  pro:      { color: "#a78bfa", border: "rgba(124,58,237,0.4)", bg: "rgba(124,58,237,0.12)" },
};

function fmtDate(d: Date | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("ro-RO", { day: "2-digit", month: "long", year: "numeric" });
}

export default function AbonamentClient({ org }: { org: OrgInfo | null }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError]     = useState("");

  const currentPlan = (org?.plan ?? "start") as SpokPlan | "starter";
  const normalizedPlan: SpokPlan = currentPlan === "starter" ? "start" : currentPlan as SpokPlan;
  const isActive = org?.subscriptionStatus === "active" || normalizedPlan === "start";
  const style = PLAN_LABEL[normalizedPlan] ?? PLAN_LABEL.start;

  async function handleUpgrade(plan: SpokPlan) {
    setLoading(plan); setError("");
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) { window.location.href = data.url; return; }
      setError(data.error || "Eroare la initializarea platii");
    } catch { setError("Eroare de retea. Incearca din nou."); }
    finally { setLoading(null); }
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">Abonament</h1>
          <p className="page-sub">Gestioneaza planul si facturarea organizatiei tale</p>
        </div>
      </div>

      {/* Current plan card */}
      <div style={{ margin: "0 1.5rem 2rem", background: style.bg, border: `1px solid ${style.border}`, borderRadius: "1.25rem", padding: "1.75rem 2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: "#6b7280", marginBottom: "0.5rem" }}>
              Plan curent
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
              <span style={{ fontSize: "1.75rem", fontWeight: 800, color: style.color }}>
                {SPOK_PLANS[normalizedPlan]?.name ?? normalizedPlan}
              </span>
              <span style={{
                fontSize: "0.6875rem", fontWeight: 700, padding: "0.25rem 0.75rem",
                borderRadius: "9999px", border: `1px solid ${style.border}`, color: style.color,
                background: style.bg, textTransform: "uppercase", letterSpacing: "0.1em",
              }}>
                {isActive ? "Activ" : (org?.subscriptionStatus ?? "Inactiv")}
              </span>
            </div>
            {org?.currentPeriodEnd && (
              <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#9ca3af" }}>
                {org.subscriptionStatus === "canceled" ? "Activ pana la" : "Reinnoire"}: <strong style={{ color: "#d1d5db" }}>{fmtDate(org.currentPeriodEnd)}</strong>
              </p>
            )}
          </div>
          {normalizedPlan !== "start" && (
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: "2rem", fontWeight: 800, color: "#fff" }}>
                {SPOK_PLANS[normalizedPlan]?.priceRon} <span style={{ fontSize: "1rem", fontWeight: 400, color: "#6b7280" }}>lei/luna</span>
              </p>
            </div>
          )}
        </div>

        <div style={{ marginTop: "1.25rem", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {(PLAN_FEATURES[normalizedPlan] ?? []).map(f => (
            <span key={f} style={{ fontSize: "0.8125rem", color: "#9ca3af", display: "flex", alignItems: "center", gap: "0.375rem" }}>
              <span style={{ color: style.color, fontWeight: 700 }}>✓</span> {f}
            </span>
          ))}
        </div>
      </div>

      {error && (
        <div className="wizard__error" style={{ margin: "0 1.5rem 1rem" }}>{error}</div>
      )}

      {/* Upgrade cards */}
      {(["standard", "pro"] as SpokPlan[])
        .filter(p => p !== normalizedPlan)
        .map(plan => {
          const info = SPOK_PLANS[plan];
          const s = PLAN_LABEL[plan];
          const isHigher = (plan === "pro" && normalizedPlan === "standard") || (plan === "standard" && normalizedPlan === "start");
          return (
            <div key={plan} style={{ margin: "0 1.5rem 1rem", background: s.bg, border: `1px solid ${s.border}`, borderRadius: "1.25rem", padding: "1.75rem 2rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1.5rem" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.625rem" }}>
                  <span style={{ fontSize: "1.25rem", fontWeight: 800, color: s.color }}>{info.name}</span>
                  {isHigher && plan === "pro" && (
                    <span style={{ fontSize: "0.625rem", fontWeight: 700, padding: "0.2rem 0.625rem", borderRadius: "9999px", background: "rgba(124,58,237,0.3)", border: "1px solid rgba(167,139,250,0.4)", color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.1em" }}>Recomandat</span>
                  )}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {(PLAN_FEATURES[plan] ?? []).slice(0, 3).map(f => (
                    <span key={f} style={{ fontSize: "0.8125rem", color: "#9ca3af" }}>
                      <span style={{ color: s.color, fontWeight: 700 }}>✓</span> {f}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.75rem" }}>
                <p style={{ fontSize: "1.5rem", fontWeight: 800, color: "#fff", margin: 0 }}>
                  {info.priceRon} <span style={{ fontSize: "0.875rem", fontWeight: 400, color: "#6b7280" }}>lei/luna</span>
                </p>
                <button
                  onClick={() => handleUpgrade(plan)}
                  disabled={loading === plan}
                  style={{
                    padding: "0.75rem 1.75rem", background: loading === plan ? "rgba(124,58,237,0.5)" : "#7c3aed",
                    color: "#fff", border: "none", borderRadius: "0.75rem",
                    fontSize: "0.9375rem", fontWeight: 700, cursor: loading === plan ? "not-allowed" : "pointer",
                    boxShadow: "0 0 20px rgba(124,58,237,0.35)", whiteSpace: "nowrap",
                  }}
                >
                  {loading === plan ? "Se redirectioneaza..." : `Treci la ${info.name} →`}
                </button>
              </div>
            </div>
          );
        })}

      <div style={{ margin: "0 1.5rem", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "1.25rem", padding: "1.5rem 2rem" }}>
        <p style={{ fontSize: "0.875rem", color: "#6b7280", lineHeight: 1.7 }}>
          Pentru planul <strong style={{ color: "#d1d5db" }}>Enterprise</strong> (apartamente nelimitate, API, SLA dedicat) contacteaza-ne la{" "}
          <a href="mailto:office@spokadmin.ro" style={{ color: "#a78bfa" }}>office@spokadmin.ro</a> sau{" "}
          <a href="tel:+40756362828" style={{ color: "#a78bfa" }}>0756 362 828</a>.
        </p>
      </div>
    </div>
  );
}
