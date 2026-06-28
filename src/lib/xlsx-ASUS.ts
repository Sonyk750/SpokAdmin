import { unzipSync, strFromU8 } from "fflate";

// Parser minimal .xlsx (fără dependențe externe) — întoarce un tabel string[][].
// Suportă shared strings, inline strings și valori numerice. Nu suportă .xls vechi.

function unescapeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, "&");
}

function colToIdx(ref: string): number {
  const m = ref.match(/^([A-Z]+)/);
  if (!m) return 0;
  let n = 0;
  for (const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function parseSharedStrings(xml: string): string[] {
  const out: string[] = [];
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>|<si\b[^>]*\/>/g;
  let m: RegExpExecArray | null;
  while ((m = siRe.exec(xml)) !== null) {
    const inner = m[1] ?? "";
    let text = "";
    const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
    let t: RegExpExecArray | null;
    while ((t = tRe.exec(inner)) !== null) text += t[1];
    out.push(unescapeXml(text));
  }
  return out;
}

export interface XlsxResult {
  rows: string[][];   // primul rând = de obicei antetul
  sheetName: string;
}

export function parseXlsx(buf: Uint8Array): XlsxResult {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(buf);
  } catch {
    throw new Error("Fișierul nu este un .xlsx valid (folosește Excel, nu .xls vechi).");
  }

  const sharedXml = files["xl/sharedStrings.xml"] ? strFromU8(files["xl/sharedStrings.xml"]) : "";
  const shared = sharedXml ? parseSharedStrings(sharedXml) : [];

  // Prima foaie de calcul (după nume de fișier)
  const sheetPath = Object.keys(files)
    .filter(p => /^xl\/worksheets\/sheet\d+\.xml$/.test(p))
    .sort((a, b) => {
      const na = parseInt(a.match(/sheet(\d+)/)?.[1] ?? "0");
      const nb = parseInt(b.match(/sheet(\d+)/)?.[1] ?? "0");
      return na - nb;
    })[0];
  if (!sheetPath) throw new Error("Fișierul Excel nu conține nicio foaie de calcul.");

  const sheetXml = strFromU8(files[sheetPath]);

  const rows: string[][] = [];
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>|<row\b[^>]*\/>/g;
  let rm: RegExpExecArray | null;
  while ((rm = rowRe.exec(sheetXml)) !== null) {
    const rowInner = rm[1] ?? "";
    const cells: string[] = [];
    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cm: RegExpExecArray | null;
    while ((cm = cellRe.exec(rowInner)) !== null) {
      const attrs = cm[1] ?? "";
      const content = cm[2] ?? "";
      const ref  = attrs.match(/r="([A-Z]+\d+)"/)?.[1] ?? "";
      const type = attrs.match(/t="([^"]+)"/)?.[1] ?? "n";
      const idx  = ref ? colToIdx(ref) : cells.length;

      let val = "";
      if (type === "s") {
        const vi = content.match(/<v[^>]*>([\s\S]*?)<\/v>/)?.[1];
        if (vi != null) val = shared[parseInt(vi, 10)] ?? "";
      } else if (type === "inlineStr") {
        const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
        let t: RegExpExecArray | null;
        while ((t = tRe.exec(content)) !== null) val += t[1];
        val = unescapeXml(val);
      } else {
        const vi = content.match(/<v[^>]*>([\s\S]*?)<\/v>/)?.[1];
        if (vi != null) val = unescapeXml(vi);
      }

      cells[idx] = val;
    }
    // normalizează lungimea (umple golurile cu "")
    for (let i = 0; i < cells.length; i++) if (cells[i] == null) cells[i] = "";
    rows.push(cells);
  }

  return { rows, sheetName: sheetPath };
}
