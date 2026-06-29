"use client"

import { useState, useEffect } from "react"
import RoDate from "@/components/RoDate"

interface Angajat {
  id: string; nume: string; prenume: string | null; cnp: string | null
  functie: string | null; tipContract: string
  dataAngajare: string | null; dataIncetare: string | null
  salariuBrut: number; normaDeLucru: number
  contBancar: string | null; banca: string | null
  email: string | null; telefon: string | null
  adresa: string | null; judet: string | null
  nrContract: string | null; nivelStudii: string | null
}

interface Asociatie {
  name: string; address: string | null; city: string | null; sector: string | null
  cui: string | null; phone: string | null; email: string | null
  adminName: string | null; presedinteName: string | null
}

type DocType = "cerere-angajare" | "contract-munca" | "cerere-demisie"

interface Props {
  angajat: Angajat; asociatieId: string; onClose: () => void
}

const DOC_LABELS: Record<DocType, string> = {
  "cerere-angajare": "Cerere de angajare",
  "contract-munca":  "Contract individual de muncă",
  "cerere-demisie":  "Cerere de demisie",
}

// ─── pdfmake loader ───────────────────────────────────────────────────────────

async function getPdfMake() {
  const pdfMake  = (await import("pdfmake/build/pdfmake"))  as any
  const pdfFonts = (await import("pdfmake/build/vfs_fonts")) as any
  const pm = pdfMake.default ?? pdfMake
  pm.vfs   = pdfFonts.default ?? pdfFonts
  return pm
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VIOLET = "#7c3aed"
const VIOLET_LIGHT = "#ede9fe"
const GRAY = "#6b7280"
const DARK = "#1e1b4b"

function fmtData(iso: string | null | undefined) {
  if (!iso) return "___________"
  const [y, m, d] = iso.split("T")[0].split("-")
  return `${d}.${m}.${y}`
}

function today() { return new Date().toISOString().split("T")[0] }

function addZileL(iso: string, zile: number) {
  const d = new Date(iso)
  let added = 0
  while (added < zile) {
    d.setDate(d.getDate() + 1)
    const zi = d.getDay()
    if (zi !== 0 && zi !== 6) added++
  }
  return d.toISOString().split("T")[0]
}

// Antet asociatie
function antet(asoc: Asociatie) {
  const adresaAsoc = [asoc.address, asoc.city, asoc.sector].filter(Boolean).join(", ")
  return {
    table: {
      widths: ["*", 120],
      body: [[
        {
          stack: [
            { text: asoc.name, fontSize: 13, bold: true, color: DARK },
            { text: adresaAsoc || " ", fontSize: 9, color: GRAY, margin: [0, 2, 0, 0] },
            { text: [asoc.cui ? `CUI: ${asoc.cui}   ` : "", asoc.phone ? `Tel: ${asoc.phone}   ` : "", asoc.email || ""].join(""), fontSize: 8, color: GRAY },
          ],
        },
        {
          stack: [
            { canvas: [{ type: "rect", x: 0, y: 0, w: 108, h: 44, r: 6, color: VIOLET }] },
            { text: "ASOCIAȚIE DE PROPRIETARI", absolutePosition: { x: 0, y: 0 }, fontSize: 6.5, color: "#fff", bold: true, margin: [8, 8, 0, 0], width: 108 },
          ],
          width: 120,
        },
      ]],
    },
    layout: "noBorders",
    marginBottom: 6,
  }
}

// Linie separatoare
function linie(color = VIOLET) {
  return { canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1.5, lineColor: color }], margin: [0, 0, 0, 10] }
}

// Header document (bara colorată cu titlul)
function headerDoc(titlu: string, subtitlu?: string) {
  return {
    table: {
      widths: ["*"],
      body: [[{
        stack: [
          { text: titlu, fontSize: 15, bold: true, color: "#fff", margin: [0, 2, 0, subtitlu ? 2 : 4] },
          ...(subtitlu ? [{ text: subtitlu, fontSize: 9, color: "#ede9fe", margin: [0, 0, 0, 4] }] : []),
        ],
        fillColor: VIOLET,
        margin: [14, 8, 14, 8],
      }]],
    },
    layout: "noBorders",
    marginBottom: 14,
  }
}

// Câmp info (etichetă + valoare)
function infoRow(label: string, value: string) {
  return {
    columns: [
      { text: label, width: 140, fontSize: 9, color: GRAY, bold: true },
      { text: value || "—", fontSize: 9.5, color: DARK },
    ],
    margin: [0, 2, 0, 2],
  }
}

