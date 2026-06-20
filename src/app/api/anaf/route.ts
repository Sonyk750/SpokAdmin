import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const cui = req.nextUrl.searchParams.get("cui")?.replace(/\D/g, "").trim();
  if (!cui || cui.length < 2) return NextResponse.json({ error: "CUI invalid" }, { status: 400 });

  const apiKey = process.env.OPENAPI_RO_KEY ?? "";
  if (!apiKey) return NextResponse.json({ error: "Cheie API lipsă (OPENAPI_RO_KEY)" }, { status: 500 });

  try {
    const res = await fetch(`https://api.openapi.ro/api/companies/${cui}`, {
      headers: { Accept: "application/json", "x-api-key": apiKey },
      signal: AbortSignal.timeout(10_000),
    });

    if (res.status === 404) return NextResponse.json({ error: "CUI negăsit" }, { status: 404 });
    if (res.status === 403) return NextResponse.json({ error: "Cheie API invalidă" }, { status: 403 });
    if (!res.ok)            return NextResponse.json({ error: `Eroare openapi.ro: ${res.status}` }, { status: 502 });

    const j = await res.json();

    const adresaRaw: string = j.adresa || j.address || "";
    const sectorMatch = adresaRaw.match(/SECTOR(?:UL)?\s*([1-6])/i);
    const sector = sectorMatch ? sectorMatch[1] : "";
    const adresa = adresaRaw
      .replace(/MUNICIPIUL\s+BUCURESTI,?\s*/i, "")
      .replace(/SECTOR(?:UL)?\s*[1-6],?\s*/i, "")
      .replace(/\s+/g, " ").trim();
    const isBucuresti = /BUCURESTI|BUCHAREST/i.test(adresaRaw);
    const city = isBucuresti ? "București" : (j.localitate || j.city || "");

    return NextResponse.json({
      denumire: j.denumire || j.name || "",
      adresa,
      city,
      sector,
      cui,
    });
  } catch (e: any) {
    const msg = e?.name === "TimeoutError" ? "Timeout openapi.ro" : "Eroare interogare";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
