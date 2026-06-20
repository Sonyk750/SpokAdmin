"use client";

import { useState } from "react";

interface FormData {
  numeAsociatie: string;
  oras: string;
  sector: string;
  strada: string;
  email: string;
  nrApartamente: string;
  nrEtaje: string;
  pachet: string;
  mentenanta: boolean;
}

const PRET = {
  mic:   { liste: 50,  contabil: 70,  complet: 90,  mentenanta: 40 },
  mediu: { liste: 70,  contabil: 90,  complet: 110, mentenanta: 50 },
};

function getPret(nrAp: number, pachet: string, mentenanta: boolean) {
  const tier = nrAp >= 1 && nrAp <= 20 ? "mic" : nrAp > 20 && nrAp <= 40 ? "mediu" : null;
  if (!tier) return null;
  const p = PRET[tier][pachet as keyof typeof PRET.mic] || 0;
  const m = mentenanta ? PRET[tier].mentenanta : 0;
  return { pret: p, mentenanta: m, total: p + m, range: tier === "mic" ? "1-20" : "20-40" };
}

function generatePDFHTML(form: FormData): string {
  const nrAp = parseInt(form.nrApartamente) || 0;
  const pretInfo = getPret(nrAp, form.pachet, form.mentenanta);
  const pachetLabel = form.pachet === "liste" ? "LISTE" : form.pachet === "contabil" ? "CONTABIL" : "COMPLET";
  const isPersonalizata = nrAp > 40;
  const today = new Date().toLocaleDateString("ro-RO", { day: "2-digit", month: "long", year: "numeric" });

  const ck = `<span style="color:#1D6FD8;font-weight:700;font-size:14px;">&#10003;</span>`;
  const ds = `<span style="color:#CBD5E1;">—</span>`;
  const ckG = `<span style="color:#22C55E;font-weight:700;font-size:14px;">&#10003;</span>`;

  return `<!DOCTYPE html>
<html lang="ro">
<head>
<meta charset="UTF-8"/>
<title>Oferta DecoImob — ${form.numeAsociatie || "Asociatie"}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Arial',sans-serif;font-size:12px;color:#1a1a1a;background:#f0f4fa;}
.page{max-width:820px;margin:0 auto;padding:0 0 40px;background:#fff;}
.header{display:flex;justify-content:space-between;align-items:center;background:linear-gradient(135deg,#0A1628 0%,#0F2040 100%);padding:32px 48px;border-bottom:4px solid #1D6FD8;}
.logo-text{font-size:34px;font-weight:900;letter-spacing:-1px;color:#fff;}
.logo-text span{color:#3B8EF0;}
.logo-sub{font-size:9px;letter-spacing:4px;color:rgba(255,255,255,0.35);text-transform:uppercase;margin-top:3px;}
.header-right{text-align:right;font-size:11px;color:rgba(255,255,255,0.55);line-height:2;}
.header-right strong{color:#fff;font-size:13px;display:block;}
.body{padding:40px 48px;}
.doc-title{font-size:28px;font-weight:900;color:#0A1628;margin-bottom:6px;letter-spacing:-0.5px;}
.doc-sub{font-size:13px;color:#6B7280;margin-bottom:24px;}
.atentia{background:linear-gradient(135deg,#EFF6FF,#DBEAFE);border-left:5px solid #1D6FD8;padding:16px 20px;border-radius:0 10px 10px 0;margin-bottom:28px;}
.atentia-label{font-size:10px;color:#6B7280;margin-bottom:4px;text-transform:uppercase;letter-spacing:2px;}
.atentia-name{font-size:16px;color:#0A1628;font-weight:900;}
.atentia-sub{font-size:11px;color:#1D6FD8;font-weight:600;margin-top:4px;}
.section-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#1D6FD8;margin-bottom:12px;margin-top:28px;padding-bottom:6px;border-bottom:2px solid #DBEAFE;}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px 20px;margin-bottom:8px;}
.fw{background:#F8FAFF;border-radius:8px;padding:10px 14px;border:1px solid #E0EAFF;}
.fl{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#9CA3AF;margin-bottom:3px;}
.fv{font-size:12px;font-weight:700;color:#0A1628;}

/* TABEL */
.ct{width:100%;border-collapse:collapse;margin:14px 0 20px;font-size:11px;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(29,111,216,0.1);}
.ct th{background:#1D6FD8;color:white;padding:11px 12px;text-align:center;font-size:10px;letter-spacing:1.5px;font-weight:700;}
.ct th:first-child{text-align:left;background:#0A1628;padding-left:16px;width:38%;}
.ct td{padding:8px 12px;border-bottom:1px solid #EFF6FF;text-align:center;vertical-align:middle;}
.ct td:first-child{text-align:left;font-size:10px;color:#374151;background:#F8FAFF;padding-left:16px;font-weight:500;}
.ct tr:nth-child(even) td{background:#F0F7FF;}
.ct tr:nth-child(even) td:first-child{background:#EBF4FF;}
.sep td{background:linear-gradient(90deg,#1D4ED8,#0F2040)!important;color:white!important;font-weight:700;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;padding:9px 16px!important;text-align:left!important;}
.sep-green td{background:linear-gradient(90deg,#15803D,#14532D)!important;color:white!important;font-weight:700;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;padding:9px 16px!important;text-align:left!important;}
.pret-row td{font-weight:800;font-size:13px;background:linear-gradient(135deg,#0A1628,#0F2040)!important;color:#60A5FA;padding:14px 12px;border-top:2px solid #1D6FD8;}
.pret-row td:first-child{color:rgba(255,255,255,0.45);font-size:9px;font-weight:400;letter-spacing:1.5px;}

/* PACHET ALES */
.pachet-box{background:linear-gradient(135deg,#1D6FD8,#0A1628);color:white;border-radius:12px;padding:22px 28px;margin:16px 0;box-shadow:0 4px 20px rgba(29,111,216,0.25);}
.pachet-name{font-size:22px;font-weight:900;margin-bottom:4px;}
.pachet-desc{font-size:11px;opacity:0.65;}
.pret-box{display:flex;justify-content:space-between;align-items:center;background:linear-gradient(135deg,#EFF6FF,#DBEAFE);border:2px solid #1D6FD8;border-radius:12px;padding:18px 28px;margin:12px 0 20px;box-shadow:0 2px 8px rgba(29,111,216,0.1);}
.pret-left p{font-size:11px;color:#6B7280;margin-bottom:3px;}
.pret-left strong{font-size:13px;color:#0A1628;font-weight:700;}
.pret-amount{font-size:44px;font-weight:900;color:#1D6FD8;letter-spacing:-2px;line-height:1;text-align:right;}
.pret-period{font-size:10px;color:#9CA3AF;text-align:right;margin-top:3px;}

/* SERVICII BLOCKS */
.sb{margin-bottom:14px;border:1px solid #DBEAFE;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(29,111,216,0.06);}
.sb-header{background:linear-gradient(90deg,#EFF6FF,#F8FAFF);border-bottom:1px solid #DBEAFE;padding:12px 16px;display:flex;align-items:center;gap:10px;}
.sb-num{background:#1D6FD8;color:white;font-size:9px;font-weight:700;width:26px;height:26px;border-radius:6px;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 2px 4px rgba(29,111,216,0.3);}
.sb-name{font-size:13px;font-weight:700;color:#0A1628;}
.sb-body{padding:14px 16px;background:#fff;}
.sb-body ul{list-style:none;display:grid;grid-template-columns:1fr 1fr;gap:0 16px;}
.sb-body ul.single{grid-template-columns:1fr;}
.sb-body ul li{font-size:11px;color:#374151;padding:5px 0;border-bottom:1px solid #F3F4F6;display:flex;gap:6px;align-items:flex-start;line-height:1.5;}
.sb-body ul li::before{content:"›";color:#1D6FD8;font-weight:900;flex-shrink:0;font-size:14px;line-height:1.3;}

/* MENTENANTA BLOCK — verde */
.mb{margin-bottom:14px;border:1px solid #86EFAC;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(34,197,94,0.1);}
.mb .sb-header{background:linear-gradient(90deg,#F0FDF4,#DCFCE7);border-bottom:1px solid #BBF7D0;}
.mb .sb-num{background:#22C55E;box-shadow:0 2px 4px rgba(34,197,94,0.3);}
.mb .sb-name{color:#14532D;}
.mb .sb-body{background:#F7FEF9;}
.mb .sb-body ul li{border-bottom:1px solid #DCFCE7;}
.mb .sb-body ul li::before{color:#22C55E;}

/* BENEFICII */
.beneficii{background:linear-gradient(135deg,#EFF6FF,#DBEAFE);border-radius:10px;padding:18px 22px;margin-top:16px;border:1px solid #BFDBFE;}
.ben-title{font-size:10px;font-weight:700;color:#1D6FD8;text-transform:uppercase;letter-spacing:2px;margin-bottom:12px;}
.beneficii ul{list-style:none;display:grid;grid-template-columns:1fr 1fr;gap:5px 20px;}
.beneficii ul li{font-size:11px;color:#1E40AF;display:flex;gap:8px;align-items:center;font-weight:500;padding:3px 0;}
.beneficii ul li::before{content:"★";color:#1D6FD8;font-size:9px;flex-shrink:0;}

.nota{background:linear-gradient(135deg,#FFFBEB,#FEF3C7);border:1px solid #FCD34D;border-radius:8px;padding:14px 18px;font-size:10px;color:#78350F;line-height:1.8;margin-top:14px;}

/* PERSONALIZATA */
.pers{background:linear-gradient(135deg,#EFF6FF,#DBEAFE);border:2px solid #1D6FD8;border-radius:14px;padding:36px;text-align:center;margin:20px 0;}
.pers h3{font-size:22px;font-weight:900;color:#0A1628;margin-bottom:10px;}
.pers p{font-size:12px;color:#4B5563;line-height:1.7;margin-bottom:20px;}
.contact-grid{display:flex;gap:16px;justify-content:center;}
.contact-pill{background:#1D6FD8;color:white;padding:11px 22px;border-radius:8px;font-size:12px;font-weight:700;}

.footer{margin:32px 0 0;padding:16px 20px;background:linear-gradient(135deg,#0A1628,#0F2040);border-radius:10px;display:flex;justify-content:space-between;align-items:center;font-size:9px;color:rgba(255,255,255,0.45);}
.footer strong{color:#60A5FA;}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;background:#fff!important;}}
</style>
</head>
<body>
<div class="page">

<div class="header">
  <div>
    <div class="logo-text">Deco<span>Imob</span></div>
    <div class="logo-sub">Property Management</div>
  </div>
  <div class="header-right">
    <strong>DecoImob SRL</strong>
    office@decoimob.ro<br/>
    0756 362 828<br/>
    Str. C.D. Gherea 89, Sector 1, Bucuresti<br/>
    Data: ${today}
  </div>
</div>

<div class="body">

<div class="doc-title">Oferta de administrare imobile</div>
<div class="doc-sub">Oferta personalizata pentru ${form.numeAsociatie || "Asociatia dumneavoastra"}</div>

<div class="atentia">
  <div class="atentia-label">In atentia</div>
  <div class="atentia-name">${form.numeAsociatie || "Asociatia de Proprietari"}</div>
  ${form.strada ? `<div style="font-size:11px;color:#555;margin-top:3px;">${form.strada}${form.sector ? ", " + form.sector : ""}, ${form.oras}</div>` : ""}
  ${form.nrApartamente ? `<div class="atentia-sub">Oferta pentru ${form.nrApartamente} apartamente</div>` : ""}
</div>

<div class="section-title">Date asociatie</div>
<div class="grid2">
  <div class="fw"><div class="fl">Numele asociatiei</div><div class="fv">${form.numeAsociatie || "—"}</div></div>
  <div class="fw"><div class="fl">Email contact</div><div class="fv">${form.email || "—"}</div></div>
  <div class="fw"><div class="fl">Localitate</div><div class="fv">${form.oras || "—"}${form.sector ? ", " + form.sector : ""}</div></div>
  <div class="fw"><div class="fl">Numar apartamente</div><div class="fv">${form.nrApartamente || "—"} apartamente</div></div>
  <div class="fw"><div class="fl">Adresa imobil</div><div class="fv">${form.strada || "—"}</div></div>
  ${form.nrEtaje ? `<div class="fw"><div class="fl">Etaje</div><div class="fv">${form.nrEtaje} etaje</div></div>` : ""}
</div>

<div class="section-title">Comparatie pachete disponibile</div>
<table class="ct">
  <thead>
    <tr>
      <th>SERVICIU</th>
      <th>LISTE</th>
      <th>CONTABIL</th>
      <th>COMPLET</th>
      <th>MENTENANTA</th>
    </tr>
  </thead>
  <tbody>
    <tr class="sep"><td colspan="5">Servicii financiare si contabile</td></tr>
    ${["LISTE DE PLATA","PLATI FURNIZORI","REGISTRU CASA","REGISTRU FOND RULMENT","REGISTRU BANCA","REGISTRU JURNAL","ALTE REGISTRE","ALTE RAPOARTE","ORDINE DE PLATA","DECLARATII FISCALE","ACCES APLICATIE","ACCES CLOUD","ACCES ARHIVA ELECTRONICA"].map(s =>
      `<tr><td>${s}</td><td>${ck}</td><td>${ck}</td><td>${ck}</td><td>${ds}</td></tr>`
    ).join("")}
    <tr class="sep"><td colspan="5">Casierie si relatii proprietari</td></tr>
    <tr><td>CASIERIE</td><td>${ds}</td><td>${ck}</td><td>${ck}</td><td>${ds}</td></tr>
    <tr><td>INTERFATA CU PROPRIETARII</td><td>${ds}</td><td>${ck}</td><td>${ck}</td><td>${ds}</td></tr>
    <tr><td>ASISTENTA JURIDICA</td><td>${ds}</td><td>${ds}</td><td>${ck}</td><td>${ds}</td></tr>
    <tr class="sep"><td colspan="5">Administrare tehnica — inclus in Pachet COMPLET</td></tr>
    <tr><td>MONITORIZARE TEHNICA</td><td>${ds}</td><td>${ds}</td><td>${ck}</td><td>${ds}</td></tr>
    <tr><td>ASISTENTA TEHNICA</td><td>${ds}</td><td>${ds}</td><td>${ck}</td><td>${ds}</td></tr>
    <tr><td>MICI LUCRARI INTRETINERE</td><td>${ds}</td><td>${ds}</td><td>${ck}</td><td>${ds}</td></tr>
    <tr class="sep-green"><td colspan="5">Mentenanta tehnica — serviciu optional</td></tr>
    <tr><td>VERIFICARI SAPTAMANALE INSTALATII</td><td>${ds}</td><td>${ds}</td><td>${ds}</td><td>${ckG}</td></tr>
    <tr><td>INTERVENTIE AVARIE MAX 1.5H</td><td>${ds}</td><td>${ds}</td><td>${ds}</td><td>${ckG}</td></tr>
    <tr><td>REPARATII AVARII</td><td>${ds}</td><td>${ds}</td><td>${ds}</td><td>${ckG}</td></tr>
    <tr><td>DISCOUNT MATERIALE 15%</td><td>${ds}</td><td>${ds}</td><td>${ds}</td><td>${ckG}</td></tr>
    <tr><td>DISCOUNT MANOPERA 15%</td><td>${ds}</td><td>${ds}</td><td>${ds}</td><td>${ckG}</td></tr>
    <tr class="pret-row">
      <td>PRET LUNAR (fara TVA)</td>
      <td>${nrAp >= 1 && nrAp <= 20 ? "50 EUR" : nrAp > 20 && nrAp <= 40 ? "70 EUR" : "Oferta"}</td>
      <td>${nrAp >= 1 && nrAp <= 20 ? "70 EUR" : nrAp > 20 && nrAp <= 40 ? "90 EUR" : "Oferta"}</td>
      <td>${nrAp >= 1 && nrAp <= 20 ? "90 EUR" : nrAp > 20 && nrAp <= 40 ? "110 EUR" : "Oferta"}</td>
      <td>${nrAp >= 1 && nrAp <= 20 ? "40 EUR" : nrAp > 20 && nrAp <= 40 ? "50 EUR" : "Oferta"}</td>
    </tr>
  </tbody>
</table>

${isPersonalizata ? `
<div class="pers">
  <h3>Oferta personalizata pentru ${form.nrApartamente} apartamente</h3>
  <p>Pentru imobile cu peste 40 de apartamente elaboram o oferta complet personalizata,<br/>adaptata dimensiunii si nevoilor specifice ale asociatiei dumneavoastra.<br/>Va invitam sa ne contactati pentru o discutie fara angajamente.</p>
  <div class="contact-grid">
    <div class="contact-pill">office@decoimob.ro</div>
    <div class="contact-pill">0756 362 828</div>
  </div>
</div>
` : pretInfo ? `
<div class="section-title">Pachetul selectat si pret estimat</div>
<div class="pachet-box">
  <div class="pachet-name">Pachet ${pachetLabel}${form.mentenanta ? " + Mentenanta Tehnica" : ""}</div>
  <div class="pachet-desc">Recomandat pentru asociatii cu ${pretInfo.range} apartamente &nbsp;|&nbsp; ${form.numeAsociatie || "Asociatia dumneavoastra"}</div>
</div>
<div class="pret-box">
  <div class="pret-left">
    <p>Estimare lunara pentru ${form.nrApartamente} apartamente</p>
    <strong>Pachet ${pachetLabel}${form.mentenanta ? " + Mentenanta" : ""} &nbsp;|&nbsp; Fara TVA</strong>
  </div>
  <div>
    <div class="pret-amount">${pretInfo.total} EUR</div>
    <div class="pret-period">/ luna &nbsp;|&nbsp; facturare in RON la cursul BNR</div>
  </div>
</div>
` : ""}

<div class="section-title">Descrierea detaliata a serviciilor incluse</div>

<div class="sb">
  <div class="sb-header"><div class="sb-num">01</div><div class="sb-name">Servicii Financiare — inclus in toate pachetele</div></div>
  <div class="sb-body"><ul>
    <li>Plata facturilor catre furnizorii de utilitati si prestatorii de servicii</li>
    <li>Intocmirea si tinerea Registrului de Casa</li>
    <li>Actualizarea Registrului Fond Rulment si Fond Reparatii</li>
    <li>Depunerea declaratiilor fiscale pentru angajati si colaboratori</li>
    <li>Mentinerea relatiei cu institutia bancara a asociatiei</li>
    <li>Mentinerea relatiei cu furnizorii de utilitati</li>
    <li>Intocmirea Registrului Jurnal lunar</li>
    <li>Intocmirea ordinelor de plata pentru serviciile prestate</li>
    <li>Achitarea taxelor si impozitelor catre bugetul de stat</li>
    <li>Monitorizarea modificarilor legislative in domeniu</li>
  </ul></div>
</div>

<div class="sb">
  <div class="sb-header"><div class="sb-num">02</div><div class="sb-name">Servicii Contabile — inclus in toate pachetele</div></div>
  <div class="sb-body"><ul>
    <li>Calcularea listelor de incasare a cotelor de intretinere prin program specializat</li>
    <li>Repartizarea facturilor de la furnizori in listele lunare</li>
    <li>Calcularea si repartizarea penalizarilor aplicate de Asociatie sau Furnizori</li>
    <li>Calcularea consumurilor de apa rece si calda pe baza citirilor</li>
    <li>Intocmirea listelor lunare cu cotele de contributie ale proprietarilor</li>
    <li>Aplicarea deciziilor Adunarii Generale in listele de plata</li>
    <li>Transmiterea informatiilor catre proprietarii cu nelamuriri privind repartizarea</li>
    <li>Acces aplicatie online, cloud documente si arhiva electronica</li>
  </ul></div>
</div>

<div class="sb">
  <div class="sb-header"><div class="sb-num">03</div><div class="sb-name">Casierie & Interfata Proprietari — Pachet CONTABIL si COMPLET</div></div>
  <div class="sb-body"><ul class="single">
    <li>Incasarea cotelor de intretinere si penalitatilor — prin casier desemnat, document bancar, sediu prestator sau plata online</li>
    <li>Program de incasare afisat in prealabil la loc vizibil — 2 ori/luna recomandat, cate 1 ora</li>
    <li>Preluarea sesizarilor si documentelor (cereri) venite din partea proprietarilor</li>
    <li>Interfata directa cu proprietarii pentru orice nelamuriri financiare sau administrative</li>
  </ul></div>
</div>

<div class="sb">
  <div class="sb-header"><div class="sb-num">04</div><div class="sb-name">Servicii Administrative & Tehnice — Pachet COMPLET</div></div>
  <div class="sb-body"><ul>
    <li>Verificarea starii subsolului, cailor de acces, palierelor si ghenelor</li>
    <li>Verificarea functionarii ascensorului (dupa caz)</li>
    <li>Intocmirea referatelor de necesitate si prezentarea ofertelor pentru interventii</li>
    <li>Afisarea listelor lunare de plati dupa aprobarea cenzorului si Presedintelui</li>
    <li>Ridicarea facturilor furnizorilor de la sediul beneficiarului</li>
    <li>Prezentarea Presedintelui a ordinelor de plata pentru semnare</li>
    <li>Verificarea contoarelor de apa din apartamente (1 data / 6 luni)</li>
    <li>Verificarea functionarii instalatiei electrice comune</li>
    <li>Colectarea si constatarea reclamatiilor privind partile comune</li>
    <li>Participarea la receptia lucrarilor — comisie nominalizata de Comitetul Executiv</li>
    <li>Asistenta juridica, recuperare creante, mediere conflicte proprietari</li>
    <li>Reprezentare in relatia cu ANAF si institutiile statului</li>
  </ul></div>
</div>

<div class="mb">
  <div class="sb-header"><div class="sb-num" style="background:#22C55E;">MT</div><div class="sb-name" style="color:#14532D;">Mentenanta Tehnica — Serviciu Optional (se asociaza cu Pachet COMPLET)</div></div>
  <div class="sb-body"><ul>
    <li>Verificare saptamanala instalatii apa si scurgere subsol</li>
    <li>Verificare saptamanala etanseitate robineti si vane subsol</li>
    <li>Verificare saptamanala functionalitate instalatii drenare ape uzate</li>
    <li>Verificare saptamanala circuite electrice tablouri casa scarii</li>
    <li>Verificare saptamanala becuri si lampi cu senzor pe paliere</li>
    <li>Verificare saptamanala iluminat subsol</li>
    <li>Gresare lunara robineti impotriva pietrificarii</li>
    <li>Inlocuire becuri casa scarii si subsol (pana la 2/luna gratuit)</li>
    <li>Reducere 15% manopera reparatii parti comune SI private locatari</li>
    <li>Interventie in maxim 1.5 ore de la semnalarea avariei</li>
    <li>Reparatia avariei in maxim 12 ore (zile lucratoare) — materiale Romstal</li>
    <li>Call center activ 24h/7 zile pentru orice defectiune tehnica</li>
  </ul></div>
</div>

<div class="beneficii">
  <div class="ben-title">Beneficii incluse in orice pachet DecoImob</div>
  <ul>
    <li>Platforma online proprietari — acces 24/7 pe orice dispozitiv</li>
    <li>Call center activ 24 ore / 7 zile</li>
    <li>Raport lunar detaliat trimis pe email</li>
    <li>Arhiva electronica gratuita pe durata contractului</li>
    <li>Plata cote intretinere online pentru locatari</li>
    <li>Consultanta administrativa cu institutiile locale</li>
    <li>Asigurare obligatorie (la cerere)</li>
    <li>Arhivare si transcriere documente in format electronic</li>
  </ul>
</div>

<div class="nota">
  <strong>Nota importanta:</strong> Preturile sunt exprimate in EUR si se factureaza in RON la cursul BNR din ziua facturarii, fara TVA.
  Oferta este valabila 30 de zile de la data emiterii. Contractul de administrare se incheie pe o perioada minima de 12 luni,
  cu posibilitate de prelungire automata. Pentru detalii suplimentare, negociere sau vizualizarea contractului standard,
  va rugam sa ne contactati la <strong>office@decoimob.ro</strong> sau <strong>0756 362 828</strong>.
</div>

<div class="footer">
  <div><strong>DecoImob SRL</strong> — Firma de administrare imobile Bucuresti si Ilfov — 20+ ani experienta</div>
  <div>www.decoimob.ro &nbsp;|&nbsp; office@decoimob.ro</div>
</div>

</div>
</div>
</body>
</html>`;
}

