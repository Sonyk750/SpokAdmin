import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const cui = req.nextUrl.searchParams.get("cui")?.replace(/\D/g, "");
  if (!cui) return NextResponse.json({ error: "CUI lipsă" }, { status: 400 });

  const today = new Date().toISOString().slice(0, 10);

  try {
    const res = await fetch(
      "https://webservicesp.anaf.ro/PlatitorTvaRest/api/v8/ws/tva",
      {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify([{ cui: parseInt(cui, 10), data: today }]),
        signal:  AbortSignal.timeout(6000),
      }
    );

    if (!res.ok) return NextResponse.json({ error: "ANAF indisponibil" }, { status: 502 });

    const json = await res.json();
    const found = json?.found?.[0];

    if (!found) return NextResponse.json({ error: "CUI negăsit" }, { status: 404 });

    const dg      = found.date_generale;
    const adresaRaw: string = dg.adresa ?? "";

    // Parsăm sectorul din adresa ANAF (e.g. "SECTOR 3" sau "SECTORUL 2")
    const sectorMatch = adresaRaw.match(/SECTOR(?:UL)?\s*([1-6])/i);
    const sector = sectorMatch ? sectorMatch[1] : "";

    // Adresa curată — scoatem "MUNICIPIUL BUCURESTI, " și dubluri
    const adresa = adresaRaw
      .replace(/MUNICIPIUL\s+BUCURESTI,?\s*/i, "")
      .replace(/SECTOR(?:UL)?\s*[1-6],?\s*/i, "")
      .replace(/\s+/g, " ")
      .trim();

    // Dacă este în București, extragem orașul
    const isBucuresti = /BUCURESTI|BUCHAREST/i.test(adresaRaw);
    const city = isBucuresti ? "București" : (dg.localitate ?? "");

    return NextResponse.json({
      denumire:  dg.denumire  ?? "",
      adresa,
      city,
      sector,
      cui:       dg.cui?.toString() ?? cui,
      telefon:   dg.telefon   ?? "",
      codPostal: dg.codPostal ?? "",
    });
  } catch (err: any) {
    if (err.name === "TimeoutError") {
      return NextResponse.json({ error: "ANAF nu răspunde (timeout)" }, { status: 504 });
    }
    return NextResponse.json({ error: "Eroare interogare ANAF" }, { status: 500 });
  }
}
