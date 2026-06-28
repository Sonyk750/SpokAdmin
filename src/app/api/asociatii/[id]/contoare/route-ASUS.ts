import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

interface SubConfig {
  enabled: boolean;
  locatii: string[];
  custom:  string[];
}
interface ConturConfig {
  apa:      { enabled: boolean; rece: SubConfig; calda: SubConfig };
  electric: { enabled: boolean; locatii: string[]; custom: string[] };
  gaz:      { enabled: boolean; locatii: string[]; custom: string[] };
}

const LOC_LABEL: Record<string, string> = {
  bucatarie: "Bucătărie",
  baie:      "Baie",
  baie_mica: "Baie mică",
  general:   "General",
  gradina:   "Grădină",
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const asociatie = await db.asociatie.findFirst({
      where:   { id, organizationId: session.user.organizationId },
      include: { apartamente: { where: { isActive: true }, orderBy: { numar: "asc" } } },
    });
    if (!asociatie) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { config }: { config: ConturConfig } = await req.json();
    const orgId = session.user.organizationId;

    // Template-uri de contoare (tip + locatie) pentru asociație
    type Tmpl = { tip: string; locatie: string; denumire: string };
    const tmpls: Tmpl[] = [];

    function addSub(tip: string, sub: SubConfig) {
      if (!sub.enabled) return;
      for (const loc of sub.locatii) {
        tmpls.push({ tip, locatie: loc, denumire: LOC_LABEL[loc] ?? loc });
      }
      for (const c of sub.custom) {
        if (c.trim()) tmpls.push({ tip, locatie: "custom", denumire: c.trim() });
      }
    }

    function addSimple(tip: string, locatii: string[], custom: string[]) {
      for (const loc of locatii) {
        tmpls.push({ tip, locatie: loc, denumire: LOC_LABEL[loc] ?? loc });
      }
      for (const c of custom) {
        if (c.trim()) tmpls.push({ tip, locatie: "custom", denumire: c.trim() });
      }
    }

    if (config.apa.enabled) {
      addSub("apa_rece",  config.apa.rece);
      addSub("apa_calda", config.apa.calda);
    }
    if (config.electric.enabled) addSimple("electric", config.electric.locatii, config.electric.custom);
    if (config.gaz.enabled)      addSimple("gaz",      config.gaz.locatii,      config.gaz.custom);

    // Ștergem ce a creat wizardul anterior (fără număr de serie = create de wizard)
    await db.contor.deleteMany({ where: { asociatieId: id, numarSerie: null } });

    if (tmpls.length === 0 || asociatie.apartamente.length === 0) {
      await db.asociatie.update({ where: { id }, data: { wizardStep: 8 } });
      return NextResponse.json({ contoare: [] });
    }

    // Idempotent: nu recrea contoare care există deja (ex: cu serie setată),
    // ca să nu se dubleze la re-rularea inițializării.
    const existente = await db.contor.findMany({
      where:  { asociatieId: id },
      select: { apartamentId: true, tip: true, locatie: true, denumire: true },
    });
    const existKey = new Set(existente.map(c => `${c.apartamentId}|${c.tip}|${c.locatie ?? ""}|${c.denumire ?? ""}`));

    // Creăm doar contoarele lipsă
    const rows = asociatie.apartamente.flatMap(ap =>
      tmpls
        .filter(t => !existKey.has(`${ap.id}|${t.tip}|${t.locatie}|${t.denumire}`))
        .map(t => ({
          apartamentId:   ap.id,
          asociatieId:    id,
          organizationId: orgId,
          tip:            t.tip,
          locatie:        t.locatie,
          denumire:       t.denumire,
        }))
    );

    if (rows.length > 0) await db.contor.createMany({ data: rows });

    // Fetch back cu ID-uri pentru step 7
    const saved = await db.contor.findMany({
      where:   { asociatieId: id, numarSerie: null },
      include: { apartament: { select: { numar: true } } },
      orderBy: [{ apartament: { numar: "asc" } }, { tip: "asc" }],
    });

    await db.asociatie.update({ where: { id }, data: { wizardStep: 8 } });

    return NextResponse.json({
      contoare: saved.map(c => ({
        id:          c.id,
        apartamentId:c.apartamentId,
        numar:       c.apartament.numar,
        tip:         c.tip,
        locatie:     c.locatie ?? "",
        denumire:    c.denumire ?? "",
      })),
    });
  } catch (err: any) {
    console.error("[POST /api/asociatii/contoare]", err);
    return NextResponse.json({ error: err?.message ?? "Eroare internă" }, { status: 500 });
  }
}