export default function OfertaModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<FormData>({
    numeAsociatie: "", oras: "Bucuresti", sector: "", strada: "",
    email: "", nrApartamente: "", nrEtaje: "", pachet: "complet", mentenanta: false,
  });

  const nrAp = parseInt(form.nrApartamente) || 0;
  const pretInfo = nrAp > 0 ? getPret(nrAp, form.pachet, form.mentenanta) : null;
  const isPersonalizata = nrAp > 40;

  const handlePrint = () => {
    const html = generatePDFHTML(form);
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 600);
    }
  };

  const inp: React.CSSProperties = {
    width: "100%", background: "#080A0F", border: "1px solid #1E2733",
    borderRadius: "8px", padding: "11px 14px", color: "#fff",
    fontSize: "14px", outline: "none",
  };
  const lbl: React.CSSProperties = {
    fontSize: "11px", fontWeight: 600, letterSpacing: "1px",
    textTransform: "uppercase" as const, color: "#4B5563", marginBottom: "5px", display: "block",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.88)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
    }}>
      <div style={{
        background: "#0D1117", border: "1px solid #1E2733", borderRadius: "16px",
        width: "100%", maxWidth: "780px", maxHeight: "92vh", overflowY: "auto", padding: "40px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "32px" }}>
          <div>
            <h2 style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-0.5px", marginBottom: "4px" }}>Solicita oferta personalizata</h2>
            <p style={{ fontSize: "13px", color: "#4B5563" }}>Completeaza datele — iti generam oferta completa, cu toate serviciile detaliate</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "1px solid #1E2733", color: "#9CA3AF", width: "36px", height: "36px", borderRadius: "8px", cursor: "pointer", fontSize: "18px" }}>x</button>
        </div>

        <p style={{ fontSize: "11px", fontWeight: 700, color: "#1D6FD8", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "14px" }}>Date asociatie</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 24px", marginBottom: "24px" }}>
          <div><label style={lbl}>Numele asociatiei *</label><input style={inp} placeholder="Asociatia de Proprietari X" value={form.numeAsociatie} onChange={e => setForm(f => ({ ...f, numeAsociatie: e.target.value }))}/></div>
          <div><label style={lbl}>Adresa de e-mail *</label><input style={inp} type="email" placeholder="asociatie@email.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}/></div>
          <div><label style={lbl}>Oras *</label><input style={inp} placeholder="Bucuresti" value={form.oras} onChange={e => setForm(f => ({ ...f, oras: e.target.value }))}/></div>
          <div><label style={lbl}>Numar apartamente *</label><input style={inp} type="number" placeholder="ex: 24" value={form.nrApartamente} onChange={e => setForm(f => ({ ...f, nrApartamente: e.target.value }))}/></div>
          <div><label style={lbl}>Sector (daca este cazul)</label><input style={inp} placeholder="ex: Sector 3" value={form.sector} onChange={e => setForm(f => ({ ...f, sector: e.target.value }))}/></div>
          <div><label style={lbl}>Numar etaje</label><input style={inp} type="number" placeholder="ex: 8" value={form.nrEtaje} onChange={e => setForm(f => ({ ...f, nrEtaje: e.target.value }))}/></div>
          <div style={{ gridColumn: "1 / -1" }}><label style={lbl}>Strada si numarul *</label><input style={inp} placeholder="ex: Str. Exemplu nr. 10" value={form.strada} onChange={e => setForm(f => ({ ...f, strada: e.target.value }))}/></div>
        </div>

        <p style={{ fontSize: "11px", fontWeight: 700, color: "#1D6FD8", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "14px" }}>Pachet principal *</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "20px" }}>
          {[
            { key: "liste",    label: "Pachet LISTE",    desc: "Financiar & contabil de baza" },
            { key: "contabil", label: "Pachet CONTABIL", desc: "Liste + Casierie & proprietari" },
            { key: "complet",  label: "Pachet COMPLET",  desc: "Toate serviciile + juridic + tehnic" },
          ].map(p => (
            <div key={p.key} onClick={() => setForm(f => ({ ...f, pachet: p.key }))} style={{
              border: `1px solid ${form.pachet === p.key ? "#1D6FD8" : "#1E2733"}`,
              borderRadius: "10px", padding: "14px 16px", cursor: "pointer",
              background: form.pachet === p.key ? "#0A1F3D" : "#080A0F", transition: "all 0.2s",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <div style={{ width: "14px", height: "14px", borderRadius: "50%", border: `2px solid ${form.pachet === p.key ? "#1D6FD8" : "#4B5563"}`, background: form.pachet === p.key ? "#1D6FD8" : "transparent", flexShrink: 0 }} />
                <span style={{ fontSize: "13px", fontWeight: 700, color: form.pachet === p.key ? "#fff" : "#9CA3AF" }}>{p.label}</span>
              </div>
              <p style={{ fontSize: "11px", color: "#4B5563", paddingLeft: "22px" }}>{p.desc}</p>
              {nrAp > 0 && !isPersonalizata && (
                <p style={{ fontSize: "13px", fontWeight: 800, color: "#1D6FD8", paddingLeft: "22px", marginTop: "6px" }}>
                  {nrAp <= 20 ? PRET.mic[p.key as keyof typeof PRET.mic] : PRET.mediu[p.key as keyof typeof PRET.mediu]} EUR/luna
                </p>
              )}
            </div>
          ))}
        </div>

        <p style={{ fontSize: "11px", fontWeight: 700, color: "#1D6FD8", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "12px" }}>Servicii optionale</p>
        <div onClick={() => setForm(f => ({ ...f, mentenanta: !f.mentenanta }))} style={{
          border: `1px solid ${form.mentenanta ? "#22C55E" : "#1E2733"}`,
          borderRadius: "10px", padding: "14px 18px", cursor: "pointer",
          background: form.mentenanta ? "#052010" : "#080A0F",
          display: "flex", alignItems: "center", gap: "12px",
          transition: "all 0.2s", maxWidth: "400px", marginBottom: "24px",
        }}>
          <div style={{ width: "16px", height: "16px", borderRadius: "4px", border: `2px solid ${form.mentenanta ? "#22C55E" : "#4B5563"}`, background: form.mentenanta ? "#22C55E" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {form.mentenanta && <span style={{ color: "white", fontSize: "10px", fontWeight: 800 }}>v</span>}
          </div>
          <div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: form.mentenanta ? "#fff" : "#9CA3AF" }}>Mentenanta tehnica</div>
            <div style={{ fontSize: "11px", color: "#4B5563", marginTop: "2px" }}>Verificari saptamanale, interventie max 1.5h, reducere 15% manopera</div>
            {nrAp > 0 && !isPersonalizata && (
              <div style={{ fontSize: "13px", fontWeight: 800, color: "#22C55E", marginTop: "4px" }}>
                +{nrAp <= 20 ? PRET.mic.mentenanta : PRET.mediu.mentenanta} EUR/luna
              </div>
            )}
          </div>
        </div>

        {nrAp > 0 && (
          <div style={{ background: "#080A0F", border: `1px solid ${isPersonalizata ? "#1D6FD8" : "#1E2733"}`, borderRadius: "12px", padding: "18px 24px", marginBottom: "24px" }}>
            {isPersonalizata ? (
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: "14px", fontWeight: 700, color: "#1D6FD8", marginBottom: "6px" }}>Oferta personalizata necesara</p>
                <p style={{ fontSize: "13px", color: "#9CA3AF" }}>Pentru {form.nrApartamente} apartamente elaboram o oferta adaptata. Descarcati oferta si contactati-ne.</p>
              </div>
            ) : pretInfo ? (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <div>
                  <p style={{ fontSize: "12px", color: "#4B5563", marginBottom: "4px" }}>Estimare pentru {form.nrApartamente} apartamente</p>
                  <p style={{ fontSize: "13px", color: "#9CA3AF" }}>Pachet {form.pachet.toUpperCase()}{form.mentenanta ? " + Mentenanta" : ""}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontSize: "32px", fontWeight: 800, color: "#1D6FD8", letterSpacing: "-1px", lineHeight: 1 }}>{pretInfo.total} EUR</p>
                  <p style={{ fontSize: "11px", color: "#4B5563" }}>/ luna, fara TVA</p>
                </div>
              </div>
            ) : null}
          </div>
        )}

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <button onClick={handlePrint} style={{ flex: 1, background: "#1D6FD8", color: "#fff", border: "none", padding: "15px 24px", borderRadius: "8px", fontWeight: 700, fontSize: "14px", cursor: "pointer", minWidth: "200px" }}>
            Descarca oferta PDF
          </button>
          <a href={`mailto:office@decoimob.ro?subject=Solicitare oferta — ${form.numeAsociatie || "Asociatie"}&body=Buna ziua,%0A%0ASolicito o oferta pentru:%0A- Asociatie: ${form.numeAsociatie}%0A- Adresa: ${form.strada}${form.sector ? ", " + form.sector : ""}, ${form.oras}%0A- Apartamente: ${form.nrApartamente}%0A- Pachet: ${form.pachet.toUpperCase()}${form.mentenanta ? " + Mentenanta" : ""}%0A- Email: ${form.email}%0A%0AVa multumesc.`}
            style={{ flex: 1, background: "transparent", color: "#9CA3AF", border: "1px solid #1E2733", padding: "15px 24px", borderRadius: "8px", fontWeight: 600, fontSize: "14px", textAlign: "center" as const, textDecoration: "none", minWidth: "200px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            Trimite email cu oferta
          </a>
        </div>
      </div>
    </div>
  );
}
