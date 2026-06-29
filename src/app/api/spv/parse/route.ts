import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { unzipSync } from "fflate"

function x(block: string, tag: string) {
  return block.match(new RegExp(`<(?:\\w+:)?${tag}(?:\\s[^>]*)?>([^<]*)<\\/(?:\\w+:)?${tag}>`, "i"))?.[1]?.trim() ?? ""
}

function xAttr(block: string, tag: string, attr: string) {
  return block.match(new RegExp(`<[^>]*:?${tag}[^>]*\\s${attr}="([^"]*)"`, "i"))?.[1]?.trim() ?? ""
}

function blocks(xml: string, tag: string): string[] {
  const re = new RegExp(`<[^>]*:?${tag}[^>]*>([\\s\\S]*?)<\\/[^>]*:?${tag}>`, "gi")
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) out.push(m[1])
  return out
}

function party(block: string) {
  const vatId = block.match(/<[^>]*CompanyID[^>]*>(RO[0-9]+)<\//i)?.[1]
    ?? block.match(/<[^>]*CompanyID[^>]*>([0-9]+)<\//i)?.[1] ?? ""
  return {
    name:    x(block, "RegistrationName") || x(block, "Name"),
    vat:     vatId.replace(/^RO/i, ""),
    regCom:  block.match(/<[^>]*CompanyID[^>]*>(J[^<]+)<\//i)?.[1]?.trim() ?? "",
    address: x(block, "StreetName"),
    city:    x(block, "CityName"),
    county:  x(block, "CountrySubentity"),
    email:   x(block, "ElectronicMail"),
    phone:   x(block, "Telephone"),
    contact: x(block, "Name"),
  }
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Neautorizat" }, { status: 401 })

  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "ID lipsă" }, { status: 400 })

  const token = await db.spvToken.findUnique({ where: { userId: session.user.id } })
  if (!token?.accessToken) return NextResponse.json({ error: "SPV neconectat" }, { status: 401 })

  const anafRes = await fetch(
    `https://api.anaf.ro/prod/FCTEL/rest/descarcare?id=${encodeURIComponent(id)}`,
    { headers: { Authorization: `Bearer ${token.accessToken}`, Connection: "close" } }
  )
  if (!anafRes.ok) return NextResponse.json({ error: `ANAF ${anafRes.status}` }, { status: 502 })

  const buf   = await anafRes.arrayBuffer()
  const files = unzipSync(new Uint8Array(buf))
  const entry = Object.entries(files).find(([n]) =>
    n.endsWith(".xml") && !n.toLowerCase().includes("semnatura") && !n.toLowerCase().includes("signature")
  )
  if (!entry) return NextResponse.json({ error: "XML negăsit în arhivă" }, { status: 422 })

  const xml = new TextDecoder("utf-8").decode(entry[1])

  const supplierBlock = blocks(xml, "AccountingSupplierParty")[0] ?? ""
  const buyerBlock    = blocks(xml, "AccountingCustomerParty")[0]  ?? ""
  const totalBlock    = blocks(xml, "LegalMonetaryTotal")[0]        ?? ""
  const taxBlock      = blocks(xml, "TaxTotal")[0]                  ?? ""

  const lineBlocks = blocks(xml, "InvoiceLine")
  const lines = lineBlocks.map(lb => {
    const itemBlock  = blocks(lb, "Item")[0]  ?? ""
    const priceBlock = blocks(lb, "Price")[0] ?? ""
    const taxCat     = blocks(itemBlock, "ClassifiedTaxCategory")[0] ?? ""
    return {
      id:          x(lb, "ID"),
      name:        x(itemBlock, "Name"),
      description: x(itemBlock, "Description"),
      quantity:    parseFloat(x(lb, "InvoicedQuantity")    || "0"),
      unit:        xAttr(lb, "InvoicedQuantity", "unitCode") || "buc",
      unitPrice:   parseFloat(x(priceBlock, "PriceAmount") || "0"),
      lineTotal:   parseFloat(x(lb, "LineExtensionAmount") || "0"),
      vatPct:      parseFloat(x(taxCat, "Percent")         || "0"),
    }
  })

  const paymentBlocks = blocks(xml, "PaymentMeans")
  const banks = paymentBlocks.map(pb => ({
    iban: x(pb, "ID").trim(),
    name: x(pb, "Name"),
    bic:  x(blocks(pb, "FinancialInstitutionBranch")[0] ?? "", "ID"),
  })).filter(b => b.iban)

  return NextResponse.json({
    invoiceNo: x(xml, "ID"),
    issueDate: x(xml, "IssueDate"),
    dueDate:   x(xml, "DueDate"),
    currency:  x(xml, "DocumentCurrencyCode") || "RON",
    note:      x(xml, "Note"),
    supplier:  party(supplierBlock),
    buyer:     party(buyerBlock),
    lines,
    banks,
    totals: {
      lineExtension: parseFloat(x(totalBlock, "LineExtensionAmount")  || "0"),
      taxExclusive:  parseFloat(x(totalBlock, "TaxExclusiveAmount")   || "0"),
      taxInclusive:  parseFloat(x(totalBlock, "TaxInclusiveAmount")   || "0"),
      allowance:     parseFloat(x(totalBlock, "AllowanceTotalAmount") || "0"),
      payable:       parseFloat(x(totalBlock, "PayableAmount")        || "0"),
      taxAmount:     parseFloat(x(taxBlock,   "TaxAmount")            || "0"),
    },
  })
}
