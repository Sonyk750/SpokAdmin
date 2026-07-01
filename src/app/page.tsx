"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { Logo } from "./components/Logo";
import SplashParticles from "./components/SplashParticles";

// ─── Data ────────────────────────────────────────────────────────────────────

const stats = [
  { value: "30+",  label: "Module integrate" },
  { value: "12+",  label: "Tipuri de rapoarte" },
  { value: "100%", label: "Conform legislatiei RO" },
  { value: "24/7", label: "Acces din cloud" },
];

type Feature = { icon: React.ReactNode; title: string; desc: string; tag?: string; cyan?: boolean };

const features: Feature[] = [
  {
    title: "Liste de plata & intretinere",
    desc: "Calcul automat al cotelor, repartizarea consumurilor si generarea listelor lunare conforme, in cateva secunde.",
    icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="13" y2="16"/></svg>),
  },
  {
    title: "AI in lista de plata",
    desc: "Prima aplicatie de administrare cu AI in crearea listei de plata: citeste facturile, recunoaste articolele si distribuie automat cheltuielile pe apartamente, dupa criteriul corect — fara erori. Tu doar verifici si confirmi.",
    tag: "Premiera in Romania",
    cyan: true,
    icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M5 3v4M3 5h4M6 17v4M4 19h4"/><path d="M13 3l2.5 6.5L22 12l-6.5 2.5L13 21l-2.5-6.5L4 12l6.5-2.5z"/></svg>),
  },
  {
    title: "Contabilitate & registre",
    desc: "Registru de casa, banca, jurnal, fond rulment si reparatii — actualizate automat pe masura ce inregistrezi operatiuni.",
    icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v6l9 4 9-4V7"/><line x1="12" y1="11" x2="12" y2="21"/></svg>),
  },
  {
    title: "e-Factura ANAF (SPV)",
    desc: "Conectare la SPV, facturi emise si primite, declaratii fiscale si jurnal ANAF — totul direct din aplicatie.",
    tag: "Integrat ANAF",
    cyan: true,
    icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><path d="M14 2v6h6"/><path d="m9 15 2 2 4-4"/></svg>),
  },
  {
    title: "Incasari & plati online",
    desc: "Incasari, chitante, urmarirea restantierilor si plata cotelor online de catre proprietari, direct din platforma.",
    icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><line x1="6" y1="15" x2="10" y2="15"/></svg>),
  },
  {
    title: "Contoare & consumuri",
    desc: "Citiri de contoare si repartizarea consumului de apa, caldura sau alte utilitati, corect, pe fiecare apartament.",
    icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 12l4-2"/><path d="M12 3v2M3 12h2M19 12h2"/></svg>),
  },
  {
    title: "Salarizare",
    desc: "State de plata, declaratii si ordine de plata pentru angajatii si colaboratorii asociatiei, fara batai de cap.",
    icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/></svg>),
  },
  {
    title: "Rapoarte complete",
    desc: "Fisa proprietar si furnizor, venituri-cheltuieli, restantieri si toate registrele — vizualizate live si exportate in PDF.",
    icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4v16h16"/><rect x="8" y="11" width="3" height="6"/><rect x="14" y="7" width="3" height="10"/></svg>),
  },
  {
    title: "Asistent AI",
    desc: "Pune intrebari in limbaj natural despre datele asociatiei si primesti raspunsuri instant, fara sa cauti prin rapoarte.",
    tag: "Powered by Claude",
    cyan: true,
    icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a4 4 0 0 1 4 4 4 4 0 0 1 0 8 4 4 0 0 1-8 0 4 4 0 0 1 0-8 4 4 0 0 1 4-4z"/><path d="M12 7v10M8 11h8"/></svg>),
  },
  {
    title: "Platforma proprietari",
    desc: "Acces 24/7 pentru locatari: situatia contului, plati, sesizari si documente, de pe orice telefon sau laptop.",
    icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="7" y="2" width="10" height="20" rx="2"/><line x1="11" y1="18" x2="13" y2="18"/></svg>),
  },
  {
    title: "Training la sediul tau",
    desc: "Acordam training personalizat la sediul clientului pentru initializarea asociatiei si crearea primei liste de plata — pleci cu aplicatia configurata si stii exact cum o folosesti.",
    tag: "La sediul clientului",
    icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>),
  },
];

const whyStats = [
  { v: "30+",  l: "Module integrate" },
  { v: "0",    l: "Instalari necesare" },
  { v: "5min", l: "Pana esti gata" },
  { v: "24/7", l: "Acces din orice loc" },
];

const whyFeatures = [
  { n: "01", title: "Totul intr-un singur loc",          desc: "Financiar, contabil, fiscal si tehnic — fara sa mai jonglezi intre programe separate si zeci de fisiere Excel." },
  { n: "02", title: "Conform legislatiei romanesti",     desc: "Registre, liste de plata si declaratii generate exact cum cere legislatia asociatiilor de proprietari si ANAF." },
  { n: "03", title: "Fara instalare, din orice browser", desc: "Aplicatie 100% web, pe PC, tableta sau telefon. Datele tale sunt in cloud, securizate si salvate automat." },
  { n: "04", title: "Pus la punct in cateva minute",     desc: "Creezi asociatia, adaugi blocuri si apartamente si esti gata. Fara implementari complicate sau costuri ascunse." },
];

