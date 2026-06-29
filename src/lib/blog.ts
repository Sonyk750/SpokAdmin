// src/lib/blog.ts
// Blog SpokAdmin — continut SEO + "SEO AI" (optimizat pentru motoare clasice si LLM).
// Articolele sunt stocate ca date TS cu continut HTML, fara dependinte de markdown,
// pentru a pastra bundle-ul mic si build-ul 100% static.

export interface BlogFaq {
  q: string;
  a: string;
}

export interface BlogPostMeta {
  slug: string;
  title: string;
  description: string;
  date: string;
  category: string;
  readTime: string;
  keywords: string[];
}

export interface BlogPost extends BlogPostMeta {
  faq: BlogFaq[];
  content: string; // HTML
}

const posts: BlogPost[] = [
  {
    slug: "lista-de-plata-cu-ai",
    title: "Lista de plata cu AI: cum distribuie inteligenta artificiala facturile pe apartamente",
    description:
      "Cum functioneaza lista de plata cu AI: inteligenta artificiala citeste facturile primite, recunoaste articolele si distribuie automat cheltuielile pe apartamente, fara erori. Ghid pentru administratori de asociatii de proprietari.",
    date: "2026-06-28",
    category: "Inteligenta Artificiala",
    readTime: "7 min",
    keywords: [
      "lista de plata cu AI",
      "distribuire automata facturi asociatie",
      "inteligenta artificiala administrare asociatii",
      "lista de plata fara erori",
      "software administrare asociatii de proprietari",
      "calcul intretinere apartament",
    ],
    faq: [
      {
        q: "Ce este lista de plata cu AI?",
        a: "Lista de plata cu AI este o lista de intretinere generata cu ajutorul inteligentei artificiale: AI-ul citeste facturile primite de asociatie, identifica articolele (apa, canalizare, salubritate, energie) si propune distribuirea lor pe apartamente dupa criteriul corect — consum, cota indiviza sau numar de persoane. Administratorul doar verifica si confirma.",
      },
      {
        q: "AI-ul poate gresi la calculul listei de plata?",
        a: "AI-ul elimina erorile de transcriere si de aritmetica specifice calculului manual in Excel. Distribuirea respecta criteriile legale, iar totalul repartizat este intotdeauna egal cu totalul facturii. Administratorul pastreaza controlul final: verifica propunerea si confirma inainte de publicare.",
      },
      {
        q: "Este lista de plata cu AI conforma cu legislatia din Romania?",
        a: "Da. Listele de plata, registrele si modul de repartizare a cheltuielilor respecta legislatia asociatiilor de proprietari (Legea 196/2018 si normele de aplicare). AI-ul automatizeaza calculul, dar criteriile de repartizare raman cele prevazute de lege.",
      },
    ],
    content: `
<p><strong>SpokAdmin</strong> este prima aplicatie de administrare a asociatiilor de proprietari din Romania care foloseste <strong>inteligenta artificiala in crearea listei de plata</strong>. In loc sa introduci manual fiecare factura si sa imparti sumele in Excel, AI-ul citeste documentele, recunoaste articolele si distribuie automat cheltuielile pe apartamente — fara erori.</p>

<h2>Cum functioneaza distribuirea automata a facturilor</h2>
<p>Fluxul este simplu si pastreaza mereu administratorul in control:</p>
<ol>
  <li><strong>Incarci factura.</strong> Urci PDF-ul primit de la furnizor (apa, energie, salubritate, gaze).</li>
  <li><strong>AI-ul citeste si recunoaste.</strong> Identifica furnizorul, perioada, articolele si sumele.</li>
  <li><strong>Propune distribuirea.</strong> Repartizeaza fiecare articol dupa criteriul corect: pe consum, pe cota indiviza sau pe numar de persoane.</li>
  <li><strong>Verifici si confirmi.</strong> Vezi exact cum a fost impartita suma, ajustezi daca e nevoie, apoi publici lista.</li>
</ol>

<h2>De ce conteaza pentru un administrator de bloc</h2>
<p>Calculul manual al listei de intretinere este cea mai mare consumatoare de timp si cea mai frecventa sursa de reclamatii din partea proprietarilor. O singura cifra gresita poate inseamna ore de recalculare si o adunare generala tensionata. Cu <strong>lista de plata fara erori</strong> generata de AI:</p>
<ul>
  <li>reduci timpul de la cateva ore la cateva minute pe asociatie;</li>
  <li>elimini erorile de transcriere si de impartire;</li>
  <li>ai trasabilitate completa — vezi din ce factura provine fiecare leu repartizat;</li>
  <li>raspunzi instant la intrebarile proprietarilor, cu documentul sursa la indemana.</li>
</ul>

<h2>Mai mult decat lista de plata</h2>
<p>Distribuirea automata a facturilor este doar inceputul. In SpokAdmin, lista generata alimenteaza automat <strong>contabilitatea, registrele si rapoartele</strong> asociatiei, iar facturile primite pot fi preluate direct din <a href="https://spokinvoice.ro" target="_blank" rel="noopener">SpokInvoice</a> sau din SPV ANAF prin modulul de <a href="/#functionalitati">e-Factura</a>. Astfel, intregul flux financiar — de la factura primita pana la incasarea cotei de la proprietar — ramane intr-un singur loc.</p>

<h2>Parte dintr-un ecosistem complet</h2>
<p>SpokAdmin face parte din ecosistemul <a href="https://spokapp.ro" target="_blank" rel="noopener">SpokApp</a>, alaturi de <a href="https://spokinvoice.ro" target="_blank" rel="noopener">SpokInvoice</a> (facturare si e-Factura) si <a href="https://vosmart.ro" target="_blank" rel="noopener">VoSmart</a> (cenzorat inteligent pentru asociatii). Impreuna acopera tot ce are nevoie o asociatie moderna: administrare, facturare si cenzorat — toate digitalizate si conectate.</p>

<p>Vrei sa vezi lista de plata cu AI in actiune pe asociatia ta? <a href="/register">Incepe gratuit</a> — 14 zile, fara card.</p>
`,
  },
  {
    slug: "software-administrare-asociatii-proprietari-ghid-2026",
    title: "Software administrare asociatii de proprietari: ghid complet 2026",
    description:
      "Ghid 2026 pentru alegerea unui software de administrare asociatii de proprietari: ce functii sunt obligatorii, conformitatea cu Legea 196/2018, liste de plata, contabilitate, e-Factura ANAF si rapoarte.",
    date: "2026-06-27",
    category: "Administrare Imobile",
    readTime: "9 min",
    keywords: [
      "software administrare asociatii de proprietari",
      "program administrare bloc",
      "aplicatie administrare imobile",
      "program intretinere bloc",
      "administrator imobile",
      "Legea 196 2018",
    ],
    faq: [
      {
        q: "Ce trebuie sa includa un software de administrare a asociatiilor?",
        a: "Un software complet trebuie sa acopere: liste de plata si intretinere, contabilitate si registre (casa, banca, jurnal, fond rulment), incasari si plati, e-Factura ANAF, contoare si repartizare consum, salarizare si rapoarte. Ideal este sa functioneze 100% in cloud, fara instalare, si sa fie conform Legii 196/2018.",
      },
      {
        q: "Este obligatoriu un program de administrare pentru blocuri?",
        a: "Legea nu impune un anume program, dar impune tinerea registrelor, a listelor de plata si a evidentei contabile conform Legii 196/2018. Un software specializat asigura aceasta conformitate automat si reduce drastic riscul de erori fata de Excel sau evidenta pe hartie.",
      },
      {
        q: "Cat costa un software de administrare a asociatiilor de proprietari?",
        a: "Costul depinde de numarul de apartamente administrate. SpokAdmin porneste de la un plan gratuit pentru asociatii mici si ajunge la planuri lunare pentru portofolii de zeci sau sute de apartamente, cu posibilitatea de a administra mai multe asociatii dintr-un singur cont.",
      },
    ],
    content: `
<p>Administrarea unei asociatii de proprietari inseamna sa jonglezi cu liste de plata, registre, facturi, incasari, declaratii si rapoarte — adesea in mai multe programe si zeci de fisiere Excel. Un <strong>software de administrare asociatii de proprietari</strong> bun le aduce pe toate intr-un singur loc. Iata ce sa cauti in 2026.</p>

<h2>Functiile pe care trebuie sa le aiba orice program de administrare bloc</h2>
<ul>
  <li><strong>Liste de plata si intretinere</strong> — calcul automat al cotelor si repartizarea consumurilor pe apartamente.</li>
  <li><strong>Contabilitate si registre</strong> — registru de casa, banca, jurnal, fond rulment si reparatii, actualizate automat.</li>
  <li><strong>Incasari si plati online</strong> — chitante, urmarirea restantierilor si plata cotelor de catre proprietari.</li>
  <li><strong>e-Factura ANAF (SPV)</strong> — facturi emise si primite, declaratii fiscale si jurnal ANAF.</li>
  <li><strong>Contoare si repartizare consum</strong> — citiri si impartire corecta a apei, caldurii sau altor utilitati.</li>
  <li><strong>Rapoarte complete</strong> — fisa proprietar si furnizor, venituri-cheltuieli, restantieri, export PDF.</li>
</ul>

<h2>Conformitatea cu Legea 196/2018</h2>
<p>Administrarea asociatiilor de proprietari este reglementata in Romania de <strong>Legea 196/2018</strong> si de normele de aplicare. Un program serios genereaza registrele, listele de plata si situatiile financiare exact in forma ceruta de lege si tine evidenta <a href="/blog/fond-rulment-registre-cenzorat-digital">fondului de rulment si a registrelor</a>. Asta iti ofera liniste la controale si la verificarea de catre cenzor.</p>

<h2>Cloud vs. aplicatie instalata local</h2>
<p>O <strong>aplicatie de administrare imobile</strong> moderna ruleaza 100% in browser: nu instalezi nimic, datele sunt in cloud, securizate si salvate automat, iar accesul este posibil de pe orice PC, tableta sau telefon. Programele instalate local te leaga de un singur calculator si fac colaborarea si backupul mai dificile.</p>

<h2>Avantajul AI in administrare</h2>
<p>Diferentiatorul real in 2026 este inteligenta artificiala. SpokAdmin foloseste <a href="/blog/lista-de-plata-cu-ai">AI in crearea listei de plata</a>: citeste facturile primite si distribuie automat cheltuielile pe apartamente, fara erori. Este o premiera in Romania pentru un <strong>program de intretinere bloc</strong>.</p>

<h2>Un ecosistem, nu doar o aplicatie</h2>
<p>SpokAdmin face parte din ecosistemul <a href="https://spokapp.ro" target="_blank" rel="noopener">SpokApp</a>. Daca administrezi si facturezi pentru firme, te conectezi cu <a href="https://spokinvoice.ro" target="_blank" rel="noopener">SpokInvoice</a> pentru facturare si e-Factura, iar pentru verificarea independenta a asociatiei poti folosi <a href="https://vosmart.ro" target="_blank" rel="noopener">VoSmart</a>, solutia de cenzorat inteligent. Vezi mai multe despre obligatiile de administrare in <a href="https://spokapp.ro/blog/administrare-imobile-asociatii-proprietari" target="_blank" rel="noopener">ghidul complet de administrare imobile</a>.</p>

<p>Esti administrator de imobile sau firma de administrare? <a href="/register">Incepe gratuit cu SpokAdmin</a> si configureaza prima asociatie in cateva minute.</p>
`,
  },
  {
    slug: "e-factura-anaf-asociatii-proprietari",
    title: "e-Factura ANAF pentru asociatii de proprietari: cum conectezi SPV in 2026",
    description:
      "Cum gestioneaza o asociatie de proprietari e-Factura ANAF in 2026: conectarea la SPV, facturile primite de la furnizori, facturile emise, jurnalul ANAF si declaratiile fiscale, direct din aplicatie.",
    date: "2026-06-26",
    category: "e-Factura ANAF",
    readTime: "8 min",
    keywords: [
      "e-factura anaf asociatie",
      "SPV ANAF asociatie proprietari",
      "factura electronica asociatie",
      "e-factura obligatorie 2026",
      "facturare asociatie proprietari",
      "jurnal ANAF",
    ],
    faq: [
      {
        q: "Asociatiile de proprietari sunt obligate sa foloseasca e-Factura?",
        a: "Asociatiile primesc facturi de la furnizori (apa, energie, salubritate) prin sistemul e-Factura ANAF si trebuie sa le preia din SPV. Atunci cand emit facturi (de exemplu pentru servicii catre terti), acestea intra de asemenea in regimul e-Factura. Preluarea facturilor primite din SPV este esentiala pentru evidenta corecta.",
      },
      {
        q: "Cum conectez asociatia la SPV ANAF?",
        a: "Conectarea la SPV (Spatiul Privat Virtual) se face cu certificatul digital al asociatiei. In SpokAdmin, dupa autorizare, facturile emise si primite, jurnalul ANAF si declaratiile devin disponibile direct in aplicatie, fara sa intri separat pe portalul ANAF.",
      },
      {
        q: "Ce este jurnalul ANAF si de ce conteaza?",
        a: "Jurnalul ANAF este evidenta centralizata a tuturor facturilor schimbate prin e-Factura. Pentru o asociatie, el confirma ce facturi au fost primite si preluate din SPV, asigurand ca nicio cheltuiala nu este omisa la intocmirea listei de plata si a contabilitatii.",
      },
    ],
    content: `
<p>Sistemul national <strong>e-Factura ANAF</strong> a schimbat modul in care circula facturile in Romania, inclusiv pentru asociatiile de proprietari. Facturile de la furnizorii de utilitati ajung electronic, prin <strong>SPV (Spatiul Privat Virtual)</strong>, iar evidenta lor corecta este esentiala pentru o lista de plata exacta.</p>

<h2>Ce inseamna e-Factura pentru o asociatie</h2>
<p>O asociatie de proprietari interactioneaza cu e-Factura in doua moduri:</p>
<ul>
  <li><strong>Facturi primite</strong> — furnizorii de apa, energie, gaze sau salubritate transmit facturile prin SPV. Asociatia le preia electronic, in format XML standardizat.</li>
  <li><strong>Facturi emise</strong> — atunci cand asociatia factureaza servicii (spatii comune inchiriate, recuperari de cheltuieli), factura intra in regimul e-Factura.</li>
</ul>

<h2>Cum conectezi asociatia la SPV</h2>
<p>In SpokAdmin, conectarea la SPV se face o singura data, cu certificatul digital al asociatiei. Dupa autorizare ai acces direct, din aplicatie, la:</p>
<ul>
  <li>facturile emise si primite;</li>
  <li><strong>jurnalul ANAF</strong> cu istoricul complet;</li>
  <li>declaratiile fiscale relevante.</li>
</ul>
<p>Astfel nu mai treci separat prin portalul ANAF — totul este intr-un singur loc, legat de contabilitatea asociatiei.</p>

<h2>De la factura primita la lista de plata</h2>
<p>Aici se vede puterea integrarii: o factura preluata din SPV poate fi trimisa direct catre modulul de <a href="/blog/lista-de-plata-cu-ai">lista de plata cu AI</a>, care recunoaste articolele si le distribuie automat pe apartamente. Practic, drumul de la factura primita pana la cota fiecarui proprietar devine aproape complet automat.</p>

<h2>Daca emiti facturi separat: SpokInvoice</h2>
<p>Pentru firmele de administrare care emit facturi catre clienti, recomandam <a href="https://spokinvoice.ro" target="_blank" rel="noopener">SpokInvoice</a> — solutia de facturare si e-Factura din ecosistemul <a href="https://spokapp.ro" target="_blank" rel="noopener">SpokApp</a>. Pentru detalii despre obligatii, termene si sanctiuni, vezi <a href="https://spokapp.ro/blog/ghid-e-factura-anaf-2026" target="_blank" rel="noopener">ghidul complet e-Factura ANAF 2026</a>.</p>

<h2>Verificarea independenta a asociatiei</h2>
<p>Evidenta corecta a facturilor primite si emise simplifica enorm munca cenzorului. Daca asociatia foloseste verificare digitala, <a href="https://vosmart.ro" target="_blank" rel="noopener">VoSmart</a> ofera cenzorat inteligent cu AI, conectat la aceleasi date.</p>

<p>Vrei sa gestionezi e-Factura asociatiei direct din aplicatie? <a href="/register">Incepe gratuit cu SpokAdmin</a>.</p>
`,
  },
  {
    slug: "fond-rulment-registre-cenzorat-digital",
    title: "Fond de rulment, registre si cenzorat: cum le gestionezi digital",
    description:
      "Ghid pentru administratori: ce este fondul de rulment, ce registre trebuie sa tina asociatia de proprietari, cum se face cenzoratul si cum digitalizezi totul conform Legii 196/2018.",
    date: "2026-06-25",
    category: "Contabilitate",
    readTime: "8 min",
    keywords: [
      "fond de rulment asociatie proprietari",
      "registre asociatie proprietari",
      "cenzorat asociatii proprietari",
      "registru fond rulment online",
      "contabilitate asociatie proprietari",
      "Legea 196 2018",
    ],
    faq: [
      {
        q: "Ce este fondul de rulment al asociatiei de proprietari?",
        a: "Fondul de rulment este o suma de bani constituita din contributiile proprietarilor, folosita pentru a acoperi cheltuielile curente ale asociatiei pana la incasarea cotelor lunare. Cuantumul si modul de constituire se aproba de adunarea generala, conform Legii 196/2018.",
      },
      {
        q: "Ce registre trebuie sa tina o asociatie de proprietari?",
        a: "Asociatia trebuie sa tina registrul de casa, registrul jurnal, registrul inventar, registrul fondului de rulment si al fondului de reparatii, plus evidenta veniturilor si cheltuielilor. Un software de administrare le actualizeaza automat pe masura ce inregistrezi operatiunile.",
      },
      {
        q: "Cine verifica activitatea financiara a asociatiei?",
        a: "Activitatea financiar-contabila este verificata de cenzor (persoana fizica sau firma de cenzorat), conform Legii 196/2018. Cenzorul verifica registrele, listele de plata, soldurile si modul de gestionare a fondurilor. Solutiile digitale precum VoSmart fac aceasta verificare mai rapida si mai precisa.",
      },
    ],
    content: `
<p>Partea financiar-contabila este coloana vertebrala a oricarei asociatii de proprietari. Trei elemente revin mereu: <strong>fondul de rulment</strong>, <strong>registrele</strong> si <strong>cenzoratul</strong>. Iata ce inseamna fiecare si cum le digitalizezi corect, conform <strong>Legii 196/2018</strong>.</p>

<h2>Fondul de rulment</h2>
<p>Fondul de rulment este suma constituita din contributiile proprietarilor, care permite asociatiei sa acopere cheltuielile curente pana la incasarea cotelor. Cuantumul se aproba in adunarea generala. Intr-un <strong>registru fond rulment online</strong> vezi in orice moment soldul, contributiile pe apartament si miscarile, fara sa tii evidente paralele in Excel.</p>

<h2>Registrele obligatorii</h2>
<p>O asociatie trebuie sa tina mai multe <strong>registre</strong>:</p>
<ul>
  <li>registrul de casa;</li>
  <li>registrul jurnal;</li>
  <li>registrul inventar;</li>
  <li>registrul fondului de rulment si al fondului de reparatii.</li>
</ul>
<p>Intr-un software de <strong>contabilitate pentru asociatie de proprietari</strong>, aceste registre se actualizeaza automat pe masura ce inregistrezi incasari, plati si facturi — fara dubla introducere si fara riscul de a uita o operatiune.</p>

<h2>Cenzoratul asociatiei</h2>
<p>Activitatea financiara a asociatiei este verificata de <strong>cenzor</strong> — persoana fizica sau firma de cenzorat — conform Legii 196/2018. Cenzorul verifica registrele, listele de plata, soldurile si modul de gestionare a fondurilor. Cu cat evidenta este mai ordonata si mai trasabila, cu atat verificarea este mai rapida.</p>
<p>Pentru cenzorat modern exista solutii dedicate: <a href="https://vosmart.ro" target="_blank" rel="noopener">VoSmart</a> ofera cenzorat inteligent cu AI pentru asociatii de proprietari. Poti citi mai mult in <a href="https://spokapp.ro/blog/cenzorat-asociatii-proprietari-romania" target="_blank" rel="noopener">ghidul despre cenzorat asociatii de proprietari</a>.</p>

<h2>Cum le legi pe toate</h2>
<p>Avantajul unui sistem integrat este ca fondul de rulment, registrele si datele pentru cenzorat provin din aceeasi sursa: operatiunile reale ale asociatiei. In SpokAdmin, o <a href="/blog/lista-de-plata-cu-ai">lista de plata</a> publicata alimenteaza automat registrele, iar facturile preluate prin <a href="/blog/e-factura-anaf-asociatii-proprietari">e-Factura ANAF</a> intra direct in evidenta. Rezultatul: contabilitate corecta, fara munca dubla.</p>

<h2>Parte din ecosistemul SpokApp</h2>
<p>SpokAdmin, <a href="https://spokinvoice.ro" target="_blank" rel="noopener">SpokInvoice</a> si <a href="https://vosmart.ro" target="_blank" rel="noopener">VoSmart</a> formeaza ecosistemul <a href="https://spokapp.ro" target="_blank" rel="noopener">SpokApp</a> — administrare, facturare si cenzorat, conectate intre ele.</p>

<p>Vrei registre corecte fara batai de cap? <a href="/register">Incepe gratuit cu SpokAdmin</a> si lasa contabilitatea asociatiei sa se actualizeze singura.</p>
`,
  },
];

export function getAllPosts(): BlogPostMeta[] {
  return [...posts]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .map(({ faq: _faq, content: _content, ...meta }) => meta);
}

export function getPost(slug: string): BlogPost | null {
  return posts.find((p) => p.slug === slug) ?? null;
}

export function getPostSlugs(): string[] {
  return posts.map((p) => p.slug);
}
