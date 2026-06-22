import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";

const fmtLei = (v: number) => v.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Cerc grafic (donut) — inel proporțional cu procentul + valoare în centru
function Donut({ label, value, percent, color, sub }: {
  label: string; value: number; percent: number; color: string; sub: string | null;
}) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, percent));
  const offset = c * (1 - pct);
  return (
    <div className="dash-panel" style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "1.25rem 1rem", textAlign: "center" }}>
      <div style={{ position: "relative", width: 120, height: 120 }}>
        <svg width={120} height={120} viewBox="0 0 120 120">
          <circle cx={60} cy={60} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={12} />
          <circle cx={60} cy={60} r={r} fill="none" stroke={color} strokeWidth={12}
            strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
            transform="rotate(-90 60 60)" />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: "1.05rem", fontWeight: 800, color }}>{fmtLei(value)}</span>
          <span style={{ fontSize: "0.6rem", color: "#94a3b8", letterSpacing: "0.05em" }}>LEI</span>
        </div>
      </div>
      <p style={{ marginTop: "0.75rem", fontSize: "0.8rem", fontWeight: 600, color: "#cbd5e1", lineHeight: 1.3 }}>{label}</p>
      {sub && <p style={{ marginTop: "0.15rem", fontSize: "0.7rem", color: "#94a3b8" }}>{sub}</p>}
    </div>
  );
}

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

  // Restanțe proprietari (din soldurile apartamentelor)
  const restante = await db.soldApartament.aggregate({
    where:  { apartament: { organizationId: orgId } },
    _sum:   { restantaIntretinere: true },
  });
  const totalRestanteProp = restante._sum.restantaIntretinere ?? 0;

  // Ultima listă de întreținere a fiecărei asociații → totaluri sumă de plată / încasări
  const asociatiiActive = await db.asociatie.findMany({
    where: { organizationId: orgId, isActive: true }, select: { id: true },
  });
  const ultimeleListe = (await Promise.all(
    asociatiiActive.map(a =>
      db.listaLuna.findFirst({
        where:   { asociatieId: a.id },
        orderBy: [{ an: "desc" }, { luna: "desc" }],
        select:  { id: true },
      })
    )
  )).filter((l): l is { id: string } => !!l).map(l => l.id);

  const listaAgg = await db.listaLunaApartament.aggregate({
    where: { listaId: { in: ultimeleListe } },
    _sum:  { totalDePlata: true, achitat: true },
  });
  const totalDePlata      = listaAgg._sum.totalDePlata ?? 0;
  const totalIncasatLista = listaAgg._sum.achitat ?? 0;

  // Restanțe furnizori = total facturi − total plătit
  const [facturiAgg, platiAgg] = await Promise.all([
    db.factura.aggregate({ where: { organizationId: orgId }, _sum: { valoare: true } }),
    db.plata.aggregate({ where: { factura: { organizationId: orgId } }, _sum: { suma: true } }),
  ]);
  const totalFacturi      = facturiAgg._sum.valoare ?? 0;
  const restanteFurnizori = Math.max(0, totalFacturi - (platiAgg._sum.suma ?? 0));

  // Procente pentru inelele donut
  const pctIncasat   = totalDePlata  > 0 ? totalIncasatLista / totalDePlata      : 0;
  const pctRestProp  = totalDePlata  > 0 ? totalRestanteProp / totalDePlata      : (totalRestanteProp > 0 ? 1 : 0);
  const pctRestFurn  = totalFacturi  > 0 ? restanteFurnizori / totalFacturi      : 0;

  const cercuri = [
    { label: "Sumă de plată (lista ant.)", value: totalDePlata,      percent: 1,           color: "#a78bfa", sub: null as string | null },
    { label: "Încasări pe listă",          value: totalIncasatLista, percent: pctIncasat,  color: "#4ade80", sub: `${Math.round(pctIncasat * 100)}% încasat` },
    { label: "Restanțe proprietari",       value: totalRestanteProp, percent: pctRestProp, color: "#f87171", sub: null },
    { label: "Restanțe furnizori",         value: restanteFurnizori, percent: pctRestFurn, color: "#fbbf24", sub: totalFacturi > 0 ? `${Math.round(pctRestFurn * 100)}% din facturi` : null },
  ];

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

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
        gap: "1rem",
        marginBottom: "1.5rem",
      }}>
        {cercuri.map(c => (
          <Donut key={c.label} label={c.label} value={c.value} percent={c.percent} color={c.color} sub={c.sub} />
        ))}
      </div>

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
