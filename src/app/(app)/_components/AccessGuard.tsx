"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAccess } from "@/lib/AccessContext";
import { pathAllowed, firstAllowedPath } from "@/lib/navAccess";

// Blochează userii restricționați pe paginile la care nu au drept (defense-in-depth
// peste gating-ul din sidebar). Adminii trec mereu.
export default function AccessGuard({ children }: { children: React.ReactNode }) {
  const { isAdmin, ready, can } = useAccess();
  const pathname = usePathname();
  const router   = useRouter();

  const allowed = isAdmin || pathAllowed(pathname, isAdmin, can);

  useEffect(() => {
    if (isAdmin) return;
    if (!ready) return;
    if (!allowed) router.replace(firstAllowedPath(isAdmin, can));
  }, [isAdmin, ready, allowed, pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isAdmin) return <>{children}</>;
  if (!ready) {
    return <div style={{ padding: "2rem", color: "#94a3b8" }}>Se verifică drepturile…</div>;
  }
  if (!allowed) return null; // se face redirect
  return <>{children}</>;
}
