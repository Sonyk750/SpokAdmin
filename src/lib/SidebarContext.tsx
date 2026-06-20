"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface SidebarCtx { isOpen: boolean; toggle: () => void; close: () => void; }

const Ctx = createContext<SidebarCtx>({ isOpen: false, toggle: () => {}, close: () => {} });

export const useSidebar = () => useContext(Ctx);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <Ctx.Provider value={{ isOpen, toggle: () => setIsOpen(v => !v), close: () => setIsOpen(false) }}>
      {children}
    </Ctx.Provider>
  );
}
