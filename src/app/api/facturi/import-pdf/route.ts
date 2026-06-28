import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY lipsă din .env.local" }, { status: 500 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("pdf") as File | null;
    if (!file) return NextResponse.json({ error: "Niciun fișier PDF primit" }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Fișier prea mare (max 10 MB)" }, { status: 400 });
    }

    const bytes  = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{
        role: "user",
        content: [
          {
            type:   "document",
            source: { type: "base64", media_type: "application/pdf", data: base64 },
          } as any,
          {
            type: "text",
            text: `Ești un asistent care extrage date din facturi românești.

Returnează EXCLUSIV un JSON valid (fără markdown, fără explicații):
{"furnizor":string|null,"serie":string|null,"numar":string|null,"valoare":number|null,"dataEmiterii":string|null}

Reguli:
- furnizor: numele firmei EMITENTE (nu destinatarul)
- serie: seria documentului (ex: "FACT", "RO", "FCV") — null dacă nu există
- numar: numărul documentului (cifre/cod, fără serie)
- valoare: valoarea facturii CURENTE (contravaloarea serviciilor facturate ÎN ACEASTĂ LUNĂ, cu TVA inclus). Caută "Total factură", "Total factură curentă", "Valoare factură", "Total de plată factură curentă". NU lua "Sold precedent / Rest de plată / Total de plată" dacă acela include restanțe sau sold din facturi anterioare — ai nevoie DOAR de factura curentă.
- dataEmiterii: data emiterii. Pe facturile românești data e scrisă zi.lună.an (ex: "05.06.2026" sau "5 iunie 2026" = 5 iunie). Returneaz-o în format ISO YYYY-MM-DD corect (ex: 2026-06-05). NU inversa ziua cu luna.`,
          },
        ],
      }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Răspuns AI neinterpretabil");
      data = JSON.parse(match[0]);
    }

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Eroare la procesare PDF" }, { status: 500 });
  }
}
