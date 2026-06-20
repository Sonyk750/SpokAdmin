"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { Logo } from "./components/Logo";
import OfertaModal from "./components/OfertaModal";
import SplashParticles from "./components/SplashParticles";

// ─── Data ────────────────────────────────────────────────────────────────────

const stats = [
  { value: "1.200+", label: "Unitati administrate" },
  { value: "98%",    label: "Rata de colectare" },
  { value: "15+",    label: "Ani experienta" },
  { value: "24/7",   label: "Suport activ" },
];

const steps = [
  { n: "01", title: "Consultatie gratuita",    desc: "Analizam situatia imobilului sau blocului tau si iti oferim un plan personalizat, fara niciun angajament." },
  { n: "02", title: "Preluare si configurare", desc: "Digitalizam contractele existente, preluam relatia cu chiriasii si configuram platforma in maximum 48 de ore." },
  { n: "03", title: "Administrare continua",   desc: "Firma noastra gestioneaza totul lunar. Tu primesti rapoarte clare si nu mai ai nicio grija." },
];

const faqs = [
  { q: "Ce inseamna administrarea unui bloc?",      a: "Administrarea unui bloc include colectarea fondului de rulment si intretinere, gestionarea furnizorilor de utilitati, coordonarea lucrarilor tehnice, tinerea evidentei contabile si comunicarea cu proprietarii. O firma de administrare profesionista preia toate aceste responsabilitati." },
  { q: "Cat costa serviciile de property management?", a: "Costul administrarii imobilelor variaza in functie de numarul de unitati si serviciile alese. DecoImob ofera tarife transparente, fara costuri ascunse, calculate ca procent din valoarea chiriei colectate sau ca tarif fix lunar per unitate." },
  { q: "In ce zone din Bucuresti oferiti servicii?", a: "Oferim servicii de administrare imobile si administrare blocuri in toate sectoarele Bucurestiului si in judetul Ilfov. Portofoliul nostru include blocuri rezidentiale, imobile de birouri si ansambluri rezidentiale." },
];

const whyStats = [
  { v: "98%", l: "Rata colectare chirii" },
  { v: "0",   l: "Contracte reziliate fortat" },
  { v: "48h", l: "Timp mediu preluare" },
  { v: "15+", l: "Ani pe piata din Bucuresti" },
];

const whyFeatures = [
  { n: "01", title: "Transparenta financiara totala",  desc: "Fiecare leu colectat si cheltuit apare in raportul lunar. Acces la contabilitate in timp real, fara surprize." },
  { n: "02", title: "Raspuns in maxim 24 de ore",      desc: "Orice sesizare tehnica sau solicitare din partea chiriasilor primeste raspuns si plan de actiune in 24 de ore." },
  { n: "03", title: "Administratori certificati",      desc: "Echipa DecoImob este formata exclusiv din administratori autorizati, cu experienta in blocuri si imobile rezidentiale." },
  { n: "04", title: "Contract fara clauze ascunse",    desc: "Iti oferim un contract clar, in conformitate cu legislatia romana, fara obligatii ascunse si cu clauze de iesire simple." },
];

const packages = [
  {
    key: "liste",
    name: "Starter",
    price: "250",
    range: "1 – 5 imobile",
    color: "cyan",
    features: [
      "Până la 5 imobile/blocuri",
      "Liste lunare de plată",
      "Registru fond rulment",
      "Raport financiar lunar email",
      "Platformă digitală proprietari",
      "Suport email",
    ],
  },
  {
    key: "contabil",
    name: "Business",
    price: "500",
    range: "5 – 15 imobile",
    color: "violet",
    recommended: true,
    features: [
      "Până la 15 imobile/blocuri",
      "Tot ce include Starter",
      "Evidență contabilă completă",
      "Declarații fiscale ANAF",
      "Registru Casă lunar",
      "Ordine de plată furnizori",
      "Suport prioritar",
    ],
  },
  {
    key: "complet",
    name: "Professional",
    price: "900",
    range: "15 – 50 imobile",
    color: "cyan",
    features: [
      "Până la 50 imobile/blocuri",
      "Tot ce include Business",
      "Administrare tehnică",
      "Suport juridic & ANAF",
      "Administrator dedicat",
      "Intervenții urgente 24/7",
      "Suport dedicat",
    ],
  },
  {
    key: "enterprise",
    name: "Enterprise",
    price: "1500",
    range: "50+ imobile",
    color: "violet",
    features: [
      "Imobile nelimitate",
      "Tot ce include Professional",
      "Manager cont dedicat",
      "SLA garantat",
      "Rapoarte personalizate",
      "API acces platformă",
      "White-label opțional",
    ],
  },
];

