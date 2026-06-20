import { NextResponse } from "next/server";

const CODES = ["EUR", "USD", "GBP", "CHF", "CNY"];

export async function GET() {
  try {
    const res = await fetch("https://www.bnr.ro/nbrfxrates.xml", {
      next: { revalidate: 3600 },
    });
    const xml  = await res.text();
    const date = (xml.match(/<Date>([\d-]+)<\/Date>/) ?? [])[1] ?? "";

    const rates = CODES.map(code => {
      const match = xml.match(new RegExp(`<Rate currency="${code}"[^>]*>([\\d.]+)<\\/Rate>`));
      return { code, value: match ? parseFloat(match[1]).toFixed(4) : "—" };
    });

    return NextResponse.json({ date, rates });
  } catch {
    return NextResponse.json({ date: "", rates: [] });
  }
}
