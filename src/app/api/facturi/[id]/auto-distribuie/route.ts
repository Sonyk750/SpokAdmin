import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { articolKey } from "@/lib/distributie";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

const CRITERII = ["egal", "persoane", "cota_parte", "suprafata", "consum", "manual"] as const;
const CONSUM_TIPURI = ["apa_rece", "apa_calda", "electric", "gaz"] as const;
const r2 = (v: number) => Math.round(v * 100) / 100;

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY lipsă din .env.local" }, { status: 500 });
  }

  const { id } = await params;
  const factura = await db.factura.findFirst({
    where:  { id, organizationId: orgId },
    select: { id: true, valoare: true, furnizorId: true },
  });
  if (!factura) return NextResponse.json({ error: "Factură negăsită." }, { status: 404 });

  const pdf = await db.facturaPdf.findUnique({ where: { facturaId: id }, select: { data: true } });
  if (!pdf) return NextResponse.json({ error: "Factura nu are PDF atașat. Atașează un PDF întâi." }, { status: 400 });

  // Model învățat (template) pentru acest furnizor — coloanele preferate.
  // Colapsăm intrările vechi acumulate de același tip (criteriu+consumTip) păstrând
  // cea mai recentă denumire — ex: Apă potabilă/Canalizare/TMAU (toate consum/apa_rece)
  // devin o singură coloană, ca să nu apară carduri duplicate.
  const templateRaw = factura.furnizorId
    ? await db.distributieModel.findMany({ where: { furnizorId: factura.furnizorId }, orderBy: { createdAt: "asc" } })
    : [];
  const dedupMap = new Map<string, (typeof templateRaw)[number]>();
  for (const m of templateRaw) dedupMap.set(`${m.criteriu}:${m.consumTip ?? ""}`, m);
  const template = [...dedupMap.values()];
  const hasTemplate = template.length > 0;

  const base64 = Buffer.from(pdf.data).toString("base64");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const promptText = hasTemplate
    ? `Ești un asistent care distribuie facturi de utilități pentru asociații de proprietari.
Acest furnizor are un MODEL FIX de distribuire, cu EXACT aceste coloane:
${template.map(m => `- "${m.articolLabel}"${m.criteriu === "consum" ? " (consum contoare)" : m.criteriu === "cota_parte" ? " (cotă parte)" : ` (${m.criteriu})`}`).join("\n")}

Citește factura și grupează TOATE liniile/articolele ei în EXACT aceste coloane. Consolidează mai multe linii într-o singură coloană când e cazul (ex: apă potabilă + canalizare + TMAU + orice taxă pe consumul de apă → coloana de apă rece; apă meteorică / pluvială / canalizare pluvială → coloana de apă meteo).

Returnează EXCLUSIV un JSON valid (fără markdown, fără explicații):
{"articole":[{"denumire":<numele EXACT al coloanei din model>,"valoare":<suma totală în lei a liniilor puse în această coloană>}]}

Reguli stricte:
- Folosește EXACT denumirile coloanelor din model (literă cu literă, cu diacritice).
- Identifică fiecare linie/articol din factură cu suma lui EXACTĂ (cu TVA), apoi adună liniile în coloana potrivită (ex: apă potabilă + canalizare + TMAU → apă rece). Citește sumele REALE de pe factură — nu inventa, nu estima; dacă o linie nu există, nu o include.
- Fiecare coloană din model apare o singură dată.
- Totalul facturii CURENTE este ${factura.valoare} lei. Suma coloanelor trebuie să fie EGALĂ cu acest total și NU are voie să-l depășească. Verifică adunarea înainte de a răspunde.`
    : `Ești un asistent care analizează facturi de utilități românești pentru asociații de proprietari.
Extrage ARTICOLELE/serviciile facturate și, pentru fiecare, sugerează cum ar trebui distribuit pe apartamente.

Returnează EXCLUSIV un JSON valid (fără markdown, fără explicații):
{"articole":[{"denumire":string,"valoare":number,"criteriuSugerat":"egal|persoane|cota_parte|suprafata|consum|manual","consumTip":"apa_rece|apa_calda|electric|gaz"|null}]}

Reguli pentru criteriuSugerat (glosar):
- consum apă rece, apă caldă, TMAU / taxă tratare ape uzate (pe mc de apă) → "consum" cu consumTip "apa_rece" (sau "apa_calda" dacă e apă caldă)
- consum energie electrică, gaz → "consum" cu consumTip "electric"/"gaz"
- apă meteo / apă pluvială, canalizare fixă, abonament, redevență, taxă fixă → "cota_parte"
- salubritate / gunoi / colectare deșeuri → "persoane"
- orice altceva neclar → "egal"

Alte reguli:
- denumire: numele scurt al articolului (ex: "Apă rece", "Apă meteo", "TMAU")
- valoare: suma articolului în lei (număr zecimal). Suma articolelor ar trebui să se apropie de totalul facturii.
- consumTip: null dacă criteriuSugerat nu e "consum"
- Dacă factura are un singur element, returnează un singur articol cu valoarea totală.`;

  let aiArticole: any[] = [];
  try {
    const response = await client.messages.create({
      // Opus 4.8 — citește mult mai precis sumele din tabelele facturilor (acuratețea contează aici)
      model:      "claude-opus-4-8",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } } as any,
          { type: "text", text: promptText },
        ],
      }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    let parsed: any;
    try { parsed = JSON.parse(raw); }
    catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("Răspuns AI neinterpretabil");
      parsed = JSON.parse(m[0]);
    }
    aiArticole = Array.isArray(parsed?.articole) ? parsed.articole : [];
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Eroare la analiza PDF" }, { status: 500 });
  }

  let articole: any[];

  if (hasTemplate) {
    // Mod template: mapăm răspunsul AI pe coloanele modelului (consolidat), criteriile vin din model.
    // Citim sumele REALE ale facturii (fiecare factură cu specificul ei) — fără a forța vreo coloană.
    const memMap = new Map(template.map(m => [m.articolKey, m]));
    const valByKey = new Map<string, number>();
    for (const a of aiArticole) {
      if (!a || typeof a.denumire !== "string") continue;
      const key = articolKey(a.denumire);
      if (!memMap.has(key)) continue; // ignorăm coloane care nu sunt în model
      valByKey.set(key, r2((valByKey.get(key) ?? 0) + Math.max(0, Number(a.valoare) || 0)));
    }
    articole = template
      .map(m => ({
        denumire:    m.articolLabel,
        valoare:     valByKey.get(m.articolKey) ?? 0,
        criteriu:    m.criteriu,
        consumTip:   m.consumTip ?? null,
        source:      "memorie" as const,
        needsReview: false,
      }))
      .filter(a => a.valoare > 0.005);
  } else {
    // Mod liber: extragere + sugestii AI
    articole = aiArticole
      .filter(a => a && typeof a.denumire === "string")
      .map(a => {
        const denumire = String(a.denumire).trim();
        const valoare  = Math.max(0, r2(Number(a.valoare) || 0));
        const criteriu = CRITERII.includes(a.criteriuSugerat) ? a.criteriuSugerat : "egal";
        let consumTip = (criteriu === "consum" && CONSUM_TIPURI.includes(a.consumTip)) ? a.consumTip : null;
        if (criteriu === "consum" && !consumTip) consumTip = "apa_rece";
        return { denumire, valoare, criteriu, consumTip, source: "ai" as const, needsReview: true };
      });
  }

  return NextResponse.json({ valoare: factura.valoare, hasFurnizor: !!factura.furnizorId, hasTemplate, articole });
}
