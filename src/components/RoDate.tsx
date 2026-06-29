"use client";

import { useState, useEffect } from "react";

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

/**
 * Câmp de dată în format românesc (zz/ll/aaaa) — afișaj consecvent indiferent de
 * localizarea browserului, spre deosebire de <input type="date"> nativ.
 * `value`/`onChange` lucrează tot cu ISO (yyyy-mm-dd), deci e drop-in pentru inputurile native.
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (roToIso(txt) !== value) setTxt(isoToRo(value)); }, [value]);
  return (
    <input
      type="text" inputMode="numeric" className={className} placeholder={placeholder}
      value={txt} maxLength={10} disabled={disabled} style={style}
      onChange={e => {
        const v = e.target.value;
        setTxt(v);
        const iso = roToIso(v);
        if (iso) onChange(iso);
        else if (!v.trim()) onChange("");
      }}
    />
  );
}
