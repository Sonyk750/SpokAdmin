import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

async function ownedFactura(orgId: string, id: string) {
  return db.factura.findFirst({ where: { id, organizationId: orgId }, select: { id: true } });
}

// GET — servește PDF-ul inline
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { id } = await params;
  if (!(await ownedFactura(orgId, id))) return NextResponse.json({ error: "Factură negăsită" }, { status: 404 });

  const pdf = await db.facturaPdf.findUnique({ where: { facturaId: id } });
  if (!pdf) return NextResponse.json({ error: "Factura nu are PDF atașat" }, { status: 404 });

  const bytes = Buffer.from(pdf.data);
  const filename = (pdf.filename || `factura-${id}.pdf`).replace(/"/g, "");
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": pdf.mime || "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}

// POST — încarcă / înlocuiește PDF-ul (multipart, câmp "pdf")
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { id } = await params;
  if (!(await ownedFactura(orgId, id))) return NextResponse.json({ error: "Factură negăsită" }, { status: 404 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("pdf");
  if (!(file instanceof File)) return NextResponse.json({ error: "Niciun fișier primit" }, { status: 400 });
  if (file.type && file.type !== "application/pdf")
    return NextResponse.json({ error: "Fișierul trebuie să fie PDF" }, { status: 400 });
  if (file.size > MAX_BYTES)
    return NextResponse.json({ error: "PDF prea mare (max. 10 MB)" }, { status: 400 });

  const data = Buffer.from(await file.arrayBuffer());
  if (!data.length) return NextResponse.json({ error: "Fișier gol" }, { status: 400 });

  await db.facturaPdf.upsert({
    where:  { facturaId: id },
    create: { facturaId: id, filename: file.name || null, mime: file.type || "application/pdf", size: data.length, data },
    update: { filename: file.name || null, mime: file.type || "application/pdf", size: data.length, data },
  });

  return NextResponse.json({ ok: true, size: data.length });
}

// DELETE — șterge PDF-ul atașat
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { id } = await params;
  if (!(await ownedFactura(orgId, id))) return NextResponse.json({ error: "Factură negăsită" }, { status: 404 });

  await db.facturaPdf.deleteMany({ where: { facturaId: id } });
  return NextResponse.json({ ok: true });
}
