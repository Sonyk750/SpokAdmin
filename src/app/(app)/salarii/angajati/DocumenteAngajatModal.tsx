"use client"

import { useState, useEffect } from "react"

interface Angajat {
  id:           string
  nume:         string
  prenume:      string | null
  cnp:          string | null
  functie:      string | null
  tipContract:  string
  dataAngajare: string | null
  dataIncetare: string | null
  salariuBrut:  number
  normaDeLucru: number
  contBancar:   string | null
  banca:        string | null
  email:        string | null
  telefon:      string | null
}

interface Asociatie {
  name:           string
  address:        string | null
  city:           string | null
  sector:         string | null
  cui:            string | null
  phone:          string | null
  email:          string | null
  adminName:      string | null
  presedinteName: string | null
}

type DocType = "cerere-angajare" | "contract-munca" | "cerere-demisie"

interface Props {
  angajat:     Angajat
  asociatieId: string
  onClose:     () => void
}

const DOC_LABELS: Record<DocType, string> = {
  "cerere-angajare": "Cerere de angajare",
  "contract-munca":  "Contract individual de muncă",
  "cerere-demisie":  "Cerere de demisie",
}

async function getPdfMake() {
  const pdfMake  = (await import("pdfmake/build/pdfmake"))  as any
  const pdfFonts = (await import("pdfmake/build/vfs_fonts")) as any
  const pm = pdfMake.default ?? pdfMake
  pm.vfs = pdfFonts.default ?? pdfFonts
  if (!pm.fonts) pm.fonts = {}
  pm.fonts.Times = {
    normal: "Times-Roman", bold: "Times-Bold",
    italics: "Times-Italic", bolditalics: "Times-BoldItalic",
  }
  return pm
}

