import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { unzipSync } from "fflate"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseAnafDate(raw: string): Date | null {
  const m = String(raw).match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/)
  if (!m) return null
  return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00`)
}

function extractFromDetalii(detalii: string) {
  return {
    uploadId:    (detalii.match(/id_incarcare\s*=\s*([0-9]+)/i)   ?? [])[1] ?? "",
    supplierCui: (detalii.match(/cif_emitent\s*=\s*([0-9]+)/i)    ?? [])[1] ?? "",
  }
}

function xmlText(xml: string, localName: string): string {
  const m = xml.match(new RegExp(`<(?:\\w+:)?${localName}(?:\\s[^>]*)?>([^<]*)<\\/(?:\\w+:)?${localName}>`, "i"))
  return m?.[1]?.trim() ?? ""
}

function parseInvoiceXml(xml: string) {
  const supplierBlock = xml.match(/<[^>]*AccountingSupplierParty[^>]*>([\s\S]*?)<\/[^>]*AccountingSupplierParty>/i)?.[1] ?? ""
  const supplierName  = xmlText(supplierBlock, "RegistrationName") || xmlText(supplierBlock, "Name")
  const supplierCuiRaw = xmlText(supplierBlock, "CompanyID")
  const supplierCui   = supplierCuiRaw.startsWith("J") ? "" : supplierCuiRaw.replace(/^RO/i, "").replace(/\D/g, "")
  const supplierVat   = (() => {
    const m = supplierBlock.match(/<[^>]*CompanyID[^>]*>(RO[0-9]+)<\//i)
    return m?.[1]?.replace(/^RO/i, "").replace(/\D/g, "") ?? ""
  })()

  const invoiceNo = xmlText(xml, "ID")
  const issueDate = xmlText(xml, "IssueDate")
  const currency  = xmlText(xml, "DocumentCurrencyCode") || "RON"

  const totalBlock = xml.match(/<[^>]*LegalMonetaryTotal[^>]*>([\s\S]*?)<\/[^>]*LegalMonetaryTotal>/i)?.[1] ?? ""
  const taxBlock   = xml.match(/<[^>]*TaxTotal[^>]*>([\s\S]*?)<\/[^>]*TaxTotal>/i)?.[1] ?? ""
  const payable    = parseFloat(xmlText(totalBlock, "PayableAmount")      || "0")
  const taxIncl    = parseFloat(xmlText(totalBlock, "TaxInclusiveAmount") || "0")
  const total      = payable > 0 ? payable : taxIncl
  const vatAmount  = parseFloat(xmlText(taxBlock, "TaxAmount") || "0") || null

  return {
    supplierName,
    supplierCui: supplierVat || supplierCui,
    invoiceNo,
    issueDate:  issueDate ? new Date(issueDate) : null,
    total:      total || null,
    vatAmount,
    currency,
  }
}

async function downloadAndParseZip(downloadId: string, accessToken: string) {
  try {
    const res = await fetch(
      `https://api.anaf.ro/prod/FCTEL/rest/descarcare?id=${encodeURIComponent(downloadId)}`,
      { headers: { Authorization: `Bearer ${accessToken}`, Connection: "close" } }
    )
    if (!res.ok) return null

    const buf   = await res.arrayBuffer()
    const files = unzipSync(new Uint8Array(buf))
    const xmlEntry = Object.entries(files).find(([name]) =>
      name.endsWith(".xml") &&
      !name.toLowerCase().includes("semnatura") &&
      !name.toLowerCase().includes("signature")
    )
    if (!xmlEntry) return null

    const xml = new TextDecoder("utf-8").decode(xmlEntry[1])
    return parseInvoiceXml(xml)
  } catch {
    return null
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await auth()
  const orgId   = session?.user?.organizationId
  if (!session?.user?.id || !orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 })

  const sp          = req.nextUrl.searchParams
  const asociatieId = sp.get("asociatieId")
  const sync        = sp.get("sync") === "true"
  const fromDate    = sp.get("from")
  const toDate      = sp.get("to")

  if (!asociatieId) return NextResponse.json({ error: "Lipsește asociatieId" }, { status: 400 })

  const asociatie = await db.asociatie.findFirst({
    where: { id: asociatieId, organizationId: orgId },
  })
  if (!asociatie) return NextResponse.json({ error: "Asociație negăsită" }, { status: 404 })

  if (sync) {
    const token = await db.spvToken.findUnique({ where: { userId: session.user.id } })
    if (!token?.accessToken) return NextResponse.json({ error: "SPV neconectat" }, { status: 401 })

    const cif = String(asociatie.cui ?? "").replace(/^RO\s*/i, "").replace(/\D/g, "")
    if (!cif) return NextResponse.json({ error: "Asociația nu are CUI configurat" }, { status: 400 })

    try {
      const res = await fetch(
        `https://api.anaf.ro/prod/FCTEL/rest/listaMesajeFactura?zile=60&cif=${cif}&filtru=P`,
        {
          headers: {
            Authorization: `Bearer ${token.accessToken}`,
            Accept:        "application/json, text/plain, */*",
            Connection:    "close",
          },
        }
      )
      const data = await res.json()

      if (!res.ok)     return NextResponse.json({ error: `ANAF ${res.status}: ${JSON.stringify(data)}` }, { status: 502 })
      if (data.eroare) return NextResponse.json({ error: `ANAF: ${data.eroare}` }, { status: 502 })

      const mesaje: unknown[] = data.mesaje ?? data.message ?? data.facturi ?? data.listaMesaje ?? []

      if (Array.isArray(mesaje)) {
        for (const raw of mesaje) {
          const msg        = raw as Record<string, unknown>
          const downloadId = String(msg.id ?? msg.idDescarcare ?? "")
          if (!downloadId) continue

          const detalii  = String(msg.detalii ?? msg.subiect ?? "").trim()
          const parsed   = extractFromDetalii(detalii)
          const dateRaw  = String(msg.data_creare ?? msg.data ?? "")
          const listDate = parseAnafDate(dateRaw)

          const existing   = await db.spvInvoice.findUnique({ where: { id: downloadId } })
          const hasXmlData = !!(existing?.supplier && existing?.invoiceNumber && existing?.total)

          let xmlData = null
          if (!hasXmlData) {
            xmlData = await downloadAndParseZip(downloadId, token.accessToken)
          }

          await db.spvInvoice.upsert({
            where:  { id: downloadId },
            update: {
              uploadId:      parsed.uploadId    || existing?.uploadId      || null,
              supplierCui:   xmlData?.supplierCui || parsed.supplierCui    || existing?.supplierCui   || null,
              supplier:      xmlData?.supplierName                          || existing?.supplier      || null,
              invoiceNumber: xmlData?.invoiceNo                             || existing?.invoiceNumber || detalii || null,
              issueDate:     xmlData?.issueDate  || listDate                || existing?.issueDate     || null,
              total:         xmlData?.total      ?? existing?.total         ?? null,
              vatAmount:     xmlData?.vatAmount   ?? existing?.vatAmount    ?? null,
              currency:      xmlData?.currency   || existing?.currency      || "RON",
            },
            create: {
              id:            downloadId,
              organizationId: orgId,
              asociatieId,
              downloadId,
              uploadId:      parsed.uploadId    || null,
              supplierCui:   xmlData?.supplierCui || parsed.supplierCui    || null,
              supplier:      xmlData?.supplierName                          || null,
              invoiceNumber: xmlData?.invoiceNo   || detalii               || null,
              issueDate:     xmlData?.issueDate   || listDate               || null,
              total:         xmlData?.total       ?? null,
              vatAmount:     xmlData?.vatAmount   ?? null,
              currency:      xmlData?.currency    || "RON",
              status:        "NEW",
            },
          })
        }
      }
    } catch (e) {
      console.error("SPV inbox sync error:", e)
      return NextResponse.json({ error: "Eroare la sincronizare ANAF" }, { status: 500 })
    }
  }

  const invoices = await db.spvInvoice.findMany({
    where: {
      asociatieId,
      ...(fromDate || toDate
        ? {
            OR: [
              {
                issueDate: {
                  ...(fromDate ? { gte: new Date(fromDate) }                : {}),
                  ...(toDate   ? { lte: new Date(toDate + "T23:59:59Z") }   : {}),
                },
              },
              { issueDate: null },
            ],
          }
        : {}),
    },
    orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
  })

  return NextResponse.json({ success: true, invoices })
}