// Secțiune cu titlu
function sectionTitle(text: string) {
  return {
    table: { widths: ["*"], body: [[{ text, fontSize: 10, bold: true, color: VIOLET, fillColor: VIOLET_LIGHT, margin: [8, 4, 8, 4] }]] },
    layout: "noBorders",
    margin: [0, 10, 0, 6],
  }
}

// Semnătura (două coloane)
function semnatura(stanga: { titlu: string; linie1: string; linie2?: string }, dreapta: { titlu: string; linie1: string; linie2?: string }) {
  const col = (s: typeof stanga) => ({
    stack: [
      { text: s.titlu, bold: true, fontSize: 10, color: DARK, margin: [0, 0, 0, 4] },
      { text: s.linie1, fontSize: 9, color: GRAY },
      s.linie2 ? { text: s.linie2, fontSize: 9, color: GRAY } : {},
      { text: " " },
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 180, y2: 0, lineWidth: 0.8, lineColor: "#d1d5db" }] },
      { text: "Semnătura și ștampila", fontSize: 8, color: GRAY, margin: [0, 3, 0, 0] },
    ],
  })
  return { columns: [col(stanga), col(dreapta)], margin: [0, 20, 0, 0] }
}

// ─── Document generators ──────────────────────────────────────────────────────

function buildCerereAngajare(a: Angajat, asoc: Asociatie, dataDoc: string, domiciliu: string): any {
  const numeComplet = `${a.prenume ?? ""} ${a.nume}`.trim()
  const adresaAsoc  = [asoc.address, asoc.city, asoc.sector].filter(Boolean).join(", ")

  return {
    pageSize: "A4",
    pageMargins: [50, 45, 50, 60],
    defaultStyle: { font: "Roboto", fontSize: 10.5, lineHeight: 1.5, color: DARK },
    footer: (page: number, pages: number) => ({
      columns: [
        { text: `Cerere de angajare — ${numeComplet}`, fontSize: 8, color: GRAY, margin: [50, 0, 0, 0] },
        { text: `Pagina ${page} din ${pages}`, fontSize: 8, color: GRAY, alignment: "right", margin: [0, 0, 50, 0] },
      ],
      margin: [0, 10, 0, 0],
    }),
    content: [
      antet(asoc),
      linie(),
      headerDoc("CERERE DE ANGAJARE", `Data: ${fmtData(dataDoc)}`),

      // Destinatar
      {
        columns: [
          { text: "" },
          {
            width: "50%",
            stack: [
              { text: "Către,", fontSize: 9, color: GRAY },
              { text: asoc.name, bold: true, fontSize: 11 },
              { text: adresaAsoc || " ", fontSize: 9, color: GRAY },
              asoc.adminName ? { text: `În atenția: ${asoc.adminName}`, fontSize: 9, italics: true, color: GRAY, margin: [0, 2, 0, 0] } : {},
            ],
          },
        ],
        margin: [0, 0, 0, 18],
      },

      // Corp
      {
        text: [
          "Subsemnatul/a ",
          { text: numeComplet, bold: true },
          ", posesor/posesoare al/a CNP ",
          { text: a.cnp || "_________________", bold: true },
          ", domiciliat/ă în ",
          { text: domiciliu || "_________________________________________", italics: !domiciliu },
          a.telefon ? `, tel. ${a.telefon}` : "",
          a.email   ? `, e-mail ${a.email}` : "",
          ",",
        ],
        margin: [0, 0, 0, 10],
      },
      {
        text: [
          "vă rog să binevoiți a-mi aproba angajarea la ",
          { text: asoc.name, bold: true },
          " în funcția de ",
          { text: a.functie || "_______________", bold: true },
          `, în baza unui ${a.tipContract === "CIM" ? "Contract Individual de Muncă" : a.tipContract}`,
          ` cu normă ${a.normaDeLucru >= 8 ? "întreagă (8 ore/zi)" : `parțială (${a.normaDeLucru} ore/zi)`}`,
          ", cu un salariu brut lunar de ",
          { text: `${a.salariuBrut.toFixed(2)} RON`, bold: true, color: VIOLET },
          ", începând cu data de ",
          { text: fmtData(a.dataAngajare), bold: true },
          ".",
        ],
        margin: [0, 0, 0, 14],
      },

      sectionTitle("Documente anexate"),
      {
        ul: [
          "Copie buletin/carte de identitate",
          "Curriculum vitae",
          "Diplomă / Certificat de calificare (dacă este cazul)",
          "Cazier judiciar",
          "Adeverință medicală aptitudini post",
          "Alte documente solicitate",
        ],
        fontSize: 10,
        margin: [10, 0, 0, 20],
      },

      { text: "Cu stimă,", margin: [0, 0, 0, 30] },
      {
        columns: [
          { text: `Data: ${fmtData(dataDoc)}`, fontSize: 10 },
          {
            stack: [
              { text: numeComplet, bold: true, alignment: "right" },
              { canvas: [{ type: "line", x1: 0, y1: 6, x2: 180, y2: 6, lineWidth: 0.8, lineColor: "#d1d5db" }], margin: [0, 0, 0, 3], alignment: "right" },
              { text: "Semnătura", fontSize: 8, color: GRAY, alignment: "right" },
            ],
          },
        ],
      },

      { text: " ", margin: [0, 30, 0, 0] },
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: "#e5e7eb", dash: { length: 4 } }] },
      { text: "CONFIRMARE PRIMIRE (angajator)", fontSize: 9, bold: true, color: GRAY, margin: [0, 8, 0, 6] },
      {
        columns: [
          { text: "Am primit la data de: ___________", fontSize: 9 },
          {
            stack: [
              { canvas: [{ type: "line", x1: 0, y1: 0, x2: 180, y2: 0, lineWidth: 0.8, lineColor: "#d1d5db" }] },
              { text: "Semnătura și ștampila", fontSize: 8, color: GRAY, margin: [0, 3, 0, 0] },
            ],
            alignment: "right",
          },
        ],
      },
    ],
  }
}