function fmtData(iso: string) {
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

// ─── Document builders ────────────────────────────────────────────────────────

function buildCerereAngajare(a: Angajat, asoc: Asociatie, dataDoc: string, domiciliu: string): any {
  const numeComplet = `${a.prenume ?? ""} ${a.nume}`.trim()
  const adresaAsoc  = [asoc.address, asoc.city, asoc.sector].filter(Boolean).join(", ")

  return {
    pageSize: "A4",
    pageMargins: [70, 70, 70, 70],
    defaultStyle: { font: "Times", fontSize: 12, lineHeight: 1.4 },
    content: [
      {
        columns: [
          { text: "" },
          {
            width: "45%",
            stack: [
              { text: "Către," },
              { text: asoc.name, bold: true },
              { text: adresaAsoc || " " },
            ],
          },
        ],
        marginBottom: 30,
      },
      { text: "CERERE DE ANGAJARE", style: "titlu", marginBottom: 20 },
      {
        text: [
          "Subsemnatul/a ",
          { text: numeComplet, bold: true },
          ", posesor/posesoare al/a CNP ",
          { text: a.cnp || "_________________", bold: true },
          ", domiciliat/ă în ",
          domiciliu || "_________________________________________",
          ", tel. ",
          a.telefon || "_______________",
          ", e-mail ",
          a.email || "_______________",
          ",",
        ],
        marginBottom: 12,
      },
      {
        text: [
          "vă rog să binevoiți a-mi aproba angajarea la ",
          { text: asoc.name, bold: true },
          " în funcția de ",
          { text: a.functie || "_______________", bold: true },
          ", în baza unui ",
          a.tipContract === "CIM" ? "Contract Individual de Muncă" : a.tipContract,
          " cu normă ",
          a.normaDeLucru >= 8 ? "întreagă (8 ore/zi)" : `parțială (${a.normaDeLucru} ore/zi)`,
          ", cu un salariu brut lunar de ",
          { text: `${a.salariuBrut.toFixed(2)} RON`, bold: true },
          ", începând cu data de ",
          { text: a.dataAngajare ? fmtData(a.dataAngajare) : "___________", bold: true },
          ".",
        ],
        marginBottom: 12,
      },
      { text: "Anexez prezentei cereri următoarele documente:", marginBottom: 6 },
      {
        ul: [
          "Copie buletin/carte de identitate",
          "Curriculum vitae",
          "Diplomă / Certificat de calificare (dacă este cazul)",
          "Cazier judiciar",
          "Adeverință medicală",
          "Alte documente relevante",
        ],
        marginBottom: 24,
      },
      { text: "Vă mulțumesc.", marginBottom: 40 },
      {
        columns: [
          { text: `Data: ${fmtData(dataDoc)}` },
          { text: "Semnătura: ___________________________", alignment: "right" },
        ],
      },
    ],
    styles: {
      titlu: { fontSize: 14, bold: true, alignment: "center" },
    },
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
      { text: `Art. ${nr} — ${titlu}`, bold: true, marginTop: 12, marginBottom: 4 },
      ...rows,
    ]
  }

  return {
    pageSize: "A4",
    pageMargins: [65, 65, 65, 65],
    defaultStyle: { font: "Times", fontSize: 10.5, lineHeight: 1.45 },
    content: [
      { text: "CONTRACT INDIVIDUAL DE MUNCĂ", style: "titlu" },
      { text: `nr. ___ / ${fmtData(dataDoc)}`, alignment: "center", marginBottom: 16 },
      {
        text: "încheiat în temeiul art. 10 din Legea nr. 53/2003 — Codul muncii, republicată",
        alignment: "center", italics: true, marginBottom: 20,
      },

      { text: "I. PĂRȚILE CONTRACTULUI", style: "sectiune" },
      {
        text: [
          { text: "Angajatorul: ", bold: true },
          asoc.name,
          asoc.cui ? `, CUI ${asoc.cui}` : "",
          `, cu sediul în ${adresaAsoc || "_______________________"}`,
          asoc.phone ? `, tel. ${asoc.phone}` : "",
          ", reprezentat(ă) prin ",
          { text: asoc.adminName || "___________________________", bold: true },
          " în calitate de Administrator,",
        ],
        marginBottom: 8,
      },
      { text: "și", bold: true, marginBottom: 8 },
      {
        text: [
          { text: "Salariatul/Salariata: ", bold: true },
          numeComplet,
          a.cnp      ? `, CNP ${a.cnp}` : "",
          a.telefon  ? `, tel. ${a.telefon}` : "",
          a.email    ? `, e-mail ${a.email}` : "",
          ".",
        ],
        marginBottom: 16,
      },

      { text: "II. OBIECTUL CONTRACTULUI", style: "sectiune" },
      ...art("1", "Felul muncii", [
        { text: ["Salariatul/Salariata va ocupa funcția/postul de ", { text: a.functie || "_______________", bold: true }, "."] },
      ]),
      ...art("2", "Locul de muncă", [
        { text: ["Locul de muncă este la sediul angajatorului: ", { text: adresaAsoc || "_______________________", bold: true }, "."] },
      ]),

      { text: "III. DURATA CONTRACTULUI", style: "sectiune" },
      ...art("3", "Durata", [
        { text: ["Contractul se încheie pe durată ", { text: durataText, bold: true }, "."] },
        { text: ["Data de începere: ", { text: a.dataAngajare ? fmtData(a.dataAngajare) : "___________", bold: true }, "."] },
      ]),

      { text: "IV. TIMPUL DE MUNCĂ", style: "sectiune" },
      ...art("4", "Durata muncii", [
        {
          text: [
            "Norma de lucru: ",
            { text: `${a.normaDeLucru} ore/zi`, bold: true },
            ` (${a.normaDeLucru >= 8 ? "normă întreagă" : "normă parțială"})`,
            ", program stabilit de angajator conform regulamentului intern.",
          ],
        },
      ]),

      { text: "V. SALARIUL", style: "sectiune" },
      ...art("5", "Salariul de bază", [
        {
          text: [
            "Salariul brut lunar este de ",
            { text: `${a.salariuBrut.toFixed(2)} RON`, bold: true },
            ". Plata salariului se face ",
            a.contBancar
              ? `prin virament bancar în contul ${a.contBancar} deschis la ${a.banca || "___"}`
              : "în numerar / prin virament bancar",
            ", lunar, conform legislației în vigoare.",
          ],
        },
        {
          text: "Sporurile și adaosurile se acordă conform dispozițiilor legale și contractului colectiv de muncă aplicabil.",
          marginTop: 4,
        },
      ]),

      { text: "VI. CONCEDIUL", style: "sectiune" },
      ...art("6", "Concediul de odihnă", [
        { text: "Durata concediului de odihnă anual este de minimum 20 de zile lucrătoare, conform Codului muncii." },
      ]),

      { text: "VII. PREAVIZUL", style: "sectiune" },
      ...art("7", "Preaviz", [
        {
          text: [
            "Durata preavizului la demisie este de ",
            { text: `${preavizZile} zile lucrătoare`, bold: true },
            ". Durata preavizului la concediere este de minimum 20 de zile lucrătoare.",
          ],
        },
      ]),

      { text: "VIII. CLAUZE SPECIFICE", style: "sectiune" },
      ...art("8", "Clauza de confidențialitate", [
        {
          text: "Salariatul se obligă să păstreze confidențialitatea datelor și informațiilor la care are acces, pe toată durata contractului și după încetarea acestuia.",
        },
      ]),

      { text: "IX. DREPTURI ȘI OBLIGAȚII", style: "sectiune" },
      ...art("9", "Dispoziții generale", [
        {
          text: "Drepturile și obligațiile se completează cu prevederile Legii nr. 53/2003 — Codul muncii, republicată, și ale contractului colectiv de muncă aplicabil.",
        },
      ]),

      { text: "X. DISPOZIȚII FINALE", style: "sectiune" },
      ...art("10", "Modificarea contractului", [
        { text: "Orice modificare se face numai prin act adițional semnat de ambele părți." },
        { text: "Prezentul contract a fost încheiat în două exemplare, câte unul pentru fiecare parte.", marginTop: 4 },
      ]),

      { text: " ", marginTop: 20 },
      {
        columns: [
          {
            stack: [
              { text: "ANGAJATOR", bold: true },
              { text: asoc.name },
              { text: asoc.adminName ? `Administrator: ${asoc.adminName}` : " " },
              { text: " " },
              { text: "Semnătura: ___________________________" },
              { text: "Ștampila:" },
            ],
          },
          {
            stack: [
              { text: "SALARIAT/Ă", bold: true },
              { text: numeComplet },
              { text: a.cnp ? `CNP: ${a.cnp}` : " " },
              { text: " " },
              { text: "Semnătura: ___________________________" },
              { text: `Data: ${fmtData(dataDoc)}` },
            ],
          },
        ],
        marginTop: 24,
      },
    ],
    styles: {
      titlu:    { fontSize: 13, bold: true, alignment: "center", marginBottom: 4 },
      sectiune: { fontSize: 11, bold: true, marginTop: 14, marginBottom: 2, decoration: "underline" },
    },
  }
}

