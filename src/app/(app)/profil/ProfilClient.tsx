"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ProfilClient() {
  const router = useRouter();

  const [email, setEmail]       = useState("");
  const [hasPassword, setHasPw] = useState(false);
  const [loading, setLoading]   = useState(true);

  const [name, setName]               = useState("");
  const [currentPassword, setCurPw]   = useState("");
  const [newPassword, setNewPw]       = useState("");
  const [confirmPassword, setConfPw]  = useState("");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg]       = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/profil")
      .then(r => r.json())
      .then(d => {
        setName(d.name ?? "");
        setEmail(d.email ?? "");
        setHasPw(!!d.hasPassword);
      })
      .catch(() => setMsg({ type: "err", text: "Nu am putut încărca datele contului." }))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setMsg(null);
    if (!name.trim()) return setMsg({ type: "err", text: "Numele nu poate fi gol." });
    if (newPassword || confirmPassword) {
      if (newPassword.length < 6) return setMsg({ type: "err", text: "Parola nouă trebuie să aibă minim 6 caractere." });
      if (newPassword !== confirmPassword) return setMsg({ type: "err", text: "Parolele nu coincid." });
      if (hasPassword && !currentPassword) return setMsg({ type: "err", text: "Introdu parola actuală." });
    }

    setSaving(true);
    try {
      const res = await fetch("/api/profil", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          ...(newPassword ? { currentPassword, newPassword } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Eroare server");
      setMsg({ type: "ok", text: "Modificările au fost salvate." });
      setCurPw(""); setNewPw(""); setConfPw("");
      router.refresh(); // actualizează numele din antet
    } catch (e: any) {
      setMsg({ type: "err", text: e.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">Profil</h1>
          <p className="page-sub">Numele afișat în aplicație și parola contului</p>
        </div>
      </div>

      {loading ? (
        <div style={{ color: "#475569", padding: "2rem" }}>Se încarcă...</div>
      ) : (
        <div style={{ maxWidth: "520px" }}>
          <div className="form-grid">
            <div className="form-field form-field--full">
              <label className="form-field__label">Nume afișat *</label>
              <input type="text" className="input" value={name} onChange={e => setName(e.target.value)} placeholder="ex: Octav Ene" />
              <span style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>
                Acesta apare în colțul dreapta-sus al aplicației.
              </span>
            </div>

            <div className="form-field form-field--full">
              <label className="form-field__label">Email (autentificare)</label>
              <input type="email" className="input" value={email} disabled style={{ opacity: 0.6, cursor: "not-allowed" }} />
            </div>
          </div>

          <div style={{ borderTop: "1px solid #1e293b", margin: "1.5rem 0 1.25rem" }} />

          <div className="form-field__label" style={{ marginBottom: "0.75rem" }}>
            Schimbă parola <span style={{ color: "#64748b", fontWeight: 400 }}>(opțional)</span>
          </div>
          <div className="form-grid">
            {hasPassword && (
              <div className="form-field form-field--full">
                <label className="form-field__label">Parola actuală</label>
                <input type="password" className="input" value={currentPassword} onChange={e => setCurPw(e.target.value)} autoComplete="current-password" />
              </div>
            )}
            <div className="form-field">
              <label className="form-field__label">Parolă nouă</label>
              <input type="password" className="input" value={newPassword} onChange={e => setNewPw(e.target.value)} autoComplete="new-password" />
            </div>
            <div className="form-field">
              <label className="form-field__label">Confirmă parola</label>
              <input type="password" className="input" value={confirmPassword} onChange={e => setConfPw(e.target.value)} autoComplete="new-password" />
            </div>
          </div>

          {msg && (
            <div className={msg.type === "err" ? "wizard__error" : ""}
              style={msg.type === "ok" ? { color: "#4ade80", marginTop: "1rem", fontWeight: 600 } : { marginTop: "1rem" }}>
              {msg.text}
            </div>
          )}

          <div style={{ marginTop: "1.5rem" }}>
            <button className="btn btn--primary" onClick={save} disabled={saving}>
              {saving ? "Se salvează..." : "Salvează"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
