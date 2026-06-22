import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export const metadata = { title: "Ghid de utilizare" };

interface Categorie {
  icon:  string;
  title: string;
  color: string;
  desc:  string;
  steps: string[];
  href?: string;
}

const QUICK_START = [
  { n: "1", t: "Adaugă asociația",        d: "Asociații → Adaugă asociație. Completează denumirea și datele de bază." },
  { n: "2", t: "Parcurge Inițializarea",  d: "Apartamente, proprietari, solduri, fonduri, sold casă/bancă, contoare." },
  { n: "3", t: "Facturi & încasări",      d: "Adaugă facturi de la furnizori și înregistrează încasările de la proprietari." },
  { n: "4", t: "Liste & rapoarte",        d: "Generează lista lunară de întreținere și consultă registrele." },
];

const CATEGORII: Categorie[] = [
  {
    icon: "🏢", title: "Asociații", color: "#a78bfa",
    desc: "Creează și administrează asociațiile din portofoliul tău.",
    steps: [
      "Adaugă o asociație nouă din meniul Asociații.",
      "Editează datele: CUI, adresă, IBAN, președinte, cenzor.",
      "Comută rapid între asociații din selectorul din antet.",
    ],
    href: "/asociatii",
  },
  {
    icon: "🧭", title: "Inițializare", color: "#22d3ee",
    desc: "Configurează o asociație pas cu pas, ca un wizard ghidat.",
    steps: [
      "Info & blocuri → Apartamente → Proprietari → Solduri.",
      "Fonduri → Sold casă/bancă → Contoare → Indecși.",
      "Datele se salvează automat la fiecare „Continuă”.",
      "Poți reveni oricând să modifici un pas.",
    ],
    href: "/initializare",
  },
  {
    icon: "👥", title: "Proprietari & Apartamente", color: "#4ade80",
    desc: "Gestionează locatarii și asocierea lor la apartamente.",
    steps: [
      "Asociază un proprietar principal fiecărui apartament.",
      "Adaugă telefon și mai multe adrese de email.",
      "Editează din Inițializare → pasul Proprietari.",
    ],
  },
  {
    icon: "📄", title: "Facturi furnizori", color: "#fbbf24",
    desc: "Înregistrează facturile primite și plata lor.",
    steps: [
      "Adaugă factura: furnizor, sumă, dată scadență.",
      "Marchează plata și metoda (casă / bancă).",
      "Distribuie cheltuiala pe apartamente pentru listă.",
    ],
    href: "/facturi",
  },
  {
    icon: "🧾", title: "Încasări", color: "#f472b6",
    desc: "Emite chitanțe pentru plățile primite de la proprietari.",
    steps: [
      "Caută apartamentul plătitor după număr sau nume.",
      "Alege ce achită: întreținere, restanțe, fonduri.",
      "Generează chitanța (casă / bancă / online).",
    ],
    href: "/incasari",
  },
  {
    icon: "📋", title: "Liste de întreținere", color: "#60a5fa",
    desc: "Generează lista lunară de plată pentru locatari.",
    steps: [
      "Alege luna și repartizează cheltuielile pe apartamente.",
      "Verifică totalurile și publică lista.",
      "Locatarii văd sumele de plată și restanțele.",
    ],
    href: "/rapoarte/lista-intretinere",
  },
  {
    icon: "📊", title: "Rapoarte & Registre", color: "#a78bfa",
    desc: "Toate situațiile financiare, gata de printat și exportat.",
    steps: [
      "Registre: Încasări, Casă, Bancă, Jurnal, Fonduri.",
      "Situații: Restanțieri, Fișă proprietar, Fișă furnizor.",
      "Filtru pe perioadă, descărcare PDF și printare.",
    ],
    href: "/rapoarte/incasari",
  },
  {
    icon: "🔁", title: "Transferuri", color: "#22d3ee",
    desc: "Mută bani între conturi sau între fonduri.",
    steps: [
      "Între conturi: Casă ↔ Bănci — vezi soldul fiecăruia.",
      "Între fonduri: mută sume dintr-un fond în altul.",
      "Validare automată: nu poți transfera mai mult decât ai.",
    ],
    href: "/transferuri/intre-conturi",
  },
  {
    icon: "⏱️", title: "Contoare", color: "#4ade80",
    desc: "Evidența consumurilor de apă, electric și gaz.",
    steps: [
      "Configurează tipurile de contoare și locațiile.",
      "Introdu citiri manuale sau importă ISTA / Techem.",
      "Consultă istoricul citirilor și consumurile.",
    ],
    href: "/contoare/citiri",
  },
  {
    icon: "🤖", title: "AI Asistent", color: "#fbbf24",
    desc: "Automatizează munca repetitivă cu ajutorul AI.",
    steps: [
      "Procesează automat facturile de la furnizori.",
      "Importă citirile contoarelor din poze.",
      "Definește modele de distribuție a cheltuielilor.",
    ],
    href: "/ai/facturi",
  },
  {
    icon: "🏛️", title: "SPV / e-Factură", color: "#f472b6",
    desc: "Integrare cu ANAF pentru facturare electronică.",
    steps: [
      "Conectează contul SPV ANAF.",
      "Vezi facturile primite și emise.",
      "Gestionează declarațiile fiscale și jurnalul ANAF.",
    ],
    href: "/spv/conectare",
  },
  {
    icon: "📈", title: "Dashboard", color: "#60a5fa",
    desc: "Privire de ansamblu asupra întregului portofoliu.",
    steps: [
      "Indicatori cheie: asociații, apartamente, proprietari.",
      "Grafic pe taburi: listă, restanțe, încasări, fonduri.",
      "Vezi rapid situația financiară a asociației.",
    ],
    href: "/dashboard",
  },
];

