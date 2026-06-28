import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest) {
  const session = await auth();
  const orgId   = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await db.organization.findUnique({
    where:  { id: orgId },
    select: { rolePermissions: true },
  });

  let perms: Record<string, Record<string, boolean>> = {};
  try { if (org?.rolePermissions) perms = JSON.parse(org.rolePermissions); } catch {}

  return NextResponse.json(perms);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const orgId   = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as Record<string, Record<string, boolean>>;

  await db.organization.update({
    where: { id: orgId },
    data:  { rolePermissions: JSON.stringify(body) },
  });

  return NextResponse.json({ ok: true });
}
