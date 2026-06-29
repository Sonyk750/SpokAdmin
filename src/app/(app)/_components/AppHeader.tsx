"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAsociatie } from "@/lib/AsociatieContext";
import { useSidebar } from "@/lib/SidebarContext";

const titles: Record<string, string> = {
  "/dashboard":   "Dashboard",
  "/blocuri":     "Blocuri",
  "/apartamente": "Apartamente",
  "/persoane":    "Persoane",
  "/financiar":   "Financiar",
  "/contoare":    "Contoare",
  "/ai":          "AI Asistent",
  "/rapoarte":    "Rapoarte",
  "/setari":      "Setări",
};

export default function AppHeader({ userName, orgName }: { userName?: string | null; orgName?: string }) {
  const pathname = usePathname();
  const segment  = "/" + (pathname.split("/")[1] ?? "");
  const title    = titles[segment] ?? "SpokAdmin";

  const { asociatii, activeId, setActiveId } = useAsociatie();
  const { toggle } = useSidebar();
  const router = useRouter();

  return (
    <header className="app-header">
      <div className="app-header__left">
        <button className="hamburger" onClick={toggle} aria-label="Meniu">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
            <line x1="2" y1="5"  x2="18" y2="5" />
            <line x1="2" y1="10" x2="18" y2="10" />
            <line x1="2" y1="15" x2="18" y2="15" />
          </svg>
        </button>
        <h1 className="app-header__title">{title}</h1>
        {orgName && <span className="app-header__org">{orgName}</span>}
        {asociatii.length > 0 && (
          <div className="app-header__asoc">
            <span className="app-header__asoc-label">Asociație:</span>
            <select
              className="app-header__asoc-select"
              value={activeId}
              onChange={e => { setActiveId(e.target.value); router.refresh(); }}
            >
              {asociatii.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div className="app-header__right">
        <Link href="/profil" className="app-header__user" title="Profil" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="app-header__avatar">
            {userName?.[0]?.toUpperCase() ?? "U"}
          </div>
          <span className="app-header__name">{userName ?? "Utilizator"}</span>
        </Link>
      </div>
    </header>
  );
}
