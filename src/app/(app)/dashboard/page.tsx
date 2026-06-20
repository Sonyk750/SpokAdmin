import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  const orgId = session.user.organizationId;

  const [nrAsociatii, nrApartamente, nrProprietari, nrFacturiNeplatite] = await Promise.all([
    db.asociatie.count({ where: { organizationId: orgId, isActive: true } }),
    db.apartament.count({ where: { organizationId: orgId, isActive: true } }),
    db.proprietar.count({ where: { organizationId: orgId } }),
    db.factura.count({ where: { organizationId: orgId, status: "neplatita" } }),
  ]);

  // Restanțe totale
  const restante = await db.soldApartament.aggregate({
    where:  { apartament: { organizationId: orgId } },
    _sum:   { restantaIntretinere: true },
  });
  const totalRestante = restante._sum.restantaIntretinere ?? 0;

  // Ultimele asociații
  const ultimeleAsociatii = await db.asociatie.findMany({
    where:   { organizationId: orgId, isActive: true },
    orderBy: { updatedAt: "desc" },
    take:    5,
    include: { apartamente: { where: { isActive: true }, select: { id: true } } },
  });

  // Ultimele facturi
  const ultimeleFacturi = await db.factura.findMany({
    where:   { organizationId: orgId },
    orderBy: { createdAt: "desc" },
    take:    5,
    include: { furnizor: { select: { nume: true } } },
  });

  const kpis = [
    { label: "Asociații active",     value: nrAsociatii,       color: "violet", icon: "🏢" },
    { label: "Apartamente",          value: nrApartamente,     color: "cyan",   icon: "🏠" },
    { label: "Proprietari",          value: nrProprietari,     color: "violet", icon: "👥" },
    { label: "Facturi neachitate",   value: nrFacturiNeplatite,color: "cyan",   icon: "📄" },
  ];

  return (
    <div className="dashboard">
      <div className="dashboard__welcome">
        <h2 className="dashboard__heading">
          Bună ziua, {session.user.name?.split(" ")[0]} 👋
        </h2>
        <p className="dashboard__sub">Privire de ansamblu asupra portofoliului administrat.</p>
      </div>

      <div className="kpi-grid">
        {kpis.map(k => (
          <div key={k.label} className={`kpi-card kpi-card--${k.color}`}>
            <span className="kpi-card__icon">{k.icon}</span>
            <p className="kpi-card__value">{k.value}</p>
            <p className="kpi-card__label">{k.label}</p>
          </div>
        ))}
      </div>

      {totalRestante > 0 && (
        <div className="dash-panel" style={{ borderColor: "rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.05)" }}>
          <p className="dash-panel__title" style={{ color: "#fca5a5" }}>⚠ Restanțe totale</p>
          <p style={{ fontSize: "1.75rem", fontWeight: 800, color: "#f87171", marginTop: "0.5rem" }}>
            {totalRestante.toFixed(2)} lei
          </p>
        </div>
      )}

      <div className="dashboard__grid">
        {/* Asociații recente */}
        <div className="dash-panel">
          <div className="dash-panel__title" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Asociații</span>
            <Link href="/asociatii" style={{ fontSize: "0.75rem", color: "#a78bfa" }}>Vezi toate →</Link>
          </div>

          {ultimeleAsociatii.length === 0 ? (
            <div className="dash-panel__empty">
              <p>Nicio asociație adăugată.</p>
              <Link href="/asociatii" style={{ color: "#a78bfa" }}>Adaugă prima asociație →</Link>
            </div>
          ) : (
            <div className="ap-list" style={{ marginTop: "0.5rem" }}>
              {ultimeleAsociatii.map(a => (
                <Link key={a.id} href={`/asociatii/${a.id}`} className="ap-row" style={{ textDecoration: "none" }}>
                  <span className="ap-row__nr" style={{ fontSize: "0.8125rem" }}>🏢</span>
                  <span className="ap-row__prop">{a.name}</span>
                  <span className="ap-row__rest">{a.apartamente.length} ap.</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Facturi recente */}
        <div className="dash-panel">
          <div className="dash-panel__title" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Facturi recente</span>
            <Link href="/facturi" style={{ fontSize: "0.75rem", color: "#a78bfa" }}>Vezi toate →</Link>
          </div>

          {ultimeleFacturi.length === 0 ? (
            <div className="dash-panel__empty">
              <p>Nicio factură adăugată.</p>
            </div>
          ) : (
            <div className="ap-list" style={{ marginTop: "0.5rem" }}>
              {ultimeleFacturi.map(f => (
                <div key={f.id} className="ap-row">
                  <span className="ap-row__nr" style={{ fontSize: "0.75rem", width: "auto" }}>
                    <span className={`pill pill--${f.status === "platita" ? "green" : f.status === "partial" ? "yellow" : "red"}`}>
                      {f.status}
                    </span>
                  </span>
                  <span className="ap-row__prop">{f.furnizor?.nume ?? "—"}</span>
                  <span className="ap-row__rest">{f.valoare.toFixed(2)} lei</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {nrAsociatii === 0 && (
        <div className="dash-onboarding">
          <span className="dash-onboarding__icon">🏗️</span>
          <h3 className="dash-onboarding__title">Pornește administrarea</h3>
          <p className="dash-onboarding__desc">
            Adaugă prima asociație de proprietari pentru a începe gestionarea
            facturilor, încasărilor și listelor de întreținere.
          </p>
          <Link href="/asociatii" className="btn btn--primary btn--lg">
            Adaugă prima asociație
          </Link>
        </div>
      )}
    </div>
  );
}