const steps = [
  { n: "01", title: "Creezi cont",         desc: "Te inregistrezi in cateva secunde si configurezi prima asociatie direct din aplicatie." },
  { n: "02", title: "Adaugi datele",       desc: "Blocuri, apartamente, proprietari si solduri initiale — manual sau prin import rapid." },
  { n: "03", title: "Administrezi simplu", desc: "Generezi liste, incasezi, emiti facturi si rapoarte din orice dispozitiv, oricand." },
];

const blogTeaser = [
  { slug: "lista-de-plata-cu-ai",                                  category: "Inteligenta Artificiala", cyan: true,  readTime: "7 min", title: "Lista de plata cu AI: cum distribuie inteligenta artificiala facturile pe apartamente" },
  { slug: "software-administrare-asociatii-proprietari-ghid-2026", category: "Administrare Imobile",     cyan: false, readTime: "9 min", title: "Software administrare asociatii de proprietari: ghid complet 2026" },
  { slug: "e-factura-anaf-asociatii-proprietari",                  category: "e-Factura ANAF",          cyan: true,  readTime: "8 min", title: "e-Factura ANAF pentru asociatii de proprietari: cum conectezi SPV in 2026" },
  { slug: "fond-rulment-registre-cenzorat-digital",               category: "Contabilitate",           cyan: false, readTime: "8 min", title: "Fond de rulment, registre si cenzorat: cum le gestionezi digital" },
];

type Pkg = {
  key: string; name: string; price: string; unit?: string; range: string;
  color: "cyan" | "violet"; recommended?: boolean; cta: string; href: string; features: string[];
};

const packages: Pkg[] = [
  {
    key: "start", name: "Start", price: "0", unit: "gratuit 1 an", range: "1 asociatie · pana la 20 ap.",
    color: "cyan", cta: "Incepe gratuit", href: "/register",
    features: [
      "Pana la 20 de apartamente",
      "Liste de plata & intretinere",
      "Registru fond rulment",
      "Platforma proprietari",
      "Suport email",
    ],
  },
  {
    key: "standard", name: "Standard", price: "99", unit: "lei / luna", range: "pana la 50 apartamente",
    color: "violet", recommended: true, cta: "Alege Standard", href: "/register",
    features: [
      "Tot ce include Start",
      "Contabilitate & registre complete",
      "Incasari & plati online",
      "Rapoarte complete + export PDF",
      "Suport prioritar",
    ],
  },
  {
    key: "pro", name: "Pro", price: "199", unit: "lei / luna", range: "pana la 150 apartamente",
    color: "cyan", cta: "Alege Pro", href: "/register",
    features: [
      "Tot ce include Standard",
      "e-Factura ANAF (SPV)",
      "Salarizare & declaratii",
      "Asistent AI inclus",
      "Contoare & repartizare consum",
    ],
  },
  {
    key: "enterprise", name: "Enterprise", price: "La cerere", range: "apartamente nelimitate",
    color: "violet", cta: "Contacteaza-ne", href: "#contact",
    features: [
      "Apartamente nelimitate",
      "Asociatii & utilizatori nelimitati",
      "Acces API platforma",
      "Onboarding asistat",
      "Suport dedicat & SLA",
    ],
  },
];

const faqs = [
  { q: "Cum ajuta AI-ul la crearea listei de plata?", a: "SpokAdmin este prima aplicatie de administrare a asociatiilor de proprietari din Romania care foloseste inteligenta artificiala in fluxul de creare a listei de plata. AI-ul citeste facturile primite, identifica articolele (apa, canalizare, salubritate, energie etc.) si propune distribuirea lor automata pe apartamente, dupa criteriul corect (consum, cota indiviza, numar de persoane) — fara erori de calcul. Administratorul doar verifica si confirma." },
  { q: "Pentru cine este SpokAdmin?",             a: "Pentru administratori de imobile, firme de administrare si asociatii de proprietari care vor sa digitalizeze complet activitatea financiara, contabila si tehnica — de la liste de plata pana la e-Factura ANAF." },
  { q: "Trebuie sa instalez ceva?",               a: "Nu. SpokAdmin ruleaza 100% in browser, pe orice dispozitiv. Datele sunt pastrate in cloud, securizate si salvate automat — nu ai nevoie de niciun program instalat local." },
  { q: "Este conform cu legislatia din Romania?", a: "Da. Registrele, listele de plata si declaratiile respecta legislatia asociatiilor de proprietari, iar modulul fiscal este conectat la cerintele ANAF." },
  { q: "Pot emite facturi prin e-Factura?",       a: "Da. SpokAdmin se conecteaza la SPV ANAF pentru facturi emise si primite, declaratii fiscale si jurnal ANAF, direct din aplicatie." },
  { q: "Pot administra mai multe asociatii?",     a: "Da. Poti gestiona oricate asociatii dintr-un singur cont, cu comutare rapida intre ele si date complet separate." },
  { q: "Oferiti training pentru initializare?",   a: "Da. Acordam training personalizat la sediul clientului care include initializarea completa a asociatiei in aplicatie si crearea primei liste de plata. La finalul sesiunii pleci cu tot configurat si cu toate cunostintele necesare pentru a administra independent." },
];

// ─── Phone illustration (mobile app section) ─────────────────────────────────

