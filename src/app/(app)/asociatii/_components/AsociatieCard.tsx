"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  asociatie: {
    id: string;
    name: string;
    address: string | null;
    city: string;
    sector: string | null;
    cui: string | null;
    adminName: string | null;
    wizardStep: number;
    nrApartamente: number;
  };
  nrAp: number;
}

export default function AsociatieCard({ asociatie: a, nrAp }: Props) {
  const router = useRouter();
  const [confirm,  setConfirm]  = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isConfigured = a.wizardStep >= 5;
  const adresa = [a.address, a.sector ? `Sector ${a.sector}` : null, a.city].filter(Boolean).join(", ");

  async function handleDelete() {
    if (!confirm) { setConfirm(true); return; }
    setDeleting(true);
    try {
      const res = await fetch(`/api/asociatii/${a.id}`, { method: "DELETE" });
      if (res.ok) { router.refresh(); }
    } finally {
      setDeleting(false);
      setConfirm(false);
    }
  }

  return (
    <div className="asoc-card">
      <div className="asoc-card__top">
        <div className="asoc-card__icon">🏢</div>
        {!isConfigured && (
          <span className="asoc-card__badge asoc-card__badge--warn">Configurare incompletă</span>
        )}
      </div>

      <h3 className="asoc-card__name">{a.name}</h3>
      {adresa && <p className="asoc-card__addr">{adresa}</p>}
      {a.cui && <p className="asoc-card__cui">CUI: {a.cui}</p>}

      <div className="asoc-card__stats">
        <div className="asoc-card__stat">
          <span className="asoc-card__stat-val">{nrAp || a.nrApartamente}</span>
          <span className="asoc-card__stat-label">Apartamente</span>
        </div>
        {a.adminName && (
          <div className="asoc-card__stat">
            <span className="asoc-card__stat-val" style={{ fontSize: "0.75rem" }}>{a.adminName}</span>
            <span className="asoc-card__stat-label">Administrator</span>
          </div>
        )}
      </div>

      {confirm && (
        <p style={{ fontSize: "0.8rem", color: "#f87171", marginBottom: "0.5rem", textAlign: "center" }}>
          Ești sigur? Toate datele asociației vor fi șterse permanent.
        </p>
      )}

      <div className="asoc-card__actions">
        <Link href={`/asociatii/${a.id}`} className="btn btn--primary" style={{ flex: 1, justifyContent: "center" }}>
          Deschide
        </Link>
        <button
          type="button"
          className={`btn ${confirm ? "btn--danger" : "btn--secondary"}`}
          style={{ padding: "0.625rem 0.875rem", fontSize: "0.8125rem" }}
          onClick={handleDelete}
          disabled={deleting}
          title={confirm ? "Click din nou pentru confirmare" : "Șterge asociația"}
        >
          {deleting ? "..." : confirm ? "Confirmă" : "Șterge"}
        </button>
      </div>

      {confirm && (
        <button
          type="button"
          className="btn btn--secondary"
          style={{ width: "100%", marginTop: "0.375rem", fontSize: "0.8125rem", padding: "0.375rem" }}
          onClick={() => setConfirm(false)}
        >
          Anulează
        </button>
      )}
    </div>
  );
}
