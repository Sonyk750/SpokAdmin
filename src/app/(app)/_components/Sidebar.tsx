"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import { useSidebar } from "@/lib/SidebarContext";
import { useAsociatie } from "@/lib/AsociatieContext";

// ─── Nav structure ────────────────────────────────────────────────────────────

type Leaf  = { type: "link";  href: string; label: string; badge?: "mesaje" };
type Label = { type: "label"; label: string };
type Group = { type: "group"; label: string; key: string; children: (Leaf | Label)[] };
type Item  = Leaf | Group;

const nav: Item[] = [
  { type: "link",  href: "/dashboard",         label: "Dashboard" },
  { type: "link",  href: "/asociatii",          label: "Asociații" },
  { type: "link",  href: "/setari-asociatie",   label: "Setări asociație" },
  { type: "link",  href: "/facturi",            label: "Facturi" },
  { type: "link",  href: "/incasari",           label: "Încasări" },
  { type: "link",  href: "/mesaje",             label: "Mesaje", badge: "mesaje" },
  {
    type: "group", label: "Rapoarte", key: "rapoarte",
    children: [
      { type: "link",  href: "/rapoarte/lista-intretinere",   label: "Lista de plată" },
      { type: "link",  href: "/rapoarte/explicatii-lista",    label: "Explicații listă" },
      { type: "label", label: "REGISTRE" },
      { type: "link",  href: "/rapoarte/incasari",            label: "Încasări" },
      { type: "link",  href: "/rapoarte/registru-plati",      label: "Plăți" },
      { type: "link",  href: "/rapoarte/registru-casa",       label: "Casă" },
      { type: "link",  href: "/rapoarte/registru-banca",      label: "Bancă" },
      { type: "link",  href: "/rapoarte/registru-jurnal",     label: "Jurnal" },
      { type: "link",  href: "/rapoarte/fonduri",             label: "Fonduri" },
      { type: "label", label: "SITUAȚII" },
      { type: "link",  href: "/rapoarte/restantieri",         label: "Restanțieri" },
      { type: "link",  href: "/rapoarte/fisa-proprietar",     label: "Fișă proprietar" },
      { type: "link",  href: "/rapoarte/fisa-furnizor",       label: "Fișă furnizor" },
      { type: "link",  href: "/rapoarte/venituri-cheltuieli", label: "Venituri și cheltuieli" },
    ],
  },
  {
    type: "group", label: "Salarii", key: "salarii",
    children: [
      { type: "label", label: "LUNAR" },
      { type: "link",  href: "/salarii/state-de-plata",  label: "State de plată" },
      { type: "link",  href: "/salarii/op-buget-stat",   label: "OP buget de stat" },
      { type: "link",  href: "/salarii/declaratii",      label: "Declarații D112" },
      { type: "label", label: "SETĂRI" },
      { type: "link",  href: "/salarii/angajati",        label: "Angajați" },
    ],
  },
  {
    type: "group", label: "Transferuri", key: "transferuri",
    children: [
      { type: "link", href: "/transferuri/intre-conturi", label: "Între conturi" },
      { type: "link", href: "/transferuri/intre-fonduri", label: "Între fonduri" },
    ],
  },
  {
    type: "group", label: "Contoare", key: "contoare",
    children: [
      { type: "label", label: "CITIRI" },
      { type: "link",  href: "/contoare/citiri",  label: "Citiri manuale" },
      { type: "link",  href: "/contoare/import",  label: "Import citiri" },
      { type: "link",  href: "/contoare/istoric", label: "Istoric citiri" },
      { type: "label", label: "GESTIONARE" },
      { type: "link",  href: "/contoare/aparate", label: "Aparate înregistrate" },
    ],
  },
  {
    type: "group", label: "AI Asistent", key: "ai",
    children: [
      { type: "label", label: "PROCESARE" },
      { type: "link",  href: "/ai/facturi", label: "Facturi furnizori" },
      { type: "link",  href: "/ai/citiri",  label: "Import citiri AI" },
      { type: "label", label: "SETĂRI AI" },
      { type: "link",  href: "/ai/modele",  label: "Modele distribuție" },
      { type: "link",  href: "/ai/istoric", label: "Istoric procesări" },
    ],
  },
  {
    type: "group", label: "SPV / e-Factură", key: "spv",
    children: [
      { type: "link",  href: "/spv/conectare",          label: "Conectare SPV" },
      { type: "link",  href: "/spv/facturi-primite",    label: "Facturi primite" },
      { type: "link",  href: "/spv/facturi-emise",      label: "Facturi emise" },
      { type: "link",  href: "/spv/declaratii-fiscale", label: "Declarații fiscale" },
      { type: "link",  href: "/spv/jurnal-anaf",        label: "Jurnal ANAF" },
      { type: "link",  href: "/spv/setari",             label: "Setări SPV" },
    ],
  },
  {
    type: "group", label: "Utilizatori", key: "utilizatori",
    children: [
      { type: "link", href: "/utilizatori",            label: "Corporate" },
      { type: "link", href: "/utilizatori/asociatie",  label: "Asociație" },
      { type: "link", href: "/utilizatori/drepturi",   label: "Drepturi & roluri" },
    ],
  },
  { type: "link", href: "/initializare", label: "Inițializare" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function Sidebar({
  userRole = "USER",
  canManageUsers = false,
}: {
  userRole?: string
  canManageUsers?: boolean
}) {
  const pathname  = usePathname();
  const { isOpen, close } = useSidebar();
  const { activeId } = useAsociatie();
  const [furnizorCitiri, setFurnizorCitiri] = useState<string>("");

  useEffect(() => {
    if (!activeId) return;
    try {
      const v = localStorage.getItem(`furnizorCitiri-${activeId}`) ?? "";
      setFurnizorCitiri(v);
    } catch { setFurnizorCitiri(""); }
  }, [activeId]);

  const defaultOpen = nav
    .filter((i): i is Group => i.type === "group")
    .filter(g => g.children.some(c => c.type === "link" && pathname.startsWith((c as Leaf).href)))
    .map(g => g.key);

  const [open, setOpen] = useState<string[]>(defaultOpen);

  function toggle(key: string) {
    setOpen(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && <div className="sidebar-overlay" onClick={close} aria-hidden />}

      <aside className={`sidebar${isOpen ? " sidebar--open" : ""}`}>
        <div className="sidebar__brand">
          <Link href="/dashboard" className="sidebar__brand-link" onClick={close}>
            <span className="sidebar__brand-dot" />
            <span className="sidebar__brand-name">Administrare</span>
          </Link>
        </div>

        <nav className="sidebar__nav">
          {nav.map((item) => {
            if (item.type === "link") {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`snav-link${item.badge ? " snav-link--flex" : ""}${isActive(item.href) ? " snav-link--active" : ""}`}
                  onClick={close}
                >
                  <span>{item.label}</span>
                  {item.badge === "mesaje" && <MesajeBadge />}
                </Link>
              );
            }

            const isOpen = open.includes(item.key);
            return (
              <div key={item.key} className="snav-group">
                <button
                  className="snav-group__header"
                  onClick={() => toggle(item.key)}
                  aria-expanded={isOpen}
                >
                  <span>{item.label}</span>
                  <span className={`snav-group__arrow${isOpen ? " snav-group__arrow--open" : ""}`}>▲</span>
                </button>
                {isOpen && (
                  <div className="snav-group__body">
                    {item.children.map((child, ci) => {
                      if (child.type === "label") {
                        return <span key={`${item.key}-label-${ci}`} className="snav-section-label">{child.label}</span>;
                      }
                      const dynLabel = child.href === "/contoare/import" && furnizorCitiri
                        ? `Import ${furnizorCitiri.charAt(0).toUpperCase() + furnizorCitiri.slice(1)}`
                        : child.label;
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={`snav-sub${isActive(child.href) ? " snav-sub--active" : ""}`}
                          onClick={close}
                        >
                          {dynLabel}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="sidebar__footer">
          <Link
            href="/ajutor"
            onClick={close}
            className={`snav-help${isActive("/ajutor") ? " snav-help--active" : ""}`}
          >
            <span style={{ fontSize: "1rem" }}>❓</span>
            <span>Ghid de utilizare</span>
          </Link>
          <button onClick={() => signOut({ callbackUrl: "/login" })} className="snav-logout">
            Logout
          </button>
          <BnrWidget />
          <div className="snav-legal">
            <Link href="/legal/termeni" onClick={close}>Termeni și condiții</Link>
            <Link href="/legal/confidentialitate" onClick={close}>Confidențialitate (GDPR)</Link>
          </div>
        </div>
      </aside>
    </>
  );
}

// ─── Badge mesaje necitite ──────────────────────────────────────────────────

function MesajeBadge() {
  const { activeId } = useAsociatie();
  const pathname = usePathname();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!activeId) { setCount(0); return; }
    let alive = true;
    const load = () => {
      fetch(`/api/mesaje/unread?asociatieId=${activeId}`)
        .then(r => r.json())
        .then(d => { if (alive) setCount(d.unread ?? 0); })
        .catch(() => {});
    };
    load();
    const t = setInterval(load, 30000);
    return () => { alive = false; clearInterval(t); };
  }, [activeId, pathname]);

  if (count <= 0) return null;
  return <span className="snav-badge">{count > 99 ? "99+" : count}</span>;
}

// ─── BNR Widget ───────────────────────────────────────────────────────────────

function BnrWidget() {
  const [rates,    setRates]    = useState<{ code: string; value: number }[]>([]);
  const [date,     setDate]     = useState("");
  const [amount,   setAmount]   = useState("1");
  const [currency, setCurrency] = useState("EUR");
  const [mode,     setMode]     = useState<"toLei" | "fromLei">("toLei");
  const [result,   setResult]   = useState("");

  useEffect(() => {
    fetch("/api/bnr")
      .then(r => r.json())
      .then(d => {
        setRates((d.rates ?? []).map((r: any) => ({ code: r.code, value: parseFloat(r.value) })));
        setDate(d.date ?? "");
      })
      .catch(() => {});
  }, []);

  function calc() {
    const rate = rates.find(r => r.code === currency);
    if (!rate) { setResult("Curs indisponibil"); return; }
    const n = parseFloat(amount) || 0;
    if (mode === "toLei") {
      setResult(`${n.toFixed(2)} ${currency} = ${(n * rate.value).toFixed(2)} LEI`);
    } else {
      setResult(`${n.toFixed(2)} LEI = ${(n / rate.value).toFixed(2)} ${currency}`);
    }
  }

  if (!rates.length) return null;

  return (
    <div className="bnr-widget">
      <div className="bnr-widget__header">
        <span className="bnr-widget__title">Curs BNR</span>
        <span className="bnr-widget__date">Data curs: {date}</span>
      </div>
      <div className="bnr-widget__rates">
        {rates.map(r => (
          <div key={r.code} className="bnr-widget__row">
            <span className="bnr-widget__code">{r.code}</span>
            <span className="bnr-widget__val">{r.value.toFixed(4)}</span>
          </div>
        ))}
      </div>
      <div className="bnr-widget__calc-title">Calculator</div>
      <div className="bnr-widget__calc">
        <input className="bnr-widget__input" type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
        <select className="bnr-widget__input" value={currency} onChange={e => setCurrency(e.target.value)}>
          {rates.map(r => <option key={r.code} value={r.code}>{r.code}</option>)}
        </select>
        <select className="bnr-widget__input" value={mode} onChange={e => setMode(e.target.value as any)}>
          <option value="toLei">Valută → Lei</option>
          <option value="fromLei">Lei → Valută</option>
        </select>
        <button className="bnr-widget__btn" type="button" onClick={calc}>Schimbă</button>
      </div>
      {result && <div className="bnr-widget__result">{result}</div>}
    </div>
  );
}
