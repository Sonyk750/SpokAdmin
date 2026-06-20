import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

export default async function AsociatieDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  const a = await db.asociatie.findFirst({
    where: { id, organizationId: session.user.organizationId },
    include: {
      apartamente: {
        where:   { isActive: true },
        include: {
          proprietari: { include: { proprietar: true }, take: 1 },
          solduri:     true,
        },
        orderBy: { numar: "asc" },
      },
      fonduri: { where: { isEnabled: true }, orderBy: { sortOrder: "asc" } },
    },
  });

  if (!a) notFound();

  const totalRestante = a.apartamente.reduce((s, ap) => s + (ap.solduri[0]?.restantaIntretinere ?? 0), 0);
  const nrCuRestante  = a.apartamente.filter(ap => (ap.solduri[0]?.restantaIntretinere ?? 0) > 0).length;
  const adresa = [a.address, a.sector ? `Sector ${a.sector}` : null, a.city].filter(Boolean).join(", ");

  return (
    <div className="page-shell">
      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.25rem" }}>
            <Link href="/asociatii" className="back-link">← Asociații</Link>
          </div>
          <h1 className="page-title">{a.name}</h1>
          {adresa && <p className="page-sub">{adresa}</p>}
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <Link href={`/asociatii/${a.id}/apartamente`} className="btn btn--secondary">Apartamente</Link>
          <Link href={`/asociatii/${a.id}/setari`}      className="btn btn--secondary">⚙ Setări</Link>
        </div>
      </div>

      {/* KPI-uri */}
      <div className="kpi-grid" style={{ marginBottom: "1.5rem" }}>
        <div className="kpi-card kpi-card--violet">
          <span className="kpi-card__icon">🏠</span>
          <div className="kpi-card__value">{a.apartamente.length}</div>
          <div className="kpi-card__label">Apartamente</div>
        </div>
        <div className="kpi-card kpi-card--cyan">
          <span className="kpi-card__icon">💳</span>
          <div className="kpi-card__value">{nrCuRestante}</div>
          <div className="kpi-card__label">Cu restanțe</div>
        </div>
        <div className="kpi-card kpi-card--violet">
          <span className="kpi-card__icon">💰</span>
          <div className="kpi-card__value">{totalRestante.toFixed(2)}</div>
          <div className="kpi-card__label">Total restanțe (lei)</div>
        </div>
        <div className="kpi-card kpi-card--cyan">
          <span className="kpi-card__icon">📁</span>
          <div className="kpi-card__value">{a.fonduri.length}</div>
          <div className="kpi-card__label">Fonduri active</div>
        </div>
      </div>

      {/* Info + Apartamente */}
      <div className="dash__grid">
        {/* Info asociație */}
        <div className="dash-panel">
          <div className="dash-panel__title">Informații asociație</div>
          <div className="info-list">
            {a.cui          && <InfoRow label="CUI"           value={a.cui} />}
            {a.adminName    && <InfoRow label="Administrator" value={a.adminName} />}
            {a.presedinteName && <InfoRow label="Președinte"  value={a.presedinteName} />}
            {a.cenzorName   && <InfoRow label="Cenzor"        value={a.cenzorName} />}
            {a.bank         && <InfoRow label="Bancă"         value={a.bank} />}
            {a.iban         && <InfoRow label="IBAN"          value={a.iban} />}
            {a.phone        && <InfoRow label="Telefon"       value={a.phone} />}
            {a.email        && <InfoRow label="Email"         value={a.email} />}
          </div>
          <Link href={`/asociatii/${a.id}/initializare`} className="btn btn--secondary btn--full" style={{ marginTop: "1rem" }}>
            {a.wizardData ? "✎ Modifică inițializarea" : "🧙 Pornește inițializarea"}
          </Link>
        </div>

        {/* Lista apartamente */}
        <div className="dash-panel">
          <div className="dash-panel__title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Apartamente ({a.apartamente.length})</span>
            <Link href={`/asociatii/${a.id}/apartamente`} style={{ fontSize: "0.75rem", color: "#a78bfa" }}>
              Vezi toate →
            </Link>
          </div>

          {a.apartamente.length === 0 ? (
            <div className="dash-panel__empty">
              Niciun apartament adăugat.<br />
              <Link href={`/asociatii/${a.id}/initializare`} style={{ color: "#a78bfa" }}>Pornește inițializarea</Link>
            </div>
          ) : (
            <div className="ap-list">
              {a.apartamente.slice(0, 15).map(ap => {
                const prop = ap.proprietari[0]?.proprietar;
                const rest = ap.solduri[0]?.restantaIntretinere ?? 0;
                return (
                  <div key={ap.id} className="ap-row">
                    <span className="ap-row__nr">Ap. {ap.numar}</span>
                    <span className="ap-row__prop">{prop ? `${prop.nume}${prop.prenume ? " " + prop.prenume : ""}` : "—"}</span>
                    <span className={`ap-row__rest${rest > 0 ? " ap-row__rest--red" : ""}`}>
                      {rest > 0 ? `${rest.toFixed(2)} lei` : "—"}
                    </span>
                  </div>
                );
              })}
              {a.apartamente.length > 15 && (
                <Link href={`/asociatii/${a.id}/apartamente`} className="ap-list__more">
                  +{a.apartamente.length - 15} mai multe →
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-row">
      <span className="info-row__label">{label}</span>
      <span className="info-row__value">{value}</span>
    </div>
  );
}
