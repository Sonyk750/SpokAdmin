"use client";

import React from "react";
import { useAsociatie } from "@/lib/AsociatieContext";

/**
 * Remontează conținutul paginii când se schimbă asociația activă din header.
 * Prin schimbarea `key`-ului, React demontează și remontează tot subarborele:
 * starea locală se resetează și efectele de încărcare rulează din nou — așa că
 * orice pagină afișează imediat datele asociației nou-selectate, fără refresh.
 */
export default function AsociatieScope({ children }: { children: React.ReactNode }) {
  const { activeId } = useAsociatie();
  return <React.Fragment key={activeId || "__none__"}>{children}</React.Fragment>;
}
