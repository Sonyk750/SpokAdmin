"use client";

import { useState } from "react";

interface Bar { label: string; value: number; }
interface Tab { key: string; label: string; unit: string; bars: Bar[]; }

const COLORS = ["#a78bfa", "#4ade80", "#f87171", "#fbbf24", "#22d3ee", "#f472b6"];
const MAXBAR = 180; // înălțimea maximă a unei bare (px)

export default function DashboardCharts({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(tabs[0]?.key ?? "");
  const tab = tabs.find(t => t.key === active) ?? tabs[0];
  if (!tab) return null;

  const bars = tab.bars.slice(0, 6);
  const max  = Math.max(1, ...bars.map(b => b.value));
  const fmt  = (v: number) => tab.unit === "lei"
    ? v.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : v.toLocaleString("ro-RO");

  return (
    <div className="dash-panel" style={{ marginBottom: "1.5rem", padding: "1.25rem 1.5rem" }}>
      {/* Taburi */}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.75rem" }}>
        {tabs.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActive(t.key)}
            className={`contur-tab${t.key === active ? " contur-tab--active" : ""}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Grafic bare */}
      {bars.length === 0 ? (
        <div className="dash-panel__empty">Nicio dată disponibilă pentru această secțiune.</div>
      ) : (
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-around", gap: "0.75rem", minHeight: MAXBAR + 64 }}>
          {bars.map((b, i) => {
            const color = COLORS[i % COLORS.length];
            const barPx = b.value > 0 ? Math.round((b.value / max) * MAXBAR) : 0;
            return (
              <div key={b.label + i} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
                <span style={{ fontSize: "0.78rem", fontWeight: 800, color, marginBottom: "0.4rem", whiteSpace: "nowrap" }}>
                  {fmt(b.value)}
                </span>
                <div style={{
                  width: "100%", maxWidth: 70, height: Math.max(barPx, 3),
                  background: `linear-gradient(180deg, ${color}, ${color}88)`,
                  borderRadius: "7px 7px 0 0",
                }} />
                <span style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: "0.55rem", textAlign: "center", lineHeight: 1.2 }}>
                  {b.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <p style={{ fontSize: "0.7rem", color: "#64748b", marginTop: "1rem", textAlign: "right" }}>
        {tab.unit === "lei" ? "valori în lei" : "număr"}
      </p>
    </div>
  );
}
