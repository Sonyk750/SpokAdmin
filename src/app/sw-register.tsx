"use client";

import { useEffect } from "react";

// Înregistrează service worker-ul (instalabilitate PWA). Eșecul e ignorat silențios.
export default function SwRegister() {
  useEffect(() => {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
