import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { parseXlsx } from "@/lib/xlsx";

// ── Detectare și aplatizare formate cunoscute ────────────────────────────────

type ImportFormat = "generic" | "cagero";

function detectFormat(rows: string[][]): ImportFormat {
  // Cagero: undeva în primele 6 rânduri există un rând cu "Serie" la col 3
  // și ceva de tip "Index" la col 4 și 5
  for (let i = 0; i < Math.min(6, rows.length); i++) {
    if (/serie/i.test(rows[i]?.[3] ?? "") && /index/i.test(rows[i]?.[4] ?? "")) {
      return "cagero";
    }
  }
  return "generic";
}

// Aplatizează formatul Cagero (rânduri grupate pe apartament + continuări null)
// în rânduri individuale [serie, indexVechi, indexNou]
function flattenCagero(rows: string[][]): string[][] {
  const headerIdx = rows.findIndex(r => /serie/i.test(r[3] ?? "") && /index/i.test(r[4] ?? ""));
  if (headerIdx < 0) return rows;

  const result: string[][] = [["Serie", "Index vechi", "Index nou"]];
  for (const row of rows.slice(headerIdx + 1)) {
    const serie    = (row[3] ?? "").trim();
    const ivechi   = (row[4] ?? "").trim();
    const inou     = (row[5] ?? "").trim();
    if (!serie || isNaN(parseFloat(inou))) continue;
    result.push([serie, ivechi, inou]);
  }
  return result;
}

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
      return NextResponse.json({ rows, format: "generic" });
    }

    const { rows } = parseXlsx(buf);
    if (rows.length === 0) return NextResponse.json({ error: "Fișierul pare gol." }, { status: 400 });

    const format = detectFormat(rows);

    if (format === "cagero") {
      const flat = flattenCagero(rows);
      return NextResponse.json({ rows: flat, format });
    }

    return NextResponse.json({ rows: rows.map(r => r.slice(0, 50)), format });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Eroare la citirea fișierului." }, { status: 400 });
  }
}
