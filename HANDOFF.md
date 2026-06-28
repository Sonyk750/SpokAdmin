# Handoff — continuare pe altă mașină

> Pe o sesiune Claude Code nouă (alt PC): `git pull`, apoi spune „citește HANDOFF.md și continuăm".
> Conversațiile Claude NU se sincronizează între mașini — acest fișier ține contextul.

## Unde stau proiectele (după mutarea din OneDrive — iunie 2026)
- Toate proiectele s-au mutat din `C:\Users\Octav\OneDrive\Projects\` în **`C:\Projects\`** (în afara OneDrive, ca să nu mai facă copii de conflict `-NUMEPC`).
- Sincronizarea între ASUS și PC se face prin **git/GitHub** (vezi `SYNC.md`).
- `.env`-urile NU sunt în git — se copiază manual pe fiecare mașină.

## Migrare — ce s-a făcut și ce a rămas
- [x] Clonat în `C:\Projects`: spokadmin, spokapp, spokinvoice, vosmart, spokloto49 (+ `.env` + `npm install`).
- [x] spokloto49 a primit repo GitHub nou (nu avea) + push (branch `master`).
- [x] **PC:** clonate toate 5 din GitHub în `C:\Projects` + copiat `.env` + `npm install`.
- [x] **Șters folderele din `OneDrive\Projects`** (28 iun 2026) — verificat înainte: toate repo-urile din `C:\Projects` sincronizate cu origin, fără commit-uri nepush-uite, toate `.env`-urile prezente. Folderul `OneDrive\Projects` e acum gol. Migrarea OneDrive → `C:\Projects` e completă.

## Context spokadmin (aplicația la care lucrăm)
SaaS administrare asociații (Next.js 16 + Prisma + Neon prod unic; deploy Vercel pe push `main`).
Lucru recent pe **facturi + distribuire AI + fonduri**:
- Distribuire automată factură cu AI (Opus 4.8 citește PDF), memorie per furnizor de tip **template** de coloane (ex. APA NOVA → „Apă rece" + „Apă meteo").
- Tabel Facturi: coloană „Data emiterii" (format RO zz/ll/aaaa), „Status distribuire" (lună verde = distribuită / sumă roșie = rest de distribuit / „nedistribuit" / „din fond").
- **Fond pe factură** (`Factura.fondId`): „Acopăr factura dintr-un fond" = alocare (scade fondul, nu se distribuie), DAR statusul rămâne neplătită; plata reală se face separat din casă/bancă.

Note de mediu/memorie utile sunt în `C:\Users\Octav\.claude\projects\...\memory\` pe ASUS (nu se mută automat).
