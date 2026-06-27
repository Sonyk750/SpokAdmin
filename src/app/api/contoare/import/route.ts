import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { parseXlsx } from "@/lib/xlsx";

// POST (multipart) — parsează un fișier .xlsx și întoarce tabelul brut.
export async function POST(req: NextRequest) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Niciun fișier." }, { status: 400 });

  const name = file.name.toLowerCase();
  if (name.endsWith(".xls"))
    return NextResponse.json({ error: "Format vechi .xls neacceptat. Salvează fișierul ca .xlsx (sau .csv) și reîncearcă." }, { status: 400 });

  try {
    const buf = new Uint8Array(await file.arrayBuffer());

    // CSV (fallback simplu)
    if (name.endsWith(".csv")) {
      const text = new TextDecoder().decode(buf);
      const rows = text.split(/\r?\n/).filter(l => l.length).map(line => {
        const sep = line.includes(";") && !line.includes(",") ? ";" : (line.split(";").length > line.split(",").length ? ";" : ",");
        return line.split(sep).map(c => c.trim().replace(/^"|"$/g, ""));
      });
      return NextResponse.json({ rows });
    }

    const { rows } = parseXlsx(buf);
    if (rows.length === 0) return NextResponse.json({ error: "Fișierul pare gol." }, { status: 400 });
    // Limităm la max 50 coloane pentru afișare
    return NextResponse.json({ rows: rows.map(r => r.slice(0, 50)) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Eroare la citirea fișierului." }, { status: 400 });
  }
}
