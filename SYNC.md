# Sincronizare între laptop (ASUS) și PC

Proiectul **nu** mai stă în OneDrive. Sincronizarea se face prin **git/GitHub**.
Locația proiectului pe fiecare mașină: `C:\Projects\spokadmin`

## Rutina zilnică

**Când ÎNCEPI lucrul** (pe orice mașină):
```
git pull
```

**Când TERMINI lucrul:**
```
git add -A
git commit -m "ce am modificat"
git push
```

Astfel: lucrezi pe ASUS → `push`. Treci pe PC → `pull` → ai tot. Și invers.

## Configurare inițială pe o mașină NOUĂ (o singură dată)

```
git clone https://github.com/Sonyk750/SpokAdmin.git C:\Projects\spokadmin
cd C:\Projects\spokadmin
npm install
```
Apoi copiezi manual fișierul **`.env.local`** (cheile + parola bazei de date) — NU e în git.

## Unde sunt datele (backup)

| Ce | Unde | Sigur la pierderea PC-urilor |
|---|---|---|
| Codul | GitHub (ce ai pushuit) | ✅ |
| Datele aplicației (facturi, asociații…) | Neon (cloud) | ✅ |
| `.env.local` (chei) | doar pe mașinile tale | ⚠️ ține o copie separată |

## Reguli
- Nu lucra pe ambele mașini simultan fără pull/push între.
- Fă `push` des — doar ce e pushuit ajunge pe cealaltă mașină / pe GitHub.
- Dacă apare un „conflict" la `git pull`, cere ajutor — se rezolvă ușor.
