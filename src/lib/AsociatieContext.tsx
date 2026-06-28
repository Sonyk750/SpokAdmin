"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

interface AsociatieItem { id: string; name: string; }

interface AsociatieCtx {
  asociatii:           AsociatieItem[];
  activeId:            string;
  activeName:          string;
  primaListaLuna:      number | null;
  primaListaAn:        number | null;
  perioadaCurentaLuna: number | null;
  perioadaCurentaAn:   number | null;
  setActiveId:         (id: string) => void;
  refreshPerioada:     () => void;
}

const Ctx = createContext<AsociatieCtx>({
  asociatii:           [],
  activeId:            "",
  activeName:          "",
  primaListaLuna:      null,
  primaListaAn:        null,
  perioadaCurentaLuna: null,
  perioadaCurentaAn:   null,
  setActiveId:         () => {},
  refreshPerioada:     () => {},
});

export function useAsociatie() { return useContext(Ctx); }

export function AsociatieProvider({
  asociatii,
  children,
}: {
  asociatii: AsociatieItem[];
  children:  ReactNode;
}) {
  const [activeId, setActiveIdState] = useState<string>(asociatii[0]?.id ?? "");
  const [primaListaLuna, setPrimaListaLuna] = useState<number | null>(null);
  const [primaListaAn,   setPrimaListaAn]   = useState<number | null>(null);
  const [perioadaCurentaLuna, setPerioadaCurentaLuna] = useState<number | null>(null);
  const [perioadaCurentaAn,   setPerioadaCurentaAn]   = useState<number | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("spokadmin-asoc");
    if (stored && asociatii.some(a => a.id === stored)) {
      setActiveIdState(stored);
    }
  }, [asociatii]);

  // Fetchează prima listă + perioada curentă pentru asociația activă
  const loadMeta = useCallback((id: string) => {
    if (!id) return;
    fetch(`/api/asociatii/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        setPrimaListaLuna(d?.primaListaLuna ?? null);
        setPrimaListaAn(d?.primaListaAn   ?? null);
        setPerioadaCurentaLuna(d?.perioadaCurentaLuna ?? null);
        setPerioadaCurentaAn(d?.perioadaCurentaAn   ?? null);
      })
      .catch(() => {
        setPrimaListaLuna(null); setPrimaListaAn(null);
        setPerioadaCurentaLuna(null); setPerioadaCurentaAn(null);
      });
  }, []);

  useEffect(() => { loadMeta(activeId); }, [activeId, loadMeta]);

  function setActiveId(id: string) {
    setActiveIdState(id);
    try { localStorage.setItem("spokadmin-asoc", id); } catch {}
  }

  const refreshPerioada = useCallback(() => loadMeta(activeId), [activeId, loadMeta]);

  const active = asociatii.find(a => a.id === activeId);

  return (
    <Ctx.Provider value={{
      asociatii, activeId, activeName: active?.name ?? "",
      primaListaLuna, primaListaAn, perioadaCurentaLuna, perioadaCurentaAn,
      setActiveId, refreshPerioada,
    }}>
      {children}
    </Ctx.Provider>
  );
}
