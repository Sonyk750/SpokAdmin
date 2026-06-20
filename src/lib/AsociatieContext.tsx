"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface AsociatieItem { id: string; name: string; }

interface AsociatieCtx {
  asociatii:   AsociatieItem[];
  activeId:    string;
  activeName:  string;
  setActiveId: (id: string) => void;
}

const Ctx = createContext<AsociatieCtx>({
  asociatii:   [],
  activeId:    "",
  activeName:  "",
  setActiveId: () => {},
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

  useEffect(() => {
    const stored = localStorage.getItem("decoimob-asoc");
    if (stored && asociatii.some(a => a.id === stored)) {
      setActiveIdState(stored);
    }
  }, [asociatii]);

  function setActiveId(id: string) {
    setActiveIdState(id);
    try { localStorage.setItem("decoimob-asoc", id); } catch {}
  }

  const active = asociatii.find(a => a.id === activeId);

  return (
    <Ctx.Provider value={{ asociatii, activeId, activeName: active?.name ?? "", setActiveId }}>
      {children}
    </Ctx.Provider>
  );
}