export default async function AjutorPage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  return (
    <div className="page-shell help">
      <style>{`
        .help__hero {
          position: relative; overflow: hidden;
          border-radius: 18px; padding: 2.5rem 2rem;
          background: linear-gradient(135deg, rgba(167,139,250,0.18), rgba(34,211,238,0.12));
          border: 1px solid rgba(167,139,250,0.25);
          margin-bottom: 2rem;
        }
        .help__hero::after {
          content: ""; position: absolute; top: -40%; right: -10%;
          width: 320px; height: 320px; border-radius: 50%;
          background: radial-gradient(circle, rgba(34,211,238,0.25), transparent 70%);
          pointer-events: none;
        }
        .help__hero-title { font-size: 2rem; font-weight: 900; letter-spacing: -0.02em; }
        .help__hero-sub { color: #cbd5e1; margin-top: 0.5rem; max-width: 640px; }
        .help__quick { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-top: 1.75rem; }
        .help__quick-item {
          display: flex; gap: 0.75rem; align-items: flex-start;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px; padding: 0.9rem 1rem;
        }
        .help__quick-n {
          flex: 0 0 auto; width: 28px; height: 28px; border-radius: 50%;
          display: grid; place-items: center; font-weight: 800; font-size: 0.85rem;
          background: linear-gradient(135deg, #a78bfa, #22d3ee); color: #0b1120;
        }
        .help__quick-t { font-weight: 700; font-size: 0.9rem; }
        .help__quick-d { font-size: 0.78rem; color: #94a3b8; margin-top: 0.15rem; line-height: 1.35; }
        .help__section-title { font-size: 1.15rem; font-weight: 800; margin: 0.5rem 0 1.25rem; }
        .help__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.25rem; }
        .help__card {
          position: relative; border-radius: 16px; padding: 1.5rem;
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
          transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease;
          text-decoration: none; display: block; color: inherit;
        }
        .help__card:hover {
          transform: translateY(-4px);
          border-color: var(--c, #a78bfa);
          box-shadow: 0 12px 30px -12px rgba(0,0,0,0.6), 0 0 0 1px var(--c, #a78bfa) inset;
        }
        .help__icon {
          width: 52px; height: 52px; border-radius: 14px; display: grid; place-items: center;
          font-size: 1.6rem; margin-bottom: 1rem;
          background: color-mix(in srgb, var(--c) 18%, transparent);
          border: 1px solid color-mix(in srgb, var(--c) 35%, transparent);
        }
        .help__card-title { font-size: 1.05rem; font-weight: 800; }
        .help__card-desc { font-size: 0.82rem; color: #94a3b8; margin-top: 0.35rem; line-height: 1.4; }
        .help__steps { list-style: none; padding: 0; margin: 1rem 0 0; display: flex; flex-direction: column; gap: 0.5rem; }
        .help__steps li { position: relative; padding-left: 1.4rem; font-size: 0.82rem; color: #cbd5e1; line-height: 1.4; }
        .help__steps li::before {
          content: "✓"; position: absolute; left: 0; top: 0;
          color: var(--c, #a78bfa); font-weight: 800; font-size: 0.8rem;
        }
        .help__open { margin-top: 1rem; font-size: 0.8rem; font-weight: 700; color: var(--c, #a78bfa); }
      `}</style>

      {/* Hero + quick start */}
      <div className="help__hero">
        <h1 className="help__hero-title">Ghid de utilizare 📘</h1>
        <p className="help__hero-sub">
          Tot ce trebuie să știi ca să administrezi asociațiile rapid și fără bătăi de cap.
          Începe cu pașii de mai jos, apoi explorează fiecare categorie.
        </p>
        <div className="help__quick">
          {QUICK_START.map(q => (
            <div key={q.n} className="help__quick-item">
              <span className="help__quick-n">{q.n}</span>
              <div>
                <div className="help__quick-t">{q.t}</div>
                <div className="help__quick-d">{q.d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Categorii */}
      <h2 className="help__section-title">Categorii</h2>
      <div className="help__grid">
        {CATEGORII.map(cat => {
          const Card: any = cat.href ? Link : "div";
          return (
            <Card
              key={cat.title}
              {...(cat.href ? { href: cat.href } : {})}
              className="help__card"
              style={{ ["--c" as any]: cat.color }}
            >
              <div className="help__icon" style={{ ["--c" as any]: cat.color }}>{cat.icon}</div>
              <div className="help__card-title">{cat.title}</div>
              <div className="help__card-desc">{cat.desc}</div>
              <ul className="help__steps">
                {cat.steps.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
              {cat.href && <div className="help__open">Deschide →</div>}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
