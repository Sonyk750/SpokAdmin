"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface AsociatieItem { id: string; name: string; }

interface AsociatieCtx {
  asociatii:      AsociatieItem[];
  activeId:       string;
  activeName:     string;
  primaListaLuna: number | null;
  primaListaAn:   number | null;
  setActiveId:    (id: string) => void;
}

const Ctx = createContext<AsociatieCtx>({
  asociatii:      [],
  activeId:       "",
  activeName:     "",
  primaListaLuna: null,
  primaListaAn:   null,
  setActiveId:    () => {},
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

  useEffect(() => {
    const stored = localStorage.getItem("spokadmin-asoc");
    if (stored && asociatii.some(a => a.id === stored)) {
      setActiveIdState(stored);
    }
  }, [asociatii]);

  // Fetchează primaListaLuna/An când se schimbă asociația activă
  useEffect(() => {
    if (!activeId) return;
    fetch(`/api/asociatii/${activeId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        setPrimaListaLuna(d?.primaListaLuna ?? null);
        setPrimaListaAn(d?.primaListaAn   ?? null);
      })
      .catch(() => {
        setPrimaListaLuna(null);
        setPrimaListaAn(null);
      });
  }, [activeId]);

  function setActiveId(id: string) {
    setActiveIdState(id);
    try { localStorage.setItem("spokadmin-asoc", id); } catch {}
  }

  const active = asociatii.find(a => a.id === activeId);

  return (
    <Ctx.Provider value={{ asociatii, activeId, activeName: active?.name ?? "", primaListaLuna, primaListaAn, setActiveId }}>
      {children}
    </Ctx.Provider>
  );
}
