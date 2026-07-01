// POST /api/auth/mobile-login  →  login pentru aplicația mobilă (casier).
// Body: { email, password }
// Răspuns: { token, user: { id, name, email, role, organizationId, orgRole } }
//
// Refolosește exact verificarea din next-auth (bcrypt + isActive/isSuspended),
// dar în loc de cookie de sesiune întoarce un JWT Bearer utilizabil din mobil.
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { signMobileToken } from "@/lib/mobile-auth";

export async function POST(req: Request) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cerere invalidă." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ error: "Email și parolă obligatorii." }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { email },
    include: { memberships: { take: 1 } },
  });

  // Mesaj generic (nu dezvăluim dacă emailul există) — la fel ca la login-ul web.
  const invalid = NextResponse.json(
    { error: "Email sau parolă greșite." },
    { status: 401 },
  );

  if (!user || !user.password || !user.isActive || user.isSuspended) return invalid;

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return invalid;

  const organizationId = user.memberships[0]?.organizationId ?? null;
  const orgRole = user.memberships[0]?.role ?? null;

  const token = signMobileToken({
    id: user.id,
    role: user.role,
    organizationId,
    orgRole,
    name: user.name,
    email: user.email,
  });

  return NextResponse.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      organizationId,
      orgRole,
    },
  });
}