function PhoneIllustration() {
  return (
    <svg viewBox="0 0 280 520" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      {/* phone frame */}
      <rect x="20" y="8" width="240" height="504" rx="38" fill="#050814" stroke="rgba(255,255,255,0.14)" strokeWidth="1.5"/>
      <rect x="24" y="12" width="232" height="496" rx="35" fill="rgba(255,255,255,0.015)"/>
      {/* dynamic island */}
      <rect x="100" y="20" width="80" height="14" rx="7" fill="#0a0f1e"/>
      {/* status bar */}
      <text x="40" y="52" fontFamily="DM Sans, sans-serif" fontSize="11" fontWeight="600" fill="rgba(255,255,255,0.5)">9:41</text>
      <text x="240" y="52" fontFamily="DM Sans, sans-serif" fontSize="10" fill="rgba(255,255,255,0.4)" textAnchor="end">⚡ 84%</text>
      {/* app header */}
      <rect x="24" y="60" width="232" height="54" fill="rgba(124,58,237,0.1)"/>
      <circle cx="52" cy="87" r="11" fill="rgba(124,58,237,0.25)" stroke="rgba(167,139,250,0.4)"/>
      <text x="52" y="92" fontFamily="DM Sans, sans-serif" fontSize="9" fontWeight="800" fill="#a78bfa" textAnchor="middle">SA</text>
      <text x="72" y="84" fontFamily="DM Sans, sans-serif" fontSize="13" fontWeight="700" fill="#fff">SpokAdmin</text>
      <text x="72" y="100" fontFamily="DM Sans, sans-serif" fontSize="9" fill="rgba(255,255,255,0.45)">Bloc 5 · Ap. 12 · Popescu Ion</text>
      {/* balance card */}
      <rect x="32" y="128" width="216" height="88" rx="16" fill="rgba(124,58,237,0.1)" stroke="rgba(124,58,237,0.25)"/>
      <text x="50" y="154" fontFamily="DM Sans, sans-serif" fontSize="9" fontWeight="600" fill="rgba(255,255,255,0.45)" letterSpacing="1.5">SOLD CURENT</text>
      <text x="50" y="179" fontFamily="DM Sans, sans-serif" fontSize="24" fontWeight="800" fill="#fff">- 142,50 lei</text>
      <text x="50" y="199" fontFamily="DM Sans, sans-serif" fontSize="9" fill="rgba(255,255,255,0.4)">Scadenta: 15 Iulie 2026</text>
      {/* pay button */}
      <rect x="32" y="228" width="216" height="48" rx="14" fill="#7c3aed"/>
      <rect x="32" y="228" width="216" height="48" rx="14" fill="url(#payGrad)"/>
      <defs>
        <linearGradient id="payGrad" x1="32" y1="228" x2="248" y2="276" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7c3aed"/>
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.7"/>
        </linearGradient>
      </defs>
      <text x="140" y="258" fontFamily="DM Sans, sans-serif" fontSize="14" fontWeight="700" fill="#fff" textAnchor="middle">Plateste online</text>
      {/* section label */}
      <text x="50" y="298" fontFamily="DM Sans, sans-serif" fontSize="8" fontWeight="700" fill="rgba(255,255,255,0.35)" letterSpacing="2">INFORMATII ASOCIATIE</text>
      {/* info rows */}
      {([
        ["Administrator", "Ionescu M."],
        ["Fond rulment", "4.200 lei"],
        ["Urmatoarea sedinta", "20 Iul 2026"],
      ] as [string, string][]).map(([label, value], i) => (
        <g key={label}>
          <rect x="32" y={310 + i * 36} width="216" height="30" rx="8" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.06)"/>
          <text x="48" y={330 + i * 36} fontFamily="DM Sans, sans-serif" fontSize="10" fill="rgba(255,255,255,0.42)">{label}</text>
          <text x="232" y={330 + i * 36} fontFamily="DM Sans, sans-serif" fontSize="10" fontWeight="600" fill="#fff" textAnchor="end">{value}</text>
        </g>
      ))}
      {/* notification */}
      <rect x="32" y="426" width="216" height="52" rx="14" fill="rgba(6,182,212,0.07)" stroke="rgba(6,182,212,0.22)"/>
      <circle cx="56" cy="452" r="11" fill="rgba(6,182,212,0.15)" stroke="rgba(6,182,212,0.35)"/>
      <text x="56" y="457" fontFamily="DM Sans, sans-serif" fontSize="12" textAnchor="middle" fill="#67e8f9">🔔</text>
      <text x="75" y="447" fontFamily="DM Sans, sans-serif" fontSize="10" fontWeight="600" fill="#fff">Lista iunie 2026 disponibila</text>
      <text x="75" y="463" fontFamily="DM Sans, sans-serif" fontSize="9" fill="rgba(255,255,255,0.4)">Acum 1 ora · Descarca PDF</text>
      {/* bottom nav bar */}
      <rect x="24" y="488" width="232" height="64" fill="rgba(5,8,20,0.8)"/>
      <line x1="24" y1="488" x2="256" y2="488" stroke="rgba(255,255,255,0.07)" strokeWidth="1"/>
      {(["🏠","💳","📋","👤"] as string[]).map((icon, i) => (
        <text key={i} x={65 + i * 52} y={525} fontFamily="DM Sans, sans-serif" fontSize="16" textAnchor="middle" fill={i === 0 ? "#a78bfa" : "rgba(255,255,255,0.28)"}>{icon}</text>
      ))}
    </svg>
  );
}

// ─── Hero illustration (dashboard mock) ───────────────────────────────────────

const V = "#7c3aed";
const C = "#06b6d4";

