"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useAsociatie } from "@/lib/AsociatieContext";
import { fullPerms, emptyPerms, type PermMap } from "@/lib/permissions";

interface AccessState {
  isAdmin: boolean;
  perms:   PermMap;
  ready:   boolean;
  can:     (key: string) => boolean;
}

const AccessContext = createContext<AccessState>({
  isAdmin: false, perms: emptyPerms(), ready: false, can: () => false,
});

export function AccessProvider({ initialIsAdmin, children }: { initialIsAdmin: boolean; children: React.ReactNode }) {
  const { activeId } = useAsociatie();
  const [isAdmin] = useState(initialIsAdmin);
  const [perms, setPerms] = useState<PermMap>(() => (initialIsAdmin ? fullPerms() : emptyPerms()));
  const [ready, setReady] = useState(initialIsAdmin);

  useEffect(() => {
    if (isAdmin) { setPerms(fullPerms()); setReady(true); return; }
    if (!activeId) { setPerms(emptyPerms()); setReady(false); return; }
    let alive = true;
    setReady(false);
    fetch(`/api/me/access?asociatieId=${activeId}`)
      .then(r => r.json())
      .then(d => { if (alive) { setPerms(d?.perms ?? emptyPerms()); setReady(true); } })
      .catch(() => { if (alive) { setPerms(emptyPerms()); setReady(true); } });
    return () => { alive = false; };
  }, [isAdmin, activeId]);

  const can = (key: string) => isAdmin || perms[key] === true;

  return (
    <AccessContext.Provider value={{ isAdmin, perms, ready, can }}>
      {children}
    </AccessContext.Provider>
  );
}

export function useAccess() {
  return useContext(AccessContext);
}