const servicesDetail = [
  {
    number: "01", title: "Administrare Financiara", subtitle: "Inclus in toate pachetele",
    intro: "Evidenta financiara este cea mai importanta activitate a administratiei. DecoImob gestioneaza cu rigoare fiecare leu al asociatiei tale.",
    tag: "Pachet LISTE / CONTABIL / COMPLET",
    items: [
      "Plata facturilor catre furnizorii de utilitati si prestatorii de servicii",
      "Intocmirea si tinerea Registrului de Casa lunar",
      "Actualizarea Registrelor Fond Rulment si Fond Reparatii",
      "Depunerea declaratiilor fiscale pentru angajati si colaboratori",
      "Mentinerea relatiei cu institutia bancara a asociatiei",
      "Intocmirea ordinelor de plata pentru serviciile prestate",
      "Achitarea taxelor si impozitelor catre bugetul de stat",
      "Monitorizarea modificarilor legislative in domeniu",
      "Acces aplicatie online, cloud documente si arhiva electronica",
      "Raport financiar lunar trimis pe email catre proprietari",
    ],
  },
  {
    number: "02", title: "Administrare Tehnica", subtitle: "Inclus in Pachet COMPLET",
    intro: "Activitatea administrativa este cea mai vizibila in cadrul imobilului. Echipa noastra asigura confortul proprietarilor si functionarea optima a cladirii.",
    tag: "Pachet COMPLET",
    items: [
      "Verificarea starii subsolului, cailor de acces, palierelor si ghenelor",
      "Verificarea functionarii ascensorului (dupa caz)",
      "Intocmirea referatelor de necesitate si prezentarea ofertelor pentru interventii",
      "Coordonare lucrari de intretinere si reparatii cu mesteri autorizati",
      "Afisarea listelor lunare de plati dupa aprobarea cenzorului",
      "Ridicarea facturilor furnizorilor de la sediul beneficiarului",
      "Verificarea contoarelor de apa din apartamente (1 data / 6 luni)",
      "Verificarea functionarii instalatiei electrice comune",
      "Colectarea si constatarea reclamatiilor privind partile comune",
      "Participarea la receptia lucrarilor — comisie Comitet Executiv",
    ],
  },
  {
    number: "03", title: "Suport Juridic si ANAF", subtitle: "Inclus in Pachet COMPLET",
    intro: "Asistenta juridica completa pentru asociatia ta — de la contracte conforme pana la recuperare creante si reprezentare in fata institutiilor statului.",
    tag: "Pachet COMPLET",
    items: [
      "Redactarea si gestionarea contractelor de administrare conforme legislatiei",
      "Reprezentare in relatia cu ANAF si institutiile locale",
      "Recuperare creante restante prin colaborare cu firma specializata",
      "Mediere conflicte dintre proprietari si chiriasi",
      "Consultanta administrativa cu administratia locala a sectorului",
      "Asistenta juridica pentru hotararile Adunarii Generale",
      "Verificarea si aplicarea legislatiei in vigoare pentru asociatii",
      "Suport in relatia cu furnizorii de utilitati si prestatorii de servicii",
    ],
  },
  {
    number: "04", title: "Platforma Digitala Proprietari", subtitle: "Inclus in toate pachetele",
    intro: "Toti locatarii au acces 24/7 la platforma DecoImob — situatia contului, plati online, sesizari si documente, de pe orice dispozitiv.",
    tag: "Pachet LISTE / CONTABIL / COMPLET",
    items: [
      "Acces individual cu user si parola pentru fiecare proprietar",
      "Vizualizare situatie cont si cote de intretinere in timp real",
      "Plata cotelor de intretinere online, direct din platforma",
      "Trimitere sesizari si probleme din asociatie catre administrator",
      "Email automat lunar cu lista de plata si sumele datorate",
      "Acces arhiva electronica — facturi, registre, documente",
      "Cloud storage securizat pe toata durata contractului",
      "Compatibil PC, laptop, tableta si smartphone (Android & iOS)",
      "Call center activ 24 ore / 7 zile pentru orice problema",
      "Arhivare si transcriere documente in format electronic gratuit",
    ],
  },
];

// ─── Illustrations ────────────────────────────────────────────────────────────

const V = "#7c3aed";
const VL = "#a78bfa";
const C = "#06b6d4";