function HeroIllustration() {
  return (
    <svg viewBox="0 0 480 380" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      {/* window frame */}
      <rect x="40" y="20" width="400" height="300" rx="16" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
      <rect x="56" y="36" width="368" height="268" rx="10" fill="rgba(5,8,20,0.9)"/>
      <rect x="56" y="36" width="368" height="40" rx="10" fill="rgba(124,58,237,0.12)"/>
      <circle cx="76" cy="56" r="5" fill="#a78bfa"/>
      <text x="92" y="61" fontFamily="DM Sans, sans-serif" fontWeight="700" fontSize="13" fill="#fff">SpokAdmin</text>
      <rect x="378" y="46" width="34" height="20" rx="5" fill="rgba(6,182,212,0.18)"/>
      <text x="395" y="60" fontFamily="DM Sans, sans-serif" fontSize="9" fill={C} textAnchor="middle">LIVE</text>

      {/* KPI cards */}
      <rect x="72" y="94" width="108" height="64" rx="8" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.08)"/>
      <text x="88" y="122" fontFamily="DM Sans, sans-serif" fontWeight="800" fontSize="20" fill="#fff">1.248</text>
      <text x="88" y="140" fontFamily="DM Sans, sans-serif" fontSize="9" fill="#6b7280">Apartamente</text>
      <rect x="186" y="94" width="108" height="64" rx="8" fill="rgba(124,58,237,0.1)" stroke="rgba(124,58,237,0.25)"/>
      <text x="202" y="122" fontFamily="DM Sans, sans-serif" fontWeight="800" fontSize="20" fill="#a78bfa">98%</text>
      <text x="202" y="140" fontFamily="DM Sans, sans-serif" fontSize="9" fill="#6b7280">Incasare</text>
      <rect x="300" y="94" width="108" height="64" rx="8" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.08)"/>
      <text x="316" y="122" fontFamily="DM Sans, sans-serif" fontWeight="800" fontSize="20" fill="#22C55E">42</text>
      <text x="316" y="140" fontFamily="DM Sans, sans-serif" fontSize="9" fill="#6b7280">Facturi e-ANAF</text>

      {/* chart */}
      <rect x="72" y="174" width="336" height="112" rx="8" fill="rgba(255,255,255,0.015)" stroke="rgba(255,255,255,0.06)"/>
      {[0,1,2,3].map(i => <line key={i} x1="88" y1={198+i*22} x2="392" y2={198+i*22} stroke="rgba(124,58,237,0.07)" strokeWidth="0.5"/>)}
      {[0.45,0.7,0.55,0.82,0.6,0.9,0.75].map((h,i) => (
        <rect key={i} x={96+i*44} y={274-h*80} width="22" height={h*80} rx="3" fill={i % 2 ? V : "rgba(124,58,237,0.45)"}/>
      ))}
      <polyline points="107,240 151,214 195,228 239,196 283,218 327,186 371,204" fill="none" stroke={C} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>

      {/* floating badge */}
      <rect x="290" y="296" width="160" height="52" rx="12" fill="rgba(5,8,20,0.95)" stroke="rgba(6,182,212,0.3)"/>
      <circle cx="316" cy="322" r="11" fill="rgba(34,197,94,0.15)" stroke="#22C55E"/>
      <path d="M311 322l4 4 6-7" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <text x="336" y="318" fontFamily="DM Sans, sans-serif" fontWeight="700" fontSize="11" fill="#fff">Lista generata</text>
      <text x="336" y="333" fontFamily="DM Sans, sans-serif" fontSize="9" fill="#6b7280">Iunie · 84 apartamente</text>
    </svg>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const { ref, visible } = useInView();
  return (
    <div ref={ref} style={{
      opacity:   visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(24px)",
      transition: `opacity 0.8s ease ${delay}s, transform 0.8s ease ${delay}s`,
    }}>
      {children}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const [introVisible,  setIntroVisible]  = useState(true);
  const [pageIn,        setPageIn]        = useState(false);
  const [openFaq,       setOpenFaq]       = useState<number | null>(null);
  const [showContact,   setShowContact]   = useState(false);
  const [contactForm,   setContactForm]   = useState({ nume: "", email: "", telefon: "", mesaj: "" });
  const [contactSent,   setContactSent]   = useState(false);
  const [showPromoBar,  setShowPromoBar]  = useState(true);
  const [checkoutPlan,  setCheckoutPlan]  = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState("");

  const handleSplashDone = useCallback(() => {
    setPageIn(true);
    setTimeout(() => setIntroVisible(false), 1500);
  }, []);

  const closeContact = () => { setShowContact(false); setContactSent(false); };

  async function handlePlanClick(pkg: Pkg) {
    if (pkg.key === "enterprise") { setShowContact(true); return; }
    if (pkg.key === "start")      { window.location.href = "/register"; return; }

    setCheckoutPlan(pkg.key);
    setCheckoutError("");
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: pkg.key }),
      });
      if (res.status === 401) {
        window.location.href = `/register?plan=${pkg.key}`;
        return;
      }
      const data = await res.json();
      if (data.url) { window.location.href = data.url; return; }
      setCheckoutError(data.error || "Eroare la initializarea platii. Incearca din nou.");
    } catch (e) {
      console.error("[checkout]", e);
      setCheckoutError("Eroare de retea. Incearca din nou.");
    }
    setCheckoutPlan(null);
  }

  return (
    <>
      {/* ── Promo bar ── */}
      {showPromoBar && (
        <div className="promo-bar">
          <div className="promo-bar__inner">
            <span className="promo-bar__fire">🔥</span>
            <span className="promo-bar__pill">Oferta lansare</span>
            <p className="promo-bar__text">
              <strong>Primii 10 clienti corporate</strong> primesc{" "}
              <strong className="promo-bar__highlight">20% reducere</strong> la orice pachet,
              valabil <strong>un an intreg.</strong>{" "}
              <span className="promo-bar__slots">Mai sunt doar cateva locuri libere.</span>
            </p>
            <button
              className="promo-bar__cta"
              onClick={() => { setShowPromoBar(false); setShowContact(true); }}
            >
              Rezerva acum →
            </button>
            <button className="promo-bar__close" onClick={() => setShowPromoBar(false)} aria-label="Inchide">×</button>
          </div>
        </div>
      )}

      {/* ── Splash ── */}
      {introVisible && <SplashParticles onSkip={handleSplashDone} />}

      {/* ── Contact panel ── */}
      {showContact && (
        <>
          <div className="panel-overlay" onClick={closeContact} />
          <div className="panel">
            <div className="panel__header">
              <div className="panel__header-row">
                <div>
                  <p className="panel__label">Hai sa vorbim</p>
                  <h2 className="panel__title">Cere o demonstratie</h2>
                  <p className="panel__subtitle">Vezi SpokAdmin in actiune pe asociatia ta</p>
                </div>
                <button className="panel__close" onClick={closeContact}>×</button>
              </div>
            </div>
            <div className="panel__body">
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.75rem" }}>
                {[
                  { icon: "✉️", label: "Email",   val: "office@spokadmin.ro", href: "mailto:office@spokadmin.ro" },
                  { icon: "📞", label: "Telefon", val: "0756 362 828", href: "tel:+40756362828" },
                  { icon: "🕐", label: "Program", val: "Luni – Vineri: 09:00 – 18:00" },
                ].map(item => (
                  <div key={item.label} className="cinfo-row">
                    <span className="cinfo-row__icon">{item.icon}</span>
                    <div>
                      <p className="cinfo-row__label">{item.label}</p>
                      <div className="cinfo-row__val">
                        {item.href ? <a href={item.href}>{item.val}</a> : item.val}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", marginBottom: "1.5rem" }} />
              <p className="panel__items-label">Trimite un mesaj</p>

              {contactSent ? (
                <div className="contact-sent">
                  <p className="contact-sent__icon">✓</p>
                  <p className="contact-sent__title">Mesaj trimis!</p>
                  <p className="contact-sent__sub">Te contactam in cel mai scurt timp.</p>
                </div>
              ) : (
                <div className="contact-form">
                  {[
                    { key: "nume",    label: "Numele tau *", placeholder: "ex: Ion Popescu",   type: "text" },
                    { key: "email",   label: "Email *",      placeholder: "ex: ion@email.com", type: "email" },
                    { key: "telefon", label: "Telefon",      placeholder: "ex: 0756 362 828",  type: "tel" },
                  ].map(f => (
                    <div key={f.key} className="form-field">
                      <label className="form-field__label">{f.label}</label>
                      <input
                        type={f.type}
                        placeholder={f.placeholder}
                        className="input"
                        value={contactForm[f.key as keyof typeof contactForm]}
                        onChange={e => setContactForm(p => ({ ...p, [f.key]: e.target.value }))}
                      />
                    </div>
                  ))}
                  <div className="form-field">
                    <label className="form-field__label">Mesaj *</label>
                    <textarea
                      rows={4}
                      placeholder="Cate asociatii administrezi si ce te intereseaza?"
                      className="input"
                      value={contactForm.mesaj}
                      onChange={e => setContactForm(p => ({ ...p, mesaj: e.target.value }))}
                    />
                  </div>
                  <a
                    href={`mailto:office@spokadmin.ro?subject=Cerere demonstratie SpokAdmin — ${contactForm.nume}&body=Nume: ${contactForm.nume}%0AEmail: ${contactForm.email}%0ATelefon: ${contactForm.telefon}%0A%0AMesaj:%0A${contactForm.mesaj}`}
                    onClick={() => setContactSent(true)}
                    className="btn btn--primary btn--full"
                    style={{ marginTop: "0.25rem" }}
                  >
                    Trimite mesaj
                  </a>
                  <p style={{ fontSize: "0.6875rem", color: "#6b7280", textAlign: "center" }}>
                    Sau suna direct:{" "}
                    <a href="tel:+40756362828" style={{ color: "#a78bfa", fontWeight: 600 }}>0756 362 828</a>
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Background scene ── */}
      <div className="bg-scene">
        <div className="bg-scene__violet" />
        <div className="bg-scene__cyan" />
        <div className="bg-scene__grid" />
      </div>

      {/* ── Main ── */}
      <main className={`page-main${pageIn ? "" : " page-main--hidden"}`} style={{ paddingTop: showPromoBar ? "calc(4rem + 2.75rem)" : "4rem" }}>

        {/* ─ Header ─ */}
        <header className="header" style={{ top: showPromoBar ? "2.75rem" : 0 }}>
          <div className="header__inner">
            <Logo height={42} />
            <nav className="header__nav">
              <a href="#functionalitati">Functionalitati</a>
              <a href="#de-ce">De ce SpokAdmin</a>
              <a href="#preturi">Preturi</a>
              <a href="#blog">Blog</a>
              <a href="#intrebari">Intrebari</a>
              <button onClick={() => setShowContact(true)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: "inherit", fontFamily: "inherit" }}>Contact</button>
            </nav>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <a href="/login" className="btn btn--secondary" style={{ padding: "0.625rem 1.25rem", fontSize: "0.8125rem" }}>
                Conectare
              </a>
              <a href="/register" className="btn btn--primary header__cta">
                Incepe gratuit
              </a>
            </div>
          </div>
          <nav className="header__mobile-nav">
            <a href="#functionalitati">Functionalitati</a>
            <a href="#preturi">Preturi</a>
            <a href="#blog">Blog</a>
            <a href="#intrebari">Intrebari</a>
            <button onClick={() => setShowContact(true)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: "inherit", fontFamily: "inherit" }}>Contact</button>
            <a href="/login" style={{ color: "inherit", fontSize: "inherit" }}>Conectare</a>
          </nav>
        </header>

        {/* ─ Hero ─ */}
        <section className="hero">
          <div className="container">
            <div className="hero__inner">
              <div style={{ opacity: pageIn ? 1 : 0, transform: pageIn ? "translateY(0)" : "translateY(24px)", transition: "all 0.9s ease 0.3s" }}>
                <div className="badge badge--violet hero__badge">
                  <span className="badge__dot" />
                  Nou · AI in crearea listei de plata
                </div>
                <h1 className="hero__title">
                  Administrarea<br />
                  asociatiei,<br />
                  <span className="gradient">complet digitalizata.</span>
                </h1>
                <p className="hero__sub">
                  SpokAdmin este <strong>prima aplicatie de administrare a asociatiilor de proprietari din Romania cu AI in crearea listei de plata</strong> — citeste facturile si le distribuie automat, fara erori, pe apartamente. Plus contabilitate, e-Factura ANAF, incasari si rapoarte, intr-o singura platforma.
                </p>
                <p className="hero__note">
                  Fara instalare. Fara Excel-uri pierdute. Conform legislatiei din Romania, accesibil din orice browser.
                </p>
                <div className="hero__ctas">
                  <a href="/register" className="btn btn--primary btn--lg">
                    Incepe gratuit
                  </a>
                  <a href="#functionalitati" className="btn btn--secondary btn--lg">
                    Vezi functionalitatile
                  </a>
                </div>
              </div>
              <div className="hero__illustration" style={{ height: "auto", opacity: pageIn ? 1 : 0, transform: pageIn ? "translateX(0)" : "translateX(40px)", transition: "all 1s ease 0.5s" }}>
                <HeroIllustration />
              </div>
            </div>
          </div>
        </section>

        {/* ─ Stats ─ */}
        <section className="stats-section">
          <div className="container">
            <FadeIn>
              <div className="stats-grid">
                {stats.map(s => (
                  <div key={s.label} className="stat-item">
                    <div className="stat-item__value">{s.value}</div>
                    <p className="stat-item__label">{s.label}</p>
                  </div>
                ))}
              </div>
            </FadeIn>
          </div>
        </section>

        {/* ─ Functionalitati ─ */}
        <section id="functionalitati" className="section section--alt">
          <div className="container">
            <FadeIn>
              <div className="section-intro section-intro--center">
                <p className="section-label section-label--violet">Functionalitati</p>
                <h2 className="section-heading">
                  Tot ce-ti trebuie ca sa<br /><span className="gradient">administrezi profesionist</span>
                </h2>
                <p className="section-desc" style={{ margin: "1rem auto 0", textAlign: "center" }}>
                  De la prima lista de plata pana la declaratia ANAF — fiecare activitate a unei asociatii, intr-un singur loc.
                </p>
              </div>
            </FadeIn>
            <div className="features-grid">
              {features.map((f, i) => (
                <FadeIn key={f.title} delay={(i % 3) * 0.08}>
                  <div className={`feature-card${f.cyan ? " feature-card--cyan" : ""}`}>
                    <div className="feature-card__icon">{f.icon}</div>
                    <h3 className="feature-card__title">{f.title}</h3>
                    <p className="feature-card__desc">{f.desc}</p>
                    {f.tag && <span className="feature-card__tag">{f.tag}</span>}
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* ─ De ce SpokAdmin ─ */}
        <section id="de-ce" className="section">
          <div className="container">
            <div className="why-grid">
              <FadeIn>
                <div>
                  <p className="section-label section-label--violet">De ce SpokAdmin</p>
                  <h2 className="section-heading">
                    Mai putin timp pierdut.<br />
                    <span className="gradient">Mai mult control.</span>
                  </h2>
                  <p className="section-desc">
                    Inlocuieste programele invechite si zecile de fisiere cu o platforma moderna, gandita pentru administrarea asociatiilor din Romania. Totul se actualizeaza singur, in timp real.
                  </p>
                  <div className="why-mini-stats">
                    {whyStats.map(item => (
                      <div key={item.l} className="why-mini-stat">
                        <p className="why-mini-stat__value">{item.v}</p>
                        <p className="why-mini-stat__label">{item.l}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </FadeIn>
              <FadeIn delay={0.2}>
                <div className="why-features">
                  {whyFeatures.map(item => (
                    <div key={item.n} className="why-feature">
                      <span className="why-feature__num">{item.n}</span>
                      <div>
                        <p className="why-feature__title">{item.title}</p>
                        <p className="why-feature__desc">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </FadeIn>
            </div>
          </div>
        </section>

        {/* ─ Preturi ─ */}
        <section id="preturi" className="section section--alt">
          <div className="container">
            <FadeIn>
              <div className="section-intro section-intro--center">
                <p className="section-label section-label--violet">Preturi</p>
                <h2 className="section-heading">
                  Un plan pentru fiecare<br />
                  <span className="gradient">dimensiune de portofoliu</span>
                </h2>
                <p className="section-desc" style={{ margin: "1rem auto 0", textAlign: "center" }}>
                  Incepi gratuit si cresti cand ai nevoie. Fara contracte pe termen lung, anulezi oricand.
                </p>
              </div>
            </FadeIn>
            <div className="pricing-grid">
              {packages.map((pkg, i) => (
                <FadeIn key={pkg.key} delay={i * 0.1}>
                  <div className={`pricing-card pricing-card--${pkg.color}${pkg.recommended ? " pricing-card--featured" : ""}`}>
                    {pkg.recommended && (
                      <span className="pricing-card__recommended">Recomandat</span>
                    )}
                    <div className="pricing-card__badge">{pkg.name}</div>
                    <div className="pricing-card__price">
                      <strong>{pkg.price}</strong>
                      {pkg.unit && <span> {pkg.unit}</span>}
                    </div>
                    <p className="pricing-card__range">{pkg.range}</p>
                    <ul className="pricing-card__features">
                      {pkg.features.map(f => (
                        <li key={f} className="pricing-card__feature">
                          <span className="pricing-card__check">✓</span>
                          {f}
                        </li>
                      ))}
                    </ul>
                    <button
                      className="pricing-card__btn"
                      onClick={() => handlePlanClick(pkg)}
                      disabled={checkoutPlan === pkg.key}
                    >
                      {checkoutPlan === pkg.key ? "Se redirectioneaza..." : pkg.cta}
                    </button>
                  </div>
                </FadeIn>
              ))}
            </div>
            {checkoutError && (
              <p style={{ marginTop: "1rem", textAlign: "center", color: "#f87171", fontSize: "0.9375rem", fontWeight: 600 }}>
                {checkoutError}
              </p>
            )}
          </div>
        </section>

        {/* ─ Cum functioneaza ─ */}
        <section id="cum-functioneaza" className="section">
          <div className="container">
            <FadeIn>
              <div className="section-intro section-intro--center">
                <p className="section-label section-label--cyan">Cum functioneaza</p>
                <h2 className="section-heading">
                  De la inregistrare la<br /><span className="gradient">administrare in 3 pasi</span>
                </h2>
                <p className="section-desc" style={{ margin: "1rem auto 0", textAlign: "center" }}>
                  Nu ai nevoie de implementari sau training. Esti operational in aceeasi zi.
                </p>
              </div>
            </FadeIn>
            <div className="steps-grid">
              {steps.map((s, i) => (
                <FadeIn key={s.n} delay={i * 0.15}>
                  <div className="process-step" style={{ "--step-color": i % 2 === 0 ? "#7c3aed" : "#06b6d4" } as React.CSSProperties}>
                    <p className="process-step__number">{s.n}</p>
                    <h3 className="process-step__title">{s.title}</h3>
                    <p className="process-step__desc">{s.desc}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* ─ Aplicatie Mobila ─ */}
        <section className="section section--alt">
          <div className="container">
            <FadeIn>
              <div className="mobile-app-banner">
                <div className="mobile-app-banner__content">
                  <div className="badge badge--cyan mobile-app-banner__badge">
                    <span className="badge__dot" style={{ background: "#67e8f9" }} />
                    In curand · iOS &amp; Android
                  </div>
                  <h2 className="section-heading">
                    SpokAdmin<br />
                    <span className="gradient">in buzunarul tau</span>
                  </h2>
                  <p className="section-desc">
                    Lansam aplicatia mobila pentru <strong>iOS si Android</strong>. Toti proprietarii si utilizatorii vor primi <strong>acces gratuit</strong> la toate informatiile asociatiei si isi vor putea plati cotele de intretinere online, direct de pe telefon — oricand, fara sa astepte chitante fizice.
                  </p>
                  <ul className="mobile-app-features">
                    {[
                      "Acces gratuit pentru toti proprietarii si utilizatorii",
                      "Plata online a cotelor de intretinere",
                      "Notificari la aparitia listei de plata lunare",
                      "Documente si informatii asociatie in timp real",
                      "Istoric plati si situatia contului personal",
                    ].map(f => (
                      <li key={f} className="mobile-app-features__item">
                        <span className="mobile-app-features__check">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="app-store-badges">
                    <div className="app-store-badge">
                      <svg viewBox="0 0 24 24" fill="currentColor" width="26" height="26" aria-hidden="true">
                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                      </svg>
                      <div>
                        <p className="app-store-badge__soon">Curand pe</p>
                        <strong className="app-store-badge__name">App Store</strong>
                      </div>
                    </div>
                    <div className="app-store-badge">
                      <svg viewBox="0 0 24 24" fill="currentColor" width="26" height="26" aria-hidden="true">
                        <path d="M3.18 23.76c.3.17.64.22.97.15l11.44-11.44L12 8.88 3.18 23.76zm17.15-11.9-2.81-1.63-3.22 3.22 3.22 3.22 2.85-1.65c.81-.47.81-1.7-.04-2.16zM2.34.26C2.13.48 2 .82 2 1.27v21.46c0 .45.13.79.35 1.01L2.45 23.82l12.02-12.02V11.7L2.45.15 2.34.26zm9.27 9.27L3.18.24c-.3-.18-.66-.2-.97-.04l8.82 9.39.58-.06z"/>
                      </svg>
                      <div>
                        <p className="app-store-badge__soon">Curand pe</p>
                        <strong className="app-store-badge__name">Google Play</strong>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mobile-app-banner__phone">
                  <PhoneIllustration />
                </div>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* ─ FAQ ─ */}
        <section id="intrebari" className="section section--alt">
          <div className="container">
            <FadeIn>
              <div className="section-intro section-intro--center">
                <p className="section-label section-label--violet">Intrebari frecvente</p>
                <h2 className="section-heading">
                  Tot ce vrei sa stii<br /><span className="gradient">despre SpokAdmin</span>
                </h2>
              </div>
            </FadeIn>
            <div className="faq-list" style={{ maxWidth: "50rem", margin: "0 auto" }}>
              {faqs.map((f, i) => (
                <FadeIn key={i} delay={i * 0.1}>
                  <div className={`faq-acc${openFaq === i ? " faq-acc--open" : ""}`}>
                    <button className="faq-acc__btn" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                      <span className="faq-acc__q">{f.q}</span>
                      <span className={`faq-acc__icon${openFaq === i ? " faq-acc__icon--open" : ""}`}>+</span>
                    </button>
                    {openFaq === i && (
                      <div className="faq-acc__answer"><p>{f.a}</p></div>
                    )}
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* ─ Blog ─ */}
        <section id="blog" className="section">
          <div className="container">
            <FadeIn>
              <div className="section-intro section-intro--center">
                <p className="section-label section-label--cyan">Blog & resurse</p>
                <h2 className="section-heading">
                  Ghiduri pentru<br /><span className="gradient">administrarea asociatiei</span>
                </h2>
                <p className="section-desc" style={{ margin: "1rem auto 0", textAlign: "center" }}>
                  Lista de plata cu AI, software de administrare, e-Factura ANAF, fond de rulment si cenzorat — explicate pe intelesul administratorilor.
                </p>
              </div>
            </FadeIn>
            <div className="blog-teaser__grid">
              {blogTeaser.map((p, i) => (
                <FadeIn key={p.slug} delay={(i % 4) * 0.08}>
                  <a href={`/blog/${p.slug}`} className="blog-card">
                    <div className="blog-card__top">
                      <span className={`blog-tag ${p.cyan ? "blog-tag--cyan" : "blog-tag--violet"}`}>{p.category}</span>
                      <span className="blog-card__time">{p.readTime} citire</span>
                    </div>
                    <h3 className="blog-card__title">{p.title}</h3>
                    <div className="blog-card__foot">
                      <span className="blog-card__more">Citeste →</span>
                    </div>
                  </a>
                </FadeIn>
              ))}
            </div>
            <div className="blog-teaser__all">
              <a href="/blog" className="btn btn--secondary btn--lg">Vezi toate articolele</a>
            </div>
          </div>
        </section>

        {/* ─ CTA ─ */}
        <section id="contact" className="cta-section section--alt">
          <div className="cta-section__glow" />
          <div className="container cta-section__inner">
            <FadeIn>
              <p className="section-label section-label--violet">Incepe astazi</p>
              <h2 className="cta-section__title">
                Digitalizeaza<br />
                administrarea<br />
                <span className="gradient">asociatiei tale.</span>
              </h2>
              <p className="cta-section__sub">
                Porneste gratuit, fara card si fara instalare. Ai prima asociatie configurata in cateva minute.
              </p>
              <p className="cta-section__note">
                14 zile gratuit pe planul Start. Fara angajamente, anulezi oricand.
              </p>
              <div className="cta-section__btns">
                <a href="/register" className="btn btn--primary btn--lg">
                  Incepe gratuit
                </a>
                <button className="btn btn--secondary btn--lg" onClick={() => setShowContact(true)}>
                  Cere o demonstratie
                </button>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* ─ Footer ─ */}
        <footer className="footer">
          <div className="container">
            <div className="footer__grid">
              <div>
                <Logo height={38} />
                <p style={{ fontSize: "0.8125rem", color: "#6b7280", lineHeight: 1.7, marginTop: "1rem" }}>
                  Platforma completa de administrare pentru asociatii de proprietari si firme de administrare imobile din Romania.
                </p>
              </div>
              <div>
                <p className="footer__col-title">Produs</p>
                <div className="footer__links">
                  <a href="#functionalitati">Functionalitati</a>
                  <a href="#preturi">Preturi</a>
                  <a href="#cum-functioneaza">Cum functioneaza</a>
                  <a href="/blog">Blog</a>
                  <a href="/login">Conectare</a>
                  <a href="/register">Cont nou</a>
                </div>
              </div>
              <div>
                <p className="footer__col-title">Module</p>
                <div className="footer__links">
                  {["Liste de plata","Contabilitate & registre","e-Factura ANAF","Incasari & plati","Rapoarte","Asistent AI"].map(l => <span key={l}>{l}</span>)}
                </div>
              </div>
              <div>
                <p className="footer__col-title">Contact</p>
                <div className="footer__links">
                  <a href="mailto:office@spokadmin.ro">office@spokadmin.ro</a>
                  <a href="tel:+40756362828">0756 362 828</a>
                  <button onClick={() => setShowContact(true)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", font: "inherit", textAlign: "left", padding: 0 }}>Cere o demonstratie</button>
                </div>
              </div>
            </div>
            <div className="footer__bottom">
              <span>© 2026 SpokAdmin — Software de administrare asociatii de proprietari</span>
              <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
                <a href="/legal/termeni">Termeni si conditii</a>
                <a href="/legal/confidentialitate">Confidentialitate</a>
              </div>
            </div>
          </div>
        </footer>

      </main>
    </>
  );
}
