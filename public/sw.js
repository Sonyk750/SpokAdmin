// Service worker minimal — FĂRĂ caching (evită servirea unei versiuni învechite a
// aplicației). Prezența unui handler de fetch face aplicația instalabilă ca PWA.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => { /* passthrough: lasă rețeaua să răspundă normal */ });
