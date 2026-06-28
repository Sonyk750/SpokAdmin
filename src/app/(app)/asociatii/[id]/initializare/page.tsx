import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import WizardClient from "./WizardClient";

export const metadata = { title: "Inițializare asociație" };

export default async function InitializarePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  // Verifică dacă există cel puțin o listă de plată închisă — dacă da, wizard-ul se blochează
  const listaInchisa = await db.listaLuna.findFirst({
    where:  { asociatieId: id, status: "inchisa" },
    select: { luna: true, an: true, inchisaAt: true },
    orderBy: { inchisaAt: "asc" },
  });

  if (listaInchisa) {
    const luna = ["Ianuarie","Februarie","Martie","Aprilie","Mai","Iunie",
                  "Iulie","August","Septembrie","Octombrie","Noiembrie","Decembrie"][listaInchisa.luna - 1];
    return (
      <div className="page-shell">
        <div className="page-header">
          <div>
            <Link href={`/asociatii/${id}`} className="back-link" style={{ marginBottom: "0.25rem", display: "inline-block" }}>
              ← Înapoi la asociație
            </Link>
            <h1 className="page-title">Inițializare blocată</h1>
          </div>
        </div>
        <div className="dash-panel" style={{ maxWidth: 560, padding: "2rem 2rem", textAlign: "center" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🔒</div>
          <h2 style={{ color: "#e2e8f0", marginBottom: "0.75rem", fontSize: "1.1rem" }}>
            Valorile inițiale nu mai pot fi modificate
          </h2>
          <p style={{ color: "#94a3b8", lineHeight: 1.6, marginBottom: "1.5rem" }}>
            Lista de plată pentru <strong style={{ color: "#e2e8f0" }}>{luna} {listaInchisa.an}</strong> a fost
            închisă{listaInchisa.inchisaAt
              ? ` pe ${listaInchisa.inchisaAt.toLocaleDateString("ro-RO", { day: "2-digit", month: "long", year: "numeric" })}`
              : ""}.
            <br />
            Modificarea valorilor inițiale ar afecta istoricul și rapoartele existente.
          </p>
          <Link href={`/asociatii/${id}`} className="btn btn--secondary">
            ← Înapoi la asociație
          </Link>
        </div>
      </div>
    );
  }

  const a = await db.asociatie.findFirst({
    where:   { id, organizationId: session.user.organizationId },
    include: {
      apartamente: {
        where:   { isActive: true },
        orderBy: { numar: "asc" },
        include: {
          proprietari: {
            where:   { isMain: true },
            include: { proprietar: true },
            take:    1,
          },
          solduri:  true,
          fonduri:  true,
          contoare: {
            where:   { isActive: true },
            include: {
              citiri: { orderBy: [{ an: "desc" }, { luna: "desc" }], take: 1 },
            },
          },
        },
      },
      fonduri: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!a) notFound();

  let wizardDataParsed: Record<string, unknown> = {};
  try { if (a.wizardData) wizardDataParsed = JSON.parse(a.wizardData); } catch {}

  return (
    <WizardClient
      asociatieId={a.id}
      asociatieNume={a.name}
      nrApartamente={a.nrApartamente}
      wizardStep={a.wizardStep}
      wizardInitData={wizardDataParsed}
      asociatieInfo={{
        name:           a.name,
        address:        a.address        ?? "",
        city:           a.city           ?? "București",
        sector:         a.sector         ?? "",
        cui:            a.cui            ?? "",
        adminName:      a.adminName      ?? "",
        presedinteName: a.presedinteName ?? "",
        cenzorName:     a.cenzorName     ?? "",
        bank:           a.bank           ?? "",
        iban:           a.iban           ?? "",
        phone:          a.phone          ?? "",
        email:          a.email          ?? "",
      }}
      blocuriJson={a.blocuriJson ?? null}
      existingFonduri={a.fonduri.map(f => ({
        id:        f.id,
        name:      f.name,
        isEnabled: f.isEnabled,
        sortOrder: f.sortOrder,
      }))}
      existingApartamente={a.apartamente.map(ap => {
        let emailuriArr: string[] = [];
        try {
          const raw = ap.proprietari[0]?.proprietar.emailuriJson;
          if (raw) emailuriArr = JSON.parse(raw);
        } catch {}
        return {
          id:                  ap.id,
          numar:               ap.numar,
          scara:               ap.scara ?? "",
          etaj:                ap.etaj?.toString() ?? "",
          suprafata:           ap.suprafata?.toString() ?? "",
          nrPersone:           ap.nrPersone.toString(),
          cotaParte:           ap.cotaParte?.toString() ?? "",
          proprietarNume:      ap.proprietari[0]?.proprietar.nume ?? "",
          proprietarPrenume:   ap.proprietari[0]?.proprietar.prenume ?? "",
          proprietarTelefon:   ap.proprietari[0]?.proprietar.telefon ?? "",
          proprietarEmailuri:  emailuriArr,
          restantaIntretinere: ap.solduri[0]?.restantaIntretinere?.toString() ?? "0",
          restantaCurenta:     ap.solduri[0]?.intretinereCurenta?.toString() ?? "0",
        };
      })}
      existingSoldFonduri={a.apartamente.flatMap(ap =>
        ap.fonduri.map(f => ({
          apartamentId: f.apartamentId,
          fondId:       f.fondId,
          restanta:     f.restanta,
          sold:         f.sold ?? 0,
        }))
      )}
      existingContoare={a.apartamente.flatMap(ap =>
        ap.contoare.map(c => ({
          id:           c.id,
          apartamentId: c.apartamentId,
          numar:        ap.numar,
          tip:          c.tip,
          locatie:      c.locatie,
          denumire:     c.denumire,
          numarSerie:   c.numarSerie,
          indexVechi:   c.citiri[0]?.valoarePrev ?? null,
          indexNou:     c.citiri[0]?.valoare     ?? null,
        }))
      )}
    />
  );
}