function buildCerereDemisie(a: Angajat, asoc: Asociatie, dataDoc: string, preavizZile: number): any {
  const numeComplet  = `${a.prenume ?? ""} ${a.nume}`.trim()
  const adresaAsoc   = [asoc.address, asoc.city, asoc.sector].filter(Boolean).join(", ")
  const dataIncetare = addZileL(dataDoc, preavizZile)

  return {
    pageSize: "A4",
    pageMargins: [70, 70, 70, 70],
    defaultStyle: { font: "Times", fontSize: 12, lineHeight: 1.4 },
    content: [
      {
        columns: [
          { text: "" },
          {
            width: "45%",
            stack: [
              { text: "Către," },
              { text: asoc.name, bold: true },
              { text: adresaAsoc || " " },
              { text: asoc.adminName ? `În atenția: ${asoc.adminName}` : " " },
            ],
          },
        ],
        marginBottom: 30,
      },
      { text: "DEMISIE", style: "titlu", marginBottom: 20 },
      {
        text: [
          "Subsemnatul/a ",
          { text: numeComplet, bold: true },
          a.cnp ? `, CNP ${a.cnp}` : "",
          ", angajat/ă la ",
          { text: asoc.name, bold: true },
          " în funcția de ",
          { text: a.functie || "_______________", bold: true },
          a.dataAngajare ? `, începând cu data de ${fmtData(a.dataAngajare)}` : "",
          ",",
        ],
        marginBottom: 12,
      },
      {
        text: [
          "prin prezenta vă notific că, în conformitate cu prevederile ",
          { text: "art. 81 din Legea nr. 53/2003 — Codul muncii", bold: true },
          ", înțeleg să demisionez din funcția deținută.",
        ],
        marginBottom: 12,
      },
      {
        text: [
          "Termenul de preaviz este de ",
          { text: `${preavizZile} zile lucrătoare`, bold: true },
          ", conform contractului individual de muncă și Codului muncii.",
        ],
        marginBottom: 6,
      },
      {
        text: [
          "Prin urmare, ultima zi de muncă va fi ",
          { text: fmtData(dataIncetare), bold: true },
          ".",
        ],
        marginBottom: 24,
      },
      {
        text: "Mă angajez să asigur predarea în bune condiții a atribuțiilor și documentelor aferente funcției, în termenul de preaviz.",
        marginBottom: 40,
      },
      {
        columns: [
          { text: `Data: ${fmtData(dataDoc)}` },
          {
            stack: [
              { text: numeComplet, alignment: "right" },
              { text: "Semnătura: ___________________________", alignment: "right" },
            ],
          },
        ],
        marginBottom: 50,
      },
      {
        text: "──────────────────────────────────────────────────────",
        alignment: "center",
        color: "#cccccc",
        marginBottom: 10,
      },
      { text: "CONFIRMARE PRIMIRE (angajator)", bold: true, marginBottom: 8 },
      {
        columns: [
          { text: "Am primit prezenta demisie la data de: ___________" },
          { text: "Semnătura: ___________________________", alignment: "right" },
        ],
      },
    ],
    styles: {
      titlu: { fontSize: 14, bold: true, alignment: "center" },
    },
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
  const [domiciliu,  setDomiciliu]  = useState("")

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
    setGenerating(true)
    setErr("")
    try {
      const pm  = await getPdfMake()
      let   doc: any

      if (docType === "cerere-angajare") {
        doc = buildCerereAngajare(angajat, asoc, dataDoc, domiciliu)
      } else if (docType === "contract-munca") {
        doc = buildContractMunca(angajat, asoc, dataDoc, preaviz)
      } else {
        doc = buildCerereDemisie(angajat, asoc, dataDoc, preaviz)
      }

      const numeAngajat = `${angajat.prenume ?? ""}_${angajat.nume}`.replace(/\s+/g, "_")
      pm.createPdf(doc).download(`${docType}_${numeAngajat}.pdf`)
    } catch (e: any) {
      setErr(`Eroare generare PDF: ${e?.message ?? String(e)}`)
    } finally {
      setGenerating(false)
    }
  }

  const numeComplet = `${angajat.prenume ?? ""} ${angajat.nume}`.trim()

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal__header">
          <h2 className="modal__title">Documente — {numeComplet}</h2>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>

        <div className="modal__body">
          {loading ? (
            <p style={{ color: "#9ca3af" }}>Se încarcă datele asociației...</p>
          ) : (
            <div className="form-grid form-grid--2">

              <div className="form-field form-field--full">
                <label className="form-field__label">Tip document</label>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  {(Object.keys(DOC_LABELS) as DocType[]).map(k => (
                    <button
                      key={k}
                      onClick={() => setDocType(k)}
                      className={docType === k ? "btn btn--primary btn--sm" : "btn btn--secondary btn--sm"}
                      style={{ fontSize: "0.8125rem" }}
                    >
                      {DOC_LABELS[k]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-field">
                <label className="form-field__label">Data documentului</label>
                <input
                  className="input"
                  type="date"
                  value={dataDoc}
                  onChange={e => setDataDoc(e.target.value)}
                  style={{ colorScheme: "dark" }}
                />
              </div>

              {(docType === "contract-munca" || docType === "cerere-demisie") && (
                <div className="form-field">
                  <label className="form-field__label">Preaviz (zile lucrătoare)</label>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={90}
                    value={preaviz}
                    onChange={e => setPreaviz(+e.target.value)}
                  />
                </div>
              )}

              {docType === "cerere-angajare" && (
                <div className="form-field form-field--full">
                  <label className="form-field__label">Domiciliu angajat</label>
                  <input
                    className="input"
                    value={domiciliu}
                    onChange={e => setDomiciliu(e.target.value)}
                    placeholder="Str. Exemplu nr. 1, Sector 3, București"
                  />
                </div>
              )}

              <div className="form-field form-field--full">
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
                          <span className="info-row__label">Data începere</span>
                          <span className="info-row__value">{angajat.dataAngajare ? fmtData(angajat.dataAngajare) : "—"}</span>
                        </div>
                        <div className="info-row">
                          <span className="info-row__label">Normă</span>
                          <span className="info-row__value">{angajat.normaDeLucru} ore/zi</span>
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
              </div>

              {err && (
                <div className="form-field form-field--full">
                  <p style={{ color: "#f87171", fontSize: "0.85rem", margin: 0 }}>{err}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal__footer">
          <button className="btn btn--secondary" onClick={onClose}>Închide</button>
          <button
            className="btn btn--primary"
            onClick={handleGenereaza}
            disabled={generating || loading || !asoc}
          >
            {generating ? "Se generează..." : "⬇ Descarcă PDF"}
          </button>
        </div>
      </div>
    </div>
  )
}