function IllustrationFinanciar() {
  return (
    <svg viewBox="0 0 400 260" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <rect width="400" height="260" fill="#050814"/>
      {[0,1,2,3,4,5].map(i => <line key={i} x1="0" y1={40+i*36} x2="400" y2={40+i*36} stroke="rgba(124,58,237,0.08)" strokeWidth="0.5"/>)}
      <rect x="40" y="100" width="36" height="140" rx="4" fill={V} opacity="0.4"/>
      <rect x="100" y="60"  width="36" height="180" rx="4" fill={V} opacity="0.6"/>
      <rect x="160" y="90"  width="36" height="150" rx="4" fill={V} opacity="0.35"/>
      <rect x="220" y="40"  width="36" height="200" rx="4" fill={V} opacity="0.75"/>
      <polyline points="58,100 118,60 178,90 238,40" fill="none" stroke={VL} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      {([58,118,178,238] as number[]).map((x,i) => {
        const y=[100,60,90,40][i];
        return <circle key={i} cx={x} cy={y} r="4" fill={VL}/>;
      })}
      <rect x="270" y="30" width="115" height="70" rx="8" fill="rgba(124,58,237,0.1)" stroke="rgba(124,58,237,0.3)" strokeWidth="1"/>
      <text x="284" y="58"  fontFamily="DM Sans, sans-serif" fontWeight="700" fontSize="22" fill="#fff">+18%</text>
      <text x="284" y="76"  fontFamily="DM Sans, sans-serif" fontSize="10"  fill="#6b7280" letterSpacing="1">VENITURI LUNARE</text>
      <rect x="270" y="115" width="115" height="50" rx="8" fill="rgba(124,58,237,0.06)" stroke="rgba(124,58,237,0.2)" strokeWidth="1"/>
      <text x="284" y="138" fontFamily="DM Sans, sans-serif" fontWeight="700" fontSize="16" fill="#fff">98.2%</text>
      <text x="284" y="154" fontFamily="DM Sans, sans-serif" fontSize="10"  fill="#6b7280" letterSpacing="1">COLECTARE</text>
    </svg>
  );
}

function IllustrationTehnic() {
  return (
    <svg viewBox="0 0 400 260" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <rect width="400" height="260" fill="#050814"/>
      <polygon points="100,200 180,160 180,60 100,100"  fill="rgba(124,58,237,0.06)" stroke="rgba(124,58,237,0.15)" strokeWidth="1"/>
      <polygon points="180,60 260,100 260,200 180,160"  fill="rgba(124,58,237,0.10)" stroke="rgba(124,58,237,0.15)" strokeWidth="1"/>
      <polygon points="100,100 180,60 260,100 180,140"  fill="rgba(124,58,237,0.18)" stroke={VL} strokeWidth="0.5"/>
      {[[0.7,0.15],[0.15,0.7],[0.7,0.7],[0.15,0.7]].map((cols,row) => cols.map((op,col) => (
        <rect key={`${row}-${col}`} x={115+col*28} y={115+row*20} width="14" height="10" rx="1" fill={V} opacity={op}/>
      )))}
      <circle cx="320" cy="80" r="36" fill="rgba(124,58,237,0.08)" stroke="rgba(124,58,237,0.2)" strokeWidth="1"/>
      <circle cx="320" cy="80" r="28" fill="none" stroke={V} strokeWidth="1" opacity="0.3"/>
      <circle cx="320" cy="80" r="4" fill={VL}/>
      <rect x="270" y="130" width="120" height="32" rx="6" fill="rgba(124,58,237,0.06)" stroke="rgba(124,58,237,0.2)" strokeWidth="0.5"/>
      <circle cx="286" cy="146" r="5" fill="#22C55E"/>
      <text x="296" y="150" fontFamily="DM Sans, sans-serif" fontSize="11" fill="#fff">Sistem functional</text>
      <rect x="270" y="170" width="120" height="32" rx="6" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5"/>
      <circle cx="286" cy="186" r="5" fill="#EAB308"/>
      <text x="296" y="190" fontFamily="DM Sans, sans-serif" fontSize="11" fill="#9ca3af">Interventie activa</text>
      <rect x="270" y="210" width="120" height="32" rx="6" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5"/>
      <circle cx="286" cy="226" r="5" fill={C}/>
      <text x="296" y="230" fontFamily="DM Sans, sans-serif" fontSize="11" fill="#9ca3af">Programata: Luni</text>
    </svg>
  );
}