function buildContractMunca(a: Angajat, asoc: Asociatie, dataDoc: string, preavizZile: number): any {
  const numeComplet = `${a.prenume ?? ""} ${a.nume}`.trim()
  const adresaAsoc  = [asoc.address, asoc.city, asoc.sector].filter(Boolean).join(", ")
  const durataText  = a.dataIncetare
    ? `determinată, până la data de ${fmtData(a.dataIncetare)}`
    : "nedeterminată"

  function art(nr: string, titlu: string, rows: any[]) {
    return [
      { text: `Art. ${nr}. ${titlu}`, bold: true, fontSize: 10, color: VIOLET, margin: [0, 8, 0, 3] },
      ...rows,
    ]
  }

  return {
    pageSize: "A4",
    pageMargins: [50, 45, 50, 60],
    defaultStyle: { font: "Roboto", fontSize: 10, lineHeight: 1.45, color: DARK },
    footer: (page: number, pages: number) => ({
      columns: [
        { text: `Contract Individual de Muncă — ${numeComplet}`, fontSize: 8, color: GRAY, margin: [50, 0, 0, 0] },
        { text: `Pagina ${page} din ${pages}`, fontSize: 8, color: GRAY, alignment: "right", margin: [0, 0, 50, 0] },
      ],
      margin: [0, 10, 0, 0],
    }),
    content: [
      antet(asoc),
      linie(),
      headerDoc(
        "CONTRACT INDIVIDUAL DE MUNCĂ",
        `Nr. ${a.nrContract || "___"} / ${fmtData(dataDoc)} · Codul muncii — Legea nr. 53/2003`,
      ),

      sectionTitle("I. PĂRȚILE CONTRACTULUI"),
      {
        text: [
          { text: "Angajatorul: ", bold: true },
          asoc.name,
          asoc.cui ? `, CUI ${asoc.cui}` : "",
          `, cu sediul în ${adresaAsoc || "___"}`,
          asoc.phone ? `, tel. ${asoc.phone}` : "",
          ", reprezentat prin ",
          { text: asoc.adminName || "___", bold: true },
          " — Administrator,",
        ],
        margin: [0, 0, 0, 6],
      },
      {
        text: [
          { text: "Salariatul/a: ", bold: true },
          numeComplet,
          a.cnp     ? `, CNP ${a.cnp}`         : "",
          a.adresa  ? `, domiciliat/ă în ${a.adresa}` : "",
          a.telefon ? `, tel. ${a.telefon}`     : "",
          a.email   ? `, e-mail ${a.email}`     : "",
          ".",
        ],
        margin: [0, 0, 0, 6],
      },

      sectionTitle("II. OBIECTUL ȘI LOCUL DE MUNCĂ"),
      ...art("1", "Felul muncii", [
        { text: ["Salariatul/a va ocupa funcția de ", { text: a.functie || "___", bold: true }, a.nivelStudii ? `, studii ${a.nivelStudii}` : "", "."] },
      ]),
      ...art("2", "Locul de muncă", [
        { text: ["Locul de muncă: sediul angajatorului, ", { text: adresaAsoc || "___", bold: true }, "."] },
      ]),

      sectionTitle("III. DURATA CONTRACTULUI"),
      ...art("3", "Durata", [
        { text: ["Contractul se încheie pe durată ", { text: durataText, bold: true }, "."] },
        { text: ["Data de începere: ", { text: fmtData(a.dataAngajare), bold: true }, "."] },
      ]),

      sectionTitle("IV. CONDIȚII DE MUNCĂ"),
      ...art("4", "Timpul de muncă", [
        { text: ["Normă de lucru: ", { text: `${a.normaDeLucru} ore/zi`, bold: true }, ` (${a.normaDeLucru >= 8 ? "normă întreagă" : "normă parțială"})`, ", conform programului stabilit de angajator."] },
      ]),

      sectionTitle("V. SALARIUL"),
      ...art("5", "Salariul de bază", [
        { text: ["Salariul brut lunar: ", { text: `${a.salariuBrut.toFixed(2)} RON`, bold: true, color: VIOLET }, "."] },
        { text: ["Plata salariului: ", a.contBancar ? `virament bancar, cont ${a.contBancar} — ${a.banca || "bancă"}` : "în numerar / virament bancar", ", la data stabilită de angajator."] },
        { text: "Sporurile, adaosurile și indemnizațiile se acordă conform legislației și contractului colectiv de muncă aplicabil.", margin: [0, 4, 0, 0] },
      ]),

      sectionTitle("VI. CONCEDIUL"),
      ...art("6", "Concediul de odihnă", [
        { text: "Durata concediului de odihnă anual: minimum 20 de zile lucrătoare, conform Codului muncii." },
      ]),

      sectionTitle("VII. PREAVIZUL"),
      ...art("7", "Preaviz", [
        { text: ["Preaviz la demisie: ", { text: `${preavizZile} zile lucrătoare`, bold: true }, ". Preaviz la concediere: minimum 20 de zile lucrătoare."] },
      ]),

      sectionTitle("VIII. ALTE CLAUZE"),
      ...art("8", "Confidențialitate", [
        { text: "Salariatul se obligă să respecte confidențialitatea datelor și informațiilor la care are acces, atât pe durata contractului cât și după încetarea acestuia." },
      ]),
      ...art("9", "Dispoziții finale", [
        { text: "Drepturile și obligațiile se completează cu Legea nr. 53/2003 — Codul muncii, republicată, și contractul colectiv de muncă aplicabil." },
        { text: "Prezentul contract s-a încheiat în 2 (două) exemplare originale, câte unul pentru fiecare parte.", margin: [0, 4, 0, 0] },
      ]),

      semnatura(
        { titlu: "ANGAJATOR", linie1: asoc.name, linie2: asoc.adminName ? `Repr.: ${asoc.adminName}` : undefined },
        { titlu: "SALARIAT/Ă", linie1: numeComplet, linie2: a.cnp ? `CNP: ${a.cnp}` : undefined },
      ),
    ],
  }
}

