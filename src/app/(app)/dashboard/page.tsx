import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import DashboardCharts from "./DashboardCharts";
import { isSuperAdmin } from "@/lib/roles";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // SUPER_ADMIN fără organizație vede pagina de administrare globală
  if (isSuperAdmin(session.user.role) && !session.user.organizationId) {
    redirect("/utilizatori");
  }

  if (!session.user.organizationId) redirect("/login");

  const orgId = session.user.organizationId;

  const asociatiiActive = await db.asociatie.findMany({
    where: { organizationId: orgId, isActive: true }, select: { id: true },
  });
  const asociatiiIds = asociatiiActive.map(a => a.id);

  const [nrAsociatii, nrApartamente, nrProprietari, nrFacturiNeplatite] = await Promise.all([
    db.asociatie.count({ where: { organizationId: orgId, isActive: true } }),
    db.apartament.count({ where: { organizationId: orgId, isActive: true } }),
    db.proprietar.count({ where: { organizationId: orgId } }),
    db.factura.count({ where: { organizationId: orgId, status: "neplatita" } }),
  ]);

  // Solduri / restanțe proprietari
  const soldAgg = await db.soldApartament.aggregate({
    where: { apartament: { organizationId: orgId } },
    _sum:  { restantaIntretinere: true, intretinereCurenta: true },
  });
  const totalRestanteProp  = soldAgg._sum.restantaIntretinere ?? 0;
  const intretinereCurenta = soldAgg._sum.intretinereCurenta ?? 0;

  // Ultima listă de întreținere a fiecărei asociații
  const ultimeleListe = (await Promise.all(
    asociatiiIds.map(id =>
      db.listaLuna.findFirst({
        where: { asociatieId: id }, orderBy: [{ an: "desc" }, { luna: "desc" }], select: { id: true },
      })
    )
  )).filter((l): l is { id: string } => !!l).map(l => l.id);

  const [listaAgg, listaHeaderAgg, facturiAgg, platiAgg, platiByMetoda, incByTip, fondRestAgg, fondSold, fondNames, platiFondAgg] = await Promise.all([
    db.listaLunaApartament.aggregate({
      where: { listaId: { in: ultimeleListe } },
      _sum:  { totalDePlata: true, achitat: true, rest: true, restantaVeche: true, totalLuna: true },
    }),
    db.listaLuna.aggregate({ where: { id: { in: ultimeleListe } }, _sum: { totalCheltuieli: true } }),
    db.factura.aggregate({ where: { organizationId: orgId }, _sum: { valoare: true } }),
    db.plata.aggregate({ where: { factura: { organizationId: orgId } }, _sum: { suma: true } }),
    db.plata.groupBy({ by: ["metoda"], where: { factura: { organizationId: orgId } }, _sum: { suma: true } }),
    db.incasare.groupBy({ by: ["tipPlata"], where: { organizationId: orgId }, _sum: { sumaIncasata: true } }),
    db.fondApartament.aggregate({ where: { asociatieId: { in: asociatiiIds } }, _sum: { restanta: true } }),
    db.fondApartament.groupBy({ by: ["fondId"], where: { asociatieId: { in: asociatiiIds } }, _sum: { sold: true } }),
    db.fondAsociatie.findMany({ where: { asociatieId: { in: asociatiiIds } }, select: { id: true, name: true } }),
    db.plata.groupBy({ by: ["fondId"], where: { fondId: { not: null }, factura: { asociatieId: { in: asociatiiIds } } }, _sum: { suma: true } }),
  ]);

  const totalDePlata       = listaAgg._sum.totalDePlata  ?? 0;
  const totalIncasatLista  = listaAgg._sum.achitat        ?? 0;
  const restLista          = listaAgg._sum.rest           ?? 0;
  const restantaVecheLista = listaAgg._sum.restantaVeche  ?? 0;
  const totalLunaLista     = listaAgg._sum.totalLuna      ?? 0;
  const cheltuieliLista    = listaHeaderAgg._sum.totalCheltuieli ?? 0;

  const totalFacturi      = facturiAgg._sum.valoare ?? 0;
  const totalPlatit       = platiAgg._sum.suma      ?? 0;
  const restanteFurnizori = Math.max(0, totalFacturi - totalPlatit);
  const restanteFonduri   = fondRestAgg._sum.restanta ?? 0;

  const metoda = (m: string) => platiByMetoda.find(x => x.metoda === m)?._sum.suma ?? 0;
  const tip    = (t: string) => incByTip.find(x => x.tipPlata === t)?._sum.sumaIncasata ?? 0;
  const incTotal = incByTip.reduce((s, x) => s + (x._sum.sumaIncasata ?? 0), 0);

  // Solduri fonduri agregate pe nume (între asociații), top 6 — minus plățile din fond
  const nameById = new Map(fondNames.map(f => [f.id, f.name]));
  const platiFondById = new Map(platiFondAgg.map(p => [p.fondId, p._sum.suma ?? 0]));
  const byName   = new Map<string, number>();
  for (const r of fondSold) {
    const nm = nameById.get(r.fondId) ?? "Fond";
    const platit = platiFondById.get(r.fondId) ?? 0;
    byName.set(nm, (byName.get(nm) ?? 0) + (r._sum.sold ?? 0) - platit);
  }
  const fonduriTop = [...byName.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([label, value]) => ({ label, value }));

  // Ultimele asociații / facturi pentru panourile de jos
  const [ultimeleAsociatii, ultimeleFacturi] = await Promise.all([
    db.asociatie.findMany({
      where: { organizationId: orgId, isActive: true }, orderBy: { updatedAt: "desc" }, take: 5,
      include: { apartamente: { where: { isActive: true }, select: { id: true } } },
    }),
    db.factura.findMany({
      where: { organizationId: orgId }, orderBy: { createdAt: "desc" }, take: 5,
      include: { furnizor: { select: { nume: true } } },
    }),
  ]);

  const kpis = [
    { label: "Asociații active",   value: nrAsociatii,        color: "violet", icon: "🏢" },
    { label: "Apartamente",        value: nrApartamente,      color: "cyan",   icon: "🏠" },
    { label: "Proprietari",        value: nrProprietari,      color: "violet", icon: "👥" },
    { label: "Facturi neachitate", value: nrFacturiNeplatite, color: "cyan",   icon: "📄" },
  ];

  const tabs = [
    {
      key: "lista", label: "Listă întreținere", unit: "lei",
      bars: [
        { label: "Sumă de plată",  value: totalDePlata },
        { label: "Încasat",        value: totalIncasatLista },
        { label: "Rest de încasat",value: restLista },
        { label: "Restanță veche", value: restantaVecheLista },
        { label: "Total lună",     value: totalLunaLista },
        { label: "Cheltuieli",     value: cheltuieliLista },
      ],
    },
    {
      key: "restante", label: "Restanțe", unit: "lei",
      bars: [
        { label: "Proprietari",     value: totalRestanteProp },
        { label: "Întreț. curentă", value: intretinereCurenta },
        { label: "Furnizori",       value: restanteFurnizori },
        { label: "Fonduri",         value: restanteFonduri },
      ],
    },
    {
      key: "incasari", label: "Încasări", unit: "lei",
      bars: [
        { label: "Total",  value: incTotal },
        { label: "Casă",   value: tip("casa") },
        { label: "Bancă",  value: tip("banca") },
        { label: "Online", value: tip("online") },
      ],
    },
    {
      key: "facturi", label: "Facturi", unit: "lei",
      bars: [
        { label: "Total facturi", value: totalFacturi },
        { label: "Plătit",        value: totalPlatit },
        { label: "Neplătit",      value: restanteFurnizori },
        { label: "Plăți casă",    value: metoda("casa") },
        { label: "Plăți bancă",   value: metoda("banca") },
      ],
    },
    {
      key: "fonduri", label: "Fonduri", unit: "lei",
      bars: fonduriTop,
    },
    {
      key: "portofoliu", label: "Portofoliu", unit: "nr",
      bars: [
        { label: "Asociații",      value: nrAsociatii },
        { label: "Apartamente",    value: nrApartamente },
        { label: "Proprietari",    value: nrProprietari },
        { label: "Fac. neplătite", value: nrFacturiNeplatite },
      ],
    },
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

      <DashboardCharts tabs={tabs} />

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
