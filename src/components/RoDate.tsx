"use client";

import { useState, useEffect, useRef } from "react";

/** ISO (yyyy-mm-dd) → afișaj RO (zz/ll/aaaa). */
export function isoToRo(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** Afișaj RO (zz/ll/aaaa, acceptă și . sau -) → ISO (yyyy-mm-dd), "" dacă invalid. */
export function roToIso(ro: string): string {
  const m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec((ro || "").trim());
  if (!m) return "";
  const d = +m[1], mo = +m[2], y = +m[3];
  if (d < 1 || d > 31 || mo < 1 || mo > 12) return "";
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const LUNI = [
  "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
  "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie",
];
const ZILE = ["L", "Ma", "Mi", "J", "V", "S", "D"];

/** ISO → {y, m (0-11), d}. */
function isoToParts(iso: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? { y: +m[1], m: +m[2] - 1, d: +m[3] } : null;
}

/** Construiește ISO din componente. */
function partsToIso(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Câmp de dată în format românesc (zz/ll/aaaa) cu calendar pop-up — afișaj
 * consecvent indiferent de localizarea browserului, spre deosebire de
 * <input type="date"> nativ. Se poate scrie manual SAU selecta din calendar.
 * `value`/`onChange` lucrează tot cu ISO (yyyy-mm-dd), deci e drop-in pentru
 * inputurile native.
 */
export default function RoDate({
  value, onChange, className = "input", style, disabled, placeholder = "zz/ll/aaaa",
}: {
  value: string;
  onChange: (iso: string) => void;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [txt, setTxt] = useState(() => isoToRo(value));
  const [open, setOpen] = useState(false);
  // Luna afișată în calendar (an, lună 0-11). Inițial pe valoarea curentă sau azi.
  const [view, setView] = useState(() => {
    const p = isoToParts(value);
    return p ? { y: p.y, m: p.m } : null;
  });
  const wrapRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (roToIso(txt) !== value) setTxt(isoToRo(value)); }, [value]);

  // Închide calendarul la click în afară.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const openCalendar = () => {
    if (disabled) return;
    const p = isoToParts(value);
    const now = new Date();
    setView(p ? { y: p.y, m: p.m } : { y: now.getFullYear(), m: now.getMonth() });
    setOpen(o => !o);
  };

  const pick = (d: number) => {
    if (!view) return;
    onChange(partsToIso(view.y, view.m, d));
    setOpen(false);
  };

  const prevMonth = () => setView(v => v && (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }));
  const nextMonth = () => setView(v => v && (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }));

  // Grilă zile (luni-duminică).
  const sel = isoToParts(value);
  let grid: (number | null)[] = [];
  if (view) {
    const firstDow = (new Date(view.y, view.m, 1).getDay() + 6) % 7; // 0=Luni
    const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
    grid = [
      ...Array(firstDow).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
  }

  return (
    <div ref={wrapRef} style={{ position: "relative", display: "inline-block", width: style?.width ?? "100%" }}>
      <input
        type="text" inputMode="numeric" className={className} placeholder={placeholder}
        value={txt} maxLength={10} disabled={disabled}
        style={{ ...style, width: "100%", paddingRight: "2rem" }}
        onChange={e => {
          const v = e.target.value;
          setTxt(v);
          const iso = roToIso(v);
          if (iso) onChange(iso);
          else if (!v.trim()) onChange("");
        }}
      />
      <button
        type="button"
        onClick={openCalendar}
        disabled={disabled}
        aria-label="Deschide calendar"
        tabIndex={-1}
        style={{
          position: "absolute", right: "0.4rem", top: "50%", transform: "translateY(-50%)",
          background: "none", border: "none", padding: 0, cursor: disabled ? "default" : "pointer",
          color: "#64748b", display: "flex", alignItems: "center", lineHeight: 0,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>

      {open && view && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 1000,
            background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.5rem",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)", padding: "0.6rem", width: "16rem",
          }}
        >
          {/* Antet: navigare lună */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
            <button type="button" onClick={prevMonth} style={navBtn}>‹</button>
            <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#1e293b" }}>
              {LUNI[view.m]} {view.y}
            </div>
            <button type="button" onClick={nextMonth} style={navBtn}>›</button>
          </div>

          {/* Capete zile */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "2px", marginBottom: "2px" }}>
            {ZILE.map(z => (
              <div key={z} style={{ textAlign: "center", fontSize: "0.65rem", color: "#94a3b8", fontWeight: 600, padding: "2px 0" }}>
                {z}
              </div>
            ))}
          </div>

          {/* Zile */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "2px" }}>
            {grid.map((d, i) => {
              if (d === null) return <div key={`e${i}`} />;
              const isSel = !!sel && sel.y === view.y && sel.m === view.m && sel.d === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => pick(d)}
                  style={{
                    textAlign: "center", fontSize: "0.78rem", padding: "0.3rem 0",
                    border: "none", borderRadius: "0.3rem", cursor: "pointer",
                    background: isSel ? "#2563eb" : "transparent",
                    color: isSel ? "#fff" : "#334155",
                    fontWeight: isSel ? 600 : 400,
                  }}
                  onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = "#eff6ff"; }}
                  onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = "transparent"; }}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const navBtn: React.CSSProperties = {
  background: "none", border: "1px solid #e2e8f0", borderRadius: "0.3rem",
  width: "1.6rem", height: "1.6rem", cursor: "pointer", color: "#475569",
  fontSize: "1rem", lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center",
};
