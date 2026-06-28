"use client";

import { useState } from "react";

interface Bar { label: string; value: number; }
interface Tab { key: string; label: string; unit: string; bars: Bar[]; }

const COLORS = ["#a78bfa", "#4ade80", "#f87171", "#fbbf24", "#22d3ee", "#f472b6"];
const POS_H  = 150; // înălțimea zonei pozitive (px)
const NEG_H  = 100; // înălțimea zonei negative (px)

export default function DashboardCharts({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(tabs[0]?.key ?? "");
  const tab = tabs.find(t => t.key === active) ?? tabs[0];
  if (!tab) return null;

  // Tab fonduri: toate barele, rest: max 6
  const bars = tab.key === "fonduri" ? tab.bars : tab.bars.slice(0, 6);

  const hasNeg  = bars.some(b => b.value < 0);
  const posVals = bars.filter(b => b.value > 0).map(b => b.value);
  const negVals = bars.filter(b => b.value < 0).map(b => Math.abs(b.value));
  const posMax  = posVals.length ? Math.max(...posVals) : 1;
  const negMax  = negVals.length ? Math.max(...negVals) : 1;

  const fmt = (v: number) => tab.unit === "lei"
    ? v.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : v.toLocaleString("ro-RO");

  return (
    <div className="dash-panel" style={{ marginBottom: "1.5rem", padding: "1.25rem 1.5rem" }}>
      {/* Taburi */}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.75rem" }}>
        {tabs.map(t => (
          <button key={t.key} type="button" onClick={() => setActive(t.key)}
            className={`contur-tab${t.key === active ? " contur-tab--active" : ""}`}>
            {t.label}
          </button>
        ))}
      </div>

      {bars.length === 0 ? (
        <div className="dash-panel__empty">Nicio dată disponibilă pentru această secțiune.</div>
      ) : hasNeg ? (
        /* ── Grafic bidirecțional (pozitive sus, negative jos) ────────────── */
        <div style={{ overflowX: "auto", paddingBottom: "0.5rem" }}>
          <div style={{
            display: "flex", alignItems: "stretch", gap: "0.4rem",
            minWidth: "100%",
          }}>
            {bars.map((b, i) => {
              const isNeg  = b.value < 0;
              const color  = isNeg ? "#f87171" : COLORS[i % COLORS.length];
              const posH   = !isNeg ? Math.max(4, Math.round((b.value / posMax) * POS_H)) : 0;
              const negH   = isNeg  ? Math.max(4, Math.round((Math.abs(b.value) / negMax) * NEG_H)) : 0;

              return (
                <div key={b.label + i} style={{
                  flex: 1,
                  minWidth: 55,
                  display: "flex", flexDirection: "column", alignItems: "center",
                }}>
                  {/* Label valoare deasupra (bara pozitivă) */}
                  <div style={{ height: 22, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                    {!isNeg && (
                      <span style={{ fontSize: "0.68rem", fontWeight: 800, color, whiteSpace: "nowrap" }}>
                        {fmt(b.value)}
                      </span>
                    )}
                  </div>

                  {/* Zona pozitivă — bară crește de jos */}
                  <div style={{ height: POS_H, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", width: "100%" }}>
                    {!isNeg && (
                      <div style={{
                        width: "80%", maxWidth: 52, height: posH,
                        background: `linear-gradient(180deg, ${color}, ${color}88)`,
                        borderRadius: "6px 6px 0 0",
                      }} />
                    )}
                  </div>

                  {/* Linie de bază */}
                  <div style={{ width: "100%", height: 2, background: "#334155", flexShrink: 0 }} />

                  {/* Zona negativă — bară crește în jos */}
                  <div style={{ height: NEG_H, display: "flex", flexDirection: "column", justifyContent: "flex-start", alignItems: "center", width: "100%" }}>
                    {isNeg && (
                      <div style={{
                        width: "80%", maxWidth: 52, height: negH,
                        background: "linear-gradient(180deg, #f8717188, #f87171)",
                        borderRadius: "0 0 6px 6px",
                      }} />
                    )}
                  </div>

                  {/* Label valoare dedesubt (bara negativă) */}
                  <div style={{ height: 22, display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
                    {isNeg && (
                      <span style={{ fontSize: "0.68rem", fontWeight: 800, color: "#f87171", whiteSpace: "nowrap" }}>
                        −{fmt(Math.abs(b.value))}
                      </span>
                    )}
                  </div>

                  {/* Eticheta coloanei */}
                  <span style={{
                    fontSize: "0.62rem", color: "#94a3b8", marginTop: "0.3rem",
                    textAlign: "center", lineHeight: 1.2,
                    maxWidth: 70, wordBreak: "break-word",
                  }}>
                    {b.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ── Grafic normal (doar pozitive) ───────────────────────────────── */
        <div style={{
          display: "flex", alignItems: "flex-end",
          gap: "0.5rem", minHeight: POS_H + 64,
          overflowX: "auto",
        }}>
          {bars.map((b, i) => {
            const color = COLORS[i % COLORS.length];
            const barPx = Math.max(Math.round((b.value / posMax) * POS_H), 4);
            return (
              <div key={b.label + i} style={{
                flex: 1,
                minWidth: 55, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "flex-end",
              }}>
                <span style={{ fontSize: "0.72rem", fontWeight: 800, color, marginBottom: "0.4rem", whiteSpace: "nowrap" }}>
                  {fmt(b.value)}
                </span>
                <div style={{
                  width: "100%", maxWidth: 70, height: barPx,
                  background: `linear-gradient(180deg, ${color}, ${color}88)`,
                  borderRadius: "7px 7px 0 0",
                }} />
                <span style={{
                  fontSize: "0.65rem", color: "#94a3b8", marginTop: "0.55rem",
                  textAlign: "center", lineHeight: 1.2, maxWidth: 72, wordBreak: "break-word",
                }}>
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