function IllustrationJuridic() {
  return (
    <svg viewBox="0 0 400 260" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <rect width="400" height="260" fill="#050814"/>
      <rect x="60"  y="30"  width="160" height="210" rx="8" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
      <rect x="60"  y="30"  width="160" height="40"  rx="8" fill="rgba(124,58,237,0.08)"/>
      <rect x="60"  y="58"  width="160" height="12"  fill="rgba(124,58,237,0.08)"/>
      <text x="140" y="56" fontFamily="DM Sans, sans-serif" fontWeight="700" fontSize="11" fill="#fff" textAnchor="middle">CONTRACT</text>
      <text x="140" y="68" fontFamily="DM Sans, sans-serif" fontSize="8"    fill="#6b7280" textAnchor="middle" letterSpacing="2">ADMINISTRARE</text>
      {[90,106,122,138,154,170].map(y => (
        <rect key={y} x="80" y={y} width={y%24===18?100:130} height="6" rx="3" fill="rgba(124,58,237,0.12)"/>
      ))}
      <path d="M85,205 Q95,195 105,205 Q115,215 125,205" fill="none" stroke={VL} strokeWidth="1.5" strokeLinecap="round"/>
      <rect x="200" y="50" width="140" height="120" rx="8" fill="rgba(124,58,237,0.08)" stroke="rgba(124,58,237,0.25)" strokeWidth="0.5"/>
      <rect x="200" y="50" width="140" height="30"  rx="8" fill="rgba(124,58,237,0.15)"/>
      <text x="270" y="67" fontFamily="DM Sans, sans-serif" fontWeight="700" fontSize="10" fill={VL} textAnchor="middle">CONFORM ANAF</text>
      {[100,114,128,142,156].map(y => (
        <rect key={y} x="215" y={y} width={y%28===16?80:110} height="5" rx="2" fill="rgba(124,58,237,0.12)"/>
      ))}
      <circle cx="320" cy="185" r="20" fill="rgba(16,185,129,0.1)" stroke="#22C55E" strokeWidth="1"/>
      <path d="M311,185 L318,192 L330,178" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IllustrationDigital() {
  return (
    <svg viewBox="0 0 400 260" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <rect width="400" height="260" fill="#050814"/>
      <rect x="60" y="20"  width="280" height="180" rx="10" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
      <rect x="72" y="32"  width="256" height="156" rx="6"  fill="rgba(5,8,20,0.9)"/>
      <rect x="72" y="32"  width="256" height="28"  rx="6"  fill="rgba(124,58,237,0.12)"/>
      <circle cx="88" cy="46" r="5" fill={VL}/>
      <text x="98"  y="50" fontFamily="DM Sans, sans-serif" fontWeight="700" fontSize="10" fill="#fff">DecoImob Dashboard</text>
      <rect x="290" y="38" width="30" height="16" rx="4" fill="rgba(124,58,237,0.2)"/>
      <text x="305" y="49" fontFamily="DM Sans, sans-serif" fontSize="8"    fill={VL}     textAnchor="middle">LIVE</text>
      <rect x="80"  y="70" width="72" height="44" rx="6" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5"/>
      <text x="116" y="89" fontFamily="DM Sans, sans-serif" fontWeight="800" fontSize="16" fill="#fff"  textAnchor="middle">247</text>
      <text x="116" y="104" fontFamily="DM Sans, sans-serif" fontSize="8"   fill="#6b7280" textAnchor="middle">Plati</text>
      <rect x="162" y="70" width="72" height="44" rx="6" fill="rgba(124,58,237,0.08)" stroke="rgba(124,58,237,0.25)" strokeWidth="0.5"/>
      <text x="198" y="89" fontFamily="DM Sans, sans-serif" fontWeight="800" fontSize="16" fill={VL}   textAnchor="middle">12</text>
      <text x="198" y="104" fontFamily="DM Sans, sans-serif" fontSize="8"   fill="#6b7280" textAnchor="middle">Sesizari</text>
      <rect x="244" y="70" width="72" height="44" rx="6" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5"/>
      <text x="280" y="89" fontFamily="DM Sans, sans-serif" fontWeight="800" fontSize="16" fill="#22C55E" textAnchor="middle">98%</text>
      <text x="280" y="104" fontFamily="DM Sans, sans-serif" fontSize="8"  fill="#6b7280" textAnchor="middle">Colectare</text>
      <polyline points="92,165 106,150 120,158 134,140 148,145 162,130 176,135 190,125" fill="none" stroke={VL} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="290" y="220" width="110" height="36" rx="8" fill="rgba(124,58,237,0.1)" stroke="rgba(124,58,237,0.3)" strokeWidth="0.5"/>
      <text x="314" y="234" fontFamily="DM Sans, sans-serif" fontSize="9"  fontWeight="600" fill="#fff">Plata confirmata</text>
      <text x="314" y="246" fontFamily="DM Sans, sans-serif" fontSize="8"  fill="#6b7280">Ap. 4B — 850 RON</text>
    </svg>
  );
}

const HERO_WIN_L: number[][] = [[0.8,0.1,0.8],[0.1,0.8,0.1],[0.8,0.8,0.1],[0.1,0.8,0.8],[0.8,0.1,0.8],[0.1,0.8,0.8],[0.8,0.8,0.1]];
const HERO_WIN_R: number[][] = [[0.5,0.1,0.5],[0.5,0.5,0.1],[0.1,0.5,0.5],[0.5,0.1,0.5],[0.1,0.5,0.1],[0.5,0.5,0.1],[0.1,0.1,0.5]];
const HERO_WIN_SL: number[][] = [[0.4,0.2],[0.2,0.5],[0.5,0.2]];
const HERO_WIN_SR: number[][] = [[0.3,0.5],[0.5,0.2],[0.2,0.4]];

function HeroIllustration() {
  return (
    <svg viewBox="0 0 480 520" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <polygon points="140,380 240,320 240,120 140,180" fill="rgba(124,58,237,0.06)"  stroke="rgba(124,58,237,0.15)" strokeWidth="1"/>
      <polygon points="240,120 340,180 340,380 240,320" fill="rgba(124,58,237,0.10)"  stroke="rgba(124,58,237,0.15)" strokeWidth="1"/>
      <polygon points="140,180 240,120 340,180 240,240" fill="rgba(124,58,237,0.20)"  stroke={VL} strokeWidth="0.5"/>
      {HERO_WIN_L.map((cols,row) => cols.map((op,col) => (
        <rect key={`l${row}-${col}`} x={155+col*22} y={200+row*25} width="14" height="14" rx="2"
          fill={op>0.5?V:"rgba(0,0,0,0.5)"} opacity={op} stroke="rgba(124,58,237,0.15)" strokeWidth="0.5"/>
      )))}
      {HERO_WIN_R.map((cols,row) => cols.map((op,col) => (
        <rect key={`r${row}-${col}`} x={255+col*22} y={200+row*25} width="14" height="14" rx="2"
          fill={op>0.3?V:"rgba(0,0,0,0.5)"} opacity={op} stroke="rgba(124,58,237,0.15)" strokeWidth="0.5"/>
      )))}
      <polygon points="40,380  100,348 100,250  40,282"  fill="rgba(124,58,237,0.04)" stroke="rgba(124,58,237,0.1)" strokeWidth="0.5"/>
      <polygon points="100,250 160,282 160,380 100,348"  fill="rgba(124,58,237,0.07)" stroke="rgba(124,58,237,0.1)" strokeWidth="0.5"/>
      <polygon points="40,282  100,250 160,282 100,314"  fill="rgba(124,58,237,0.12)" stroke="rgba(124,58,237,0.1)" strokeWidth="0.5"/>
      {HERO_WIN_SL.map((cols,row) => cols.map((op,col) => (
        <rect key={`sl${row}-${col}`} x={52+col*28} y={298+row*22} width="12" height="12" rx="1" fill={V} opacity={op} stroke="rgba(124,58,237,0.15)" strokeWidth="0.5"/>
      )))}
      <polygon points="320,380 380,348 380,270 320,302"  fill="rgba(124,58,237,0.04)" stroke="rgba(124,58,237,0.1)" strokeWidth="0.5"/>
      <polygon points="380,270 440,302 440,380 380,348"  fill="rgba(124,58,237,0.07)" stroke="rgba(124,58,237,0.1)" strokeWidth="0.5"/>
      <polygon points="320,302 380,270 440,302 380,334"  fill="rgba(124,58,237,0.12)" stroke="rgba(124,58,237,0.1)" strokeWidth="0.5"/>
      {HERO_WIN_SR.map((cols,row) => cols.map((op,col) => (
        <rect key={`sr${row}-${col}`} x={332+col*28} y={318+row*20} width="12" height="10" rx="1" fill={V} opacity={op} stroke="rgba(124,58,237,0.15)" strokeWidth="0.5"/>
      )))}
      <line x1="0" y1="380" x2="480" y2="380" stroke="rgba(124,58,237,0.15)" strokeWidth="1"/>
      <rect x="20"  y="80"  width="130" height="72" rx="10" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
      <text x="36"  y="108" fontFamily="DM Sans, sans-serif" fontWeight="800" fontSize="26" fill="#fff">98%</text>
      <text x="36"  y="126" fontFamily="DM Sans, sans-serif" fontSize="9"   fill="#6b7280" letterSpacing="1">RATA OCUPARE</text>
      <rect x="36"  y="134" width="80" height="4" rx="2" fill="rgba(124,58,237,0.15)"/>
      <rect x="36"  y="134" width="76" height="4" rx="2" fill={VL}/>
      <rect x="330" y="60"  width="130" height="72" rx="10" fill="rgba(124,58,237,0.08)" stroke="rgba(124,58,237,0.25)" strokeWidth="0.5"/>
      <text x="346" y="88"  fontFamily="DM Sans, sans-serif" fontWeight="800" fontSize="26" fill={VL}>1.200</text>
      <text x="346" y="104" fontFamily="DM Sans, sans-serif" fontSize="9"   fill="#6b7280" letterSpacing="1">UNITATI ACTIVE</text>
      <path d="M150,152 Q240,80 330,132" fill="none" stroke={VL} strokeWidth="0.5" opacity="0.3" strokeDasharray="4,4"/>
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

const services = [
  { number: "01", title: "Administrare Financiara",       desc: "Colectam chiriile lunar, emitem liste de plata conforme legislatiei, gestionam fondul de rulment si furnizam rapoarte financiare detaliate. Zero intarzieri, zero erori contabile.", illustration: <IllustrationFinanciar /> },
  { number: "02", title: "Administrare Tehnica",          desc: "Coordonam lucrarile de intretinere, reparatii urgente si mentenanta preventiva prin mesteri autorizati. Fiecare interventie este documentata si raportata in timp real.", illustration: <IllustrationTehnic /> },
  { number: "03", title: "Suport Juridic si ANAF",        desc: "Redactam si gestionam contractele, asiguram reprezentarea in relatia cu ANAF, recuperam creantele restante si mediem conflictele dintre proprietari si chiriasi.", illustration: <IllustrationJuridic /> },
  { number: "04", title: "Platforma Digitala Proprietari",desc: "Acces 24/7 la dashboard-ul DecoImob: istoric plati, documente, sesizari si rapoarte lunare. Transparenta totala, in timp real, direct de pe telefon sau laptop.", illustration: <IllustrationDigital /> },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const [introVisible, setIntroVisible] = useState(true);
  const [pageIn,       setPageIn]       = useState(false);
  const [openFaq,      setOpenFaq]      = useState<number | null>(null);
  const [showOferta,   setShowOferta]   = useState(false);
  const [activeService,setActiveService]= useState<number | null>(null);
  const [showContact,  setShowContact]  = useState(false);
  const [contactForm,  setContactForm]  = useState({ nume: "", email: "", telefon: "", mesaj: "" });
  const [contactSent,  setContactSent]  = useState(false);

  const handleSplashDone = useCallback(() => {
    setPageIn(true);
    setTimeout(() => setIntroVisible(false), 1500);
  }, []);

  const closeContact = () => { setShowContact(false); setContactSent(false); };

  return (
    <>
      {/* ── Splash ── */}
      {introVisible && <SplashParticles onSkip={handleSplashDone} />}

      {/* ── Oferta modal ── */}
      {showOferta && <OfertaModal onClose={() => setShowOferta(false)} />}

      {/* ── Service detail panel ── */}
      {activeService !== null && (
        <>
          <div className="panel-overlay" onClick={() => setActiveService(null)} />
          <div className="panel">
            <div className="panel__header">
              <div className="panel__header-row">
                <div>
                  <p className="panel__label">{servicesDetail[activeService].number} — {servicesDetail[activeService].tag}</p>
                  <h2 className="panel__title">{servicesDetail[activeService].title}</h2>
                  <p className="panel__subtitle">{servicesDetail[activeService].subtitle}</p>
                </div>
                <button className="panel__close" onClick={() => setActiveService(null)}>×</button>
              </div>
            </div>
            <div className="panel__body">
              <p className="panel__intro">{servicesDetail[activeService].intro}</p>
              <p className="panel__items-label">Ce include acest serviciu</p>
              {servicesDetail[activeService].items.map((item, i) => (
                <div key={i} className="panel__item">
                  <span className="panel__check">✓</span>
                  <span className="panel__item-text">{item}</span>
                </div>
              ))}
              <div className="panel__cta-box">
                <p className="panel__cta-hint">Vrei sa afli pretul pentru imobilul tau?</p>
                <button className="btn btn--primary btn--full" onClick={() => { setActiveService(null); setShowOferta(true); }}>
                  Solicita oferta gratuita
                </button>
              </div>
              <div className="panel__nav">
                {activeService > 0 && (
                  <button className="panel__nav-btn" onClick={() => setActiveService(activeService - 1)}>
                    ← {servicesDetail[activeService - 1].title}
                  </button>
                )}
                {activeService < servicesDetail.length - 1 && (
                  <button className="panel__nav-btn" onClick={() => setActiveService(activeService + 1)}>
                    {servicesDetail[activeService + 1].title} →
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Contact panel ── */}
      {showContact && (
        <>
          <div className="panel-overlay" onClick={closeContact} />
          <div className="panel">
            <div className="panel__header">
              <div className="panel__header-row">
                <div>
                  <p className="panel__label">Contacteaza-ne</p>
                  <h2 className="panel__title">DecoImob SRL</h2>
                  <p className="panel__subtitle">Firma de administrare imobile Bucuresti</p>
                </div>
                <button className="panel__close" onClick={closeContact}>×</button>
              </div>
            </div>
            <div className="panel__body">
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.75rem" }}>
                {[
                  { icon: "📍", label: "Adresa",  val: "Str. Constantin Dobrogeanu Gherea 89, Sector 1, Bucuresti" },
                  { icon: "📞", label: "Telefon", val: "0756 362 828", href: "tel:+40756362828" },
                  { icon: "✉️", label: "Email",   val: "office@decoimob.ro", href: "mailto:office@decoimob.ro" },
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
                  <p className="contact-sent__sub">Te vom contacta in cel mai scurt timp.</p>
                </div>
              ) : (
                <div className="contact-form">
                  {[
                    { key: "nume",    label: "Numele tau *", placeholder: "ex: Ion Popescu",      type: "text" },
                    { key: "email",   label: "Email *",      placeholder: "ex: ion@email.com",    type: "email" },
                    { key: "telefon", label: "Telefon",      placeholder: "ex: 0756 362 828",     type: "tel" },
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
                      placeholder="Descrie imobilul tau si ce servicii te intereseaza..."
                      className="input"
                      value={contactForm.mesaj}
                      onChange={e => setContactForm(p => ({ ...p, mesaj: e.target.value }))}
                    />
                  </div>
                  <a
                    href={`mailto:office@decoimob.ro?subject=Solicitare contact — ${contactForm.nume}&body=Nume: ${contactForm.nume}%0AEmail: ${contactForm.email}%0ATelefon: ${contactForm.telefon}%0A%0AMesaj:%0A${contactForm.mesaj}`}
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
      <main className={`page-main${pageIn ? "" : " page-main--hidden"}`}>

        {/* ─ Header ─ */}
        <header className="header">
          <div className="header__inner">
            <Logo height={42} />
            <nav className="header__nav">
              <a href="#servicii">Servicii</a>
              <a href="#pachete">Pachete</a>
              <a href="#cum-lucram">Cum lucram</a>
              <a href="#faq">Intrebari</a>
              <button onClick={() => setShowContact(true)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: "inherit", fontFamily: "inherit" }}>Contact</button>
            </nav>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <a href="/login" className="btn btn--secondary" style={{ padding: "0.625rem 1.25rem", fontSize: "0.8125rem" }}>
                Conectare
              </a>
              <button className="btn btn--primary header__cta" onClick={() => setShowOferta(true)}>
                Solicita oferta
              </button>
            </div>
          </div>
          <nav className="header__mobile-nav">
            <a href="#servicii">Servicii</a>
            <a href="#pachete">Pachete</a>
            <a href="#cum-lucram">Cum lucram</a>
            <a href="#faq">Intrebari</a>
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
                  Firma de administrare imobile — Bucuresti si Ilfov
                </div>
                <h1 className="hero__title">
                  Administrare<br />
                  <span className="gradient">imobile</span> si<br />
                  blocuri, complet.
                </h1>
                <p className="hero__sub">
                  DecoImob este firma de administrare care preia complet gestionarea blocului sau imobilului tau — financiar, tehnic si juridic.
                </p>
                <p className="hero__note">
                  Peste 1.200 de unitati administrate in Bucuresti si Ilfov. 15 ani de property management profesional. Tu nu mai ai nicio grija.
                </p>
                <div className="hero__ctas">
                  <button className="btn btn--primary btn--lg" onClick={() => setShowOferta(true)}>
                    Solicita oferta gratuita
                  </button>
                  <a href="#servicii" className="btn btn--secondary btn--lg">
                    Descopera serviciile
                  </a>
                </div>
              </div>
              <div className="hero__illustration" style={{ opacity: pageIn ? 1 : 0, transform: pageIn ? "translateX(0)" : "translateX(40px)", transition: "all 1s ease 0.5s" }}>
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

        {/* ─ Services ─ */}
        <section id="servicii" className="section section--alt">
          <div className="container">
            <FadeIn>
              <div className="section-intro">
                <p className="section-label section-label--violet">Servicii complete</p>
                <h2 className="section-heading">
                  Tot ce include<br /><span className="gradient">administrarea imobilului tau</span>
                </h2>
                <p className="section-desc">
                  Ca firma de administrare blocuri si imobile rezidentiale in Bucuresti, acoperim fiecare aspect al property management-ului — de la primul euro colectat pana la ultima semnatura pe un contract.
                </p>
              </div>
            </FadeIn>
            <div className="services-grid">
              {services.map((s, i) => (
                <FadeIn key={s.number} delay={i * 0.1}>
                  <div className="service-card" onClick={() => setActiveService(i)}>
                    <div className="service-card__illustration">{s.illustration}</div>
                    <div className="service-card__body">
                      <p className="service-card__number">{s.number}</p>
                      <h3 className="service-card__title">{s.title}</h3>
                      <p className="service-card__desc">{s.desc}</p>
                      <span className="service-card__link">Afla mai multe →</span>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* ─ Why us ─ */}
        <section className="section">
          <div className="container">
            <div className="why-grid">
              <FadeIn>
                <div>
                  <p className="section-label section-label--violet">De ce DecoImob</p>
                  <h2 className="section-heading">
                    Nu suntem simpli administratori.<br />
                    Suntem <span className="gradient">parteneri pe termen lung.</span>
                  </h2>
                  <p className="section-desc">
                    In 15 ani de administrare imobile in Bucuresti, am invatat ca proprietarii nu au nevoie de scuze — au nevoie de rezultate. Rata noastra de colectare de 98% si zero blocuri pierdute din portofoliu vorbesc de la sine.
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

        {/* ─ Pachete ─ */}
        <section id="pachete" className="section section--alt">
          <div className="container">
            <FadeIn>
              <div className="section-intro section-intro--center">
                <p className="section-label section-label--violet">Pachete de administrare</p>
                <h2 className="section-heading">
                  Alege pachetul potrivit<br />
                  <span className="gradient">pentru imobilul tau</span>
                </h2>
                <p className="section-desc" style={{ margin: "1rem auto 0", textAlign: "center" }}>
                  Preturi transparente, fara costuri ascunse. Poti schimba oricand pachetul in functie de necesitati.
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
                      <span> lei/luna</span>
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
                    <button className="pricing-card__btn" onClick={() => setShowOferta(true)}>
                      Solicita {pkg.name}
                    </button>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* ─ How we work ─ */}
        <section id="cum-lucram" className="section section--alt">
          <div className="container">
            <FadeIn>
              <div className="section-intro section-intro--center">
                <p className="section-label section-label--cyan">Procesul de preluare</p>
                <h2 className="section-heading">
                  De la primul contact la<br /><span className="gradient">administrare activa in 3 pasi</span>
                </h2>
                <p className="section-desc" style={{ margin: "1rem auto 0", textAlign: "center" }}>
                  Preluarea unui imobil sau bloc in administrare dureaza maximum 48 de ore. Procesul nostru este simplu, transparent si fara birocratie inutila.
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

        {/* ─ FAQ ─ */}
        <section id="faq" className="section">
          <div className="container">
            <FadeIn>
              <div className="section-intro section-intro--center">
                <p className="section-label section-label--violet">Intrebari frecvente</p>
                <h2 className="section-heading">
                  Tot ce vrei sa stii despre<br /><span className="gradient">administrarea imobilelor</span>
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

        {/* ─ CTA ─ */}
        <section id="contact" className="cta-section section--alt">
          <div className="cta-section__glow" />
          <div className="container cta-section__inner">
            <FadeIn>
              <p className="section-label section-label--violet">Incepe administrarea profesionala</p>
              <h2 className="cta-section__title">
                Preda-ne administrarea.<br />
                Tu concentreaza-te<br />
                <span className="gradient">pe ce conteaza.</span>
              </h2>
              <p className="cta-section__sub">
                Fie ca ai un singur apartament, un bloc de 50 de unitati sau un portofoliu rezidential, DecoImob are solutia de property management potrivita pentru tine.
              </p>
              <p className="cta-section__note">
                Evaluare gratuita a imobilului in 24 de ore. Fara angajamente, fara costuri ascunse.
              </p>
              <div className="cta-section__btns">
                <button className="btn btn--primary btn--lg" onClick={() => setShowOferta(true)}>
                  Solicita oferta gratuita
                </button>
                <button className="btn btn--secondary btn--lg" onClick={() => setShowContact(true)}>
                  Contacteaza-ne
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
                  Firma de administrare imobile si blocuri in Bucuresti si Ilfov. Property management profesional din 2010.
                </p>
              </div>
              <div>
                <p className="footer__col-title">Servicii</p>
                <div className="footer__links">
                  {["Administrare imobile","Administrare blocuri","Property management","Suport juridic","Platforma digitala"].map(l => <span key={l}>{l}</span>)}
                </div>
              </div>
              <div>
                <p className="footer__col-title">Zona de activitate</p>
                <div className="footer__links">
                  {["Sector 1 Bucuresti","Sector 2 Bucuresti","Sector 3 Bucuresti","Sector 4-6 Bucuresti","Ilfov"].map(l => <span key={l}>{l}</span>)}
                </div>
              </div>
              <div>
                <p className="footer__col-title">Contact</p>
                <div className="footer__links">
                  <a href="mailto:office@decoimob.ro">office@decoimob.ro</a>
                  <a href="tel:+40756362828">0756 362 828</a>
                  <span>Str. C. D. Gherea 89</span>
                  <span>Sector 1, Bucuresti</span>
                </div>
              </div>
            </div>
            <div className="footer__bottom">
              <span>© 2026 DecoImob SRL — Firma de administrare imobile Bucuresti</span>
              <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
                {["GDPR","Termeni si conditii","Cookies","Politica de confidentialitate"].map(l => (
                  <a key={l} href="#" style={{ transition: "color 0.2s" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#d1d5db")}
                    onMouseLeave={e => (e.currentTarget.style.color = "")}
                  >{l}</a>
                ))}
              </div>
            </div>
          </div>
        </footer>

      </main>
    </>
  );
}
