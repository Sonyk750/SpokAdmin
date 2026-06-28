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

  // Tab fonduri poate avea mai multe bare; restul limitat la 6
  const bars = tab.key === "fonduri" ? tab.bars : tab.bars.slice(0, 6);
  const absMax = Math.max(1, ...bars.map(b => Math.abs(b.value)));
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
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-around", gap: "0.5rem", minHeight: MAXBAR + 64, overflowX: bars.length > 6 ? "auto" : "visible" }}>
          {bars.map((b, i) => {
            const neg   = b.value < 0;
            const color = neg ? "#f87171" : COLORS[i % COLORS.length];
            const barPx = Math.max(Math.round((Math.abs(b.value) / absMax) * MAXBAR), 4);
            return (
              <div key={b.label + i} style={{ flex: "0 0 auto", minWidth: bars.length > 6 ? 64 : 0, width: bars.length > 6 ? 72 : undefined, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
                <span style={{ fontSize: "0.72rem", fontWeight: 800, color, marginBottom: "0.4rem", whiteSpace: "nowrap" }}>
                  {neg ? "−" : ""}{fmt(Math.abs(b.value))}
                </span>
                <div style={{
                  width: "100%", maxWidth: 70, height: barPx,
                  background: neg
                    ? `linear-gradient(180deg, #f87171, #f8717188)`
                    : `linear-gradient(180deg, ${color}, ${color}88)`,
                  borderRadius: "7px 7px 0 0",
                  opacity: neg ? 0.85 : 1,
                }} />
                <span style={{ fontSize: "0.65rem", color: "#94a3b8", marginTop: "0.55rem", textAlign: "center", lineHeight: 1.2, maxWidth: 72, wordBreak: "break-word" }}>
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