function buildCerereDemisie(a: Angajat, asoc: Asociatie, dataDoc: string, preavizZile: number): any {
  const numeComplet  = `${a.prenume ?? ""} ${a.nume}`.trim()
  const adresaAsoc   = [asoc.address, asoc.city, asoc.sector].filter(Boolean).join(", ")
  const dataIncetare = addZileL(dataDoc, preavizZile)

  return {
    pageSize: "A4",
    pageMargins: [50, 45, 50, 60],
    defaultStyle: { font: "Roboto", fontSize: 10.5, lineHeight: 1.5, color: DARK },
    footer: (_page: number, _pages: number) => ({
      text: `Demisie — ${numeComplet} — ${fmtData(dataDoc)}`,
      fontSize: 8, color: GRAY, alignment: "center", margin: [0, 10, 0, 0],
    }),
    content: [
      antet(asoc),
      linie(),
      headerDoc("NOTIFICARE DE DEMISIE", `Art. 81 din Legea nr. 53/2003 — Codul muncii`),

      // Destinatar
      {
        columns: [
          { text: "" },
          {
            width: "50%",
            stack: [
              { text: "Către,", fontSize: 9, color: GRAY },
              { text: asoc.name, bold: true, fontSize: 11 },
              { text: adresaAsoc || " ", fontSize: 9, color: GRAY },
              asoc.adminName ? { text: `În atenția: ${asoc.adminName}`, fontSize: 9, italics: true, color: GRAY, margin: [0, 2, 0, 0] } : {},
            ],
          },
        ],
        margin: [0, 0, 0, 18],
      },

      {
        text: [
          "Subsemnatul/a ",
          { text: numeComplet, bold: true },
          a.cnp ? `, CNP ${a.cnp}` : "",
          ", angajat/ă la ",
          { text: asoc.name, bold: true },
          " în funcția de ",
          { text: a.functie || "___", bold: true },
          a.dataAngajare ? `, începând cu data de ${fmtData(a.dataAngajare)}` : "",
          ",",
        ],
        margin: [0, 0, 0, 10],
      },
      {
        text: [
          "prin prezenta notificare, formulez demisie din funcția deținută, în conformitate cu prevederile ",
          { text: "art. 81 din Legea nr. 53/2003 — Codul muncii", bold: true },
          ".",
        ],
        margin: [0, 0, 0, 10],
      },

      // Casetă informativă
      {
        table: {
          widths: ["*"],
          body: [[{
            stack: [
              infoRow("Termen de preaviz:", `${preavizZile} zile lucrătoare`),
              infoRow("Data notificării:", fmtData(dataDoc)),
              infoRow("Ultima zi de muncă:", fmtData(dataIncetare)),
            ],
            fillColor: "#f5f3ff",
            margin: [12, 8, 12, 8],
          }]],
        },
        layout: { hLineColor: () => VIOLET_LIGHT, vLineColor: () => VIOLET_LIGHT, hLineWidth: () => 1, vLineWidth: () => 1 },
        margin: [0, 0, 0, 16],
      },

      {
        text: "Mă angajez să asigur predarea tuturor atribuțiilor, documentelor și bunurilor din dotare în termenul de preaviz, pentru a asigura continuitatea activității.",
        margin: [0, 0, 0, 30],
      },

      {
        columns: [
          { text: `Data: ${fmtData(dataDoc)}`, fontSize: 10 },
          {
            stack: [
              { text: numeComplet, bold: true, alignment: "right" },
              { canvas: [{ type: "line", x1: 0, y1: 6, x2: 180, y2: 6, lineWidth: 0.8, lineColor: "#d1d5db" }], margin: [0, 0, 0, 3], alignment: "right" },
              { text: "Semnătura", fontSize: 8, color: GRAY, alignment: "right" },
            ],
          },
        ],
        margin: [0, 0, 0, 40],
      },

      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: "#e5e7eb", dash: { length: 4 } }] },
      { text: "CONFIRMARE PRIMIRE (angajator)", fontSize: 9, bold: true, color: GRAY, margin: [0, 8, 0, 6] },
      {
        columns: [
          { text: "Data primirii: ___________  /  Nr. înregistrare: ___________", fontSize: 9 },
          {
            stack: [
              { canvas: [{ type: "line", x1: 0, y1: 0, x2: 150, y2: 0, lineWidth: 0.8, lineColor: "#d1d5db" }] },
              { text: "Semnătura și ștampila", fontSize: 8, color: GRAY, margin: [0, 3, 0, 0] },
            ],
            alignment: "right",
          },
        ],
      },
    ],
  }
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export default function DocumenteAngajatModal({ angajat, asociatieId, onClose }: Props) {
  const [docType,    setDocType]    = useState<DocType>("cerere-angajare")
  const [asoc,       setAsoc]       = useState<Asociatie | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [generating, setGenerating] = useState(false)
  const [err,        setErr]        = useState("")
  const [dataDoc,    setDataDoc]    = useState(today())
  const [preaviz,    setPreaviz]    = useState(20)
  const [domiciliu,  setDomiciliu]  = useState(angajat.adresa || "")

  useEffect(() => {
    fetch(`/api/asociatii/${asociatieId}`)
      .then(r => r.json())
      .then(d => {
        if (d?.name) setAsoc(d)
        else setErr("Nu s-au putut încărca datele asociației.")
        setLoading(false)
      })
      .catch(() => { setErr("Eroare la încărcarea datelor asociației."); setLoading(false) })
  }, [asociatieId])

  async function handleGenereaza() {
    if (!asoc) return
    setGenerating(true); setErr("")
    try {
      const pm  = await getPdfMake()
      let   doc: any
      if (docType === "cerere-angajare")   doc = buildCerereAngajare(angajat, asoc, dataDoc, domiciliu)
      else if (docType === "contract-munca") doc = buildContractMunca(angajat, asoc, dataDoc, preaviz)
      else                                   doc = buildCerereDemisie(angajat, asoc, dataDoc, preaviz)
      const numeAngajat = `${angajat.prenume ?? ""}_${angajat.nume}`.replace(/\s+/g, "_")
      pm.createPdf(doc).download(`${docType}_${numeAngajat}.pdf`)
    } catch (e: any) {
      setErr(`Eroare PDF: ${e?.message ?? String(e)}`)
    } finally {
      setGenerating(false)
    }
  }

  const numeComplet = `${angajat.prenume ?? ""} ${angajat.nume}`.trim()

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal__header">
          <h2 className="modal__title">Documente — {numeComplet}</h2>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>

        <div className="modal__body">
          {loading ? (
            <p style={{ color: "#9ca3af" }}>Se încarcă datele asociației...</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

              <div className="form-field">
                <label className="form-field__label">Tip document</label>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  {(Object.keys(DOC_LABELS) as DocType[]).map(k => (
                    <button key={k} onClick={() => setDocType(k)}
                      className={docType === k ? "btn btn--primary btn--sm" : "btn btn--secondary btn--sm"}
                      style={{ fontSize: "0.8125rem" }}>
                      {DOC_LABELS[k]}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <div className="form-field" style={{ flex: 1, minWidth: 160 }}>
                  <label className="form-field__label">Data documentului</label>
                  <RoDate className="input" value={dataDoc}
                    onChange={v => setDataDoc(v)} style={{ colorScheme: "dark" }} />
                </div>
                {(docType === "contract-munca" || docType === "cerere-demisie") && (
                  <div className="form-field" style={{ flex: 1, minWidth: 120 }}>
                    <label className="form-field__label">Preaviz (zile lucrătoare)</label>
                    <input className="input" type="number" min={1} max={90} value={preaviz}
                      onChange={e => setPreaviz(+e.target.value)} />
                  </div>
                )}
              </div>

              {docType === "cerere-angajare" && (
                <div className="form-field">
                  <label className="form-field__label">Domiciliu angajat</label>
                  <input className="input" value={domiciliu} onChange={e => setDomiciliu(e.target.value)}
                    placeholder="Str. Exemplu nr. 1, Sector 1, București" />
                </div>
              )}

              {/* Sumar */}
              <div className="sal-doc-preview">
                <p className="sal-doc-preview__titlu">{DOC_LABELS[docType]}</p>
                <div className="info-list">
                  <div className="info-row">
                    <span className="info-row__label">Angajat</span>
                    <span className="info-row__value">{numeComplet}{angajat.cnp ? ` · CNP ${angajat.cnp}` : ""}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-row__label">Funcție</span>
                    <span className="info-row__value">{angajat.functie || "—"}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-row__label">Angajator</span>
                    <span className="info-row__value">{asoc?.name || "—"}</span>
                  </div>
                  {docType === "contract-munca" && (
                    <>
                      <div className="info-row">
                        <span className="info-row__label">Salariu brut</span>
                        <span className="info-row__value">{angajat.salariuBrut.toFixed(2)} RON</span>
                      </div>
                      <div className="info-row">
                        <span className="info-row__label">Data angajare</span>
                        <span className="info-row__value">{fmtData(angajat.dataAngajare)}</span>
                      </div>
                    </>
                  )}
                  {docType === "cerere-demisie" && (
                    <div className="info-row">
                      <span className="info-row__label">Ultima zi de muncă</span>
                      <span className="info-row__value">{fmtData(addZileL(dataDoc, preaviz))}</span>
                    </div>
                  )}
                </div>
              </div>

              {err && <p style={{ color: "#f87171", fontSize: "0.85rem" }}>{err}</p>}
            </div>
          )}
        </div>

        <div className="modal__footer">
          <button className="btn btn--secondary" onClick={onClose}>Închide</button>
          <button className="btn btn--primary" onClick={handleGenereaza}
            disabled={generating || loading || !asoc}>
            {generating ? "Se generează..." : "⬇ Descarcă PDF"}
          </button>
        </div>
      </div>
    </div>
  )
}
