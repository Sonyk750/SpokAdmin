// Autentificare pentru aplicații mobile (casier).
//
// next-auth ține sesiunea într-un cookie HttpOnly, pe care o aplicație nativă
// (React Native) nu-l poate folosi. Aici emitem/verificăm un JWT propriu (HS256,
// semnat cu AUTH_SECRET) trimis ca `Authorization: Bearer <token>`.
//
// `getApiUser()` unifică cele două căi: dacă vine un Bearer valid → user din token;
// altfel → sesiunea web next-auth. Astfel rutele API pot servi și web, și mobil.
import crypto from "crypto";
import { auth } from "@/lib/auth";

const SECRET = process.env.AUTH_SECRET || "";

export interface ApiUser {
  id: string;
  role: string | null;            // rol global: SUPER_ADMIN | USER
  organizationId: string | null;
  orgRole: string | null;         // OWNER | MEMBER
  name?: string | null;
  email?: string | null;
}

interface TokenPayload extends ApiUser {
  iat: number;
  exp: number;
}

function b64urlJson(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

/** Semnează un token pentru mobil. Valabil implicit 30 de zile. */
export function signMobileToken(
  user: ApiUser,
  expiresInSec = 60 * 60 * 24 * 30,
): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload: TokenPayload = { ...user, iat: now, exp: now + expiresInSec };
  const data = `${b64urlJson(header)}.${b64urlJson(payload)}`;
  const sig = crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
}

/** Verifică semnătura și expirarea. Întoarce payload-ul sau null. */
export function verifyMobileToken(token: string): TokenPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [h, p, sig] = parts;
    const data = `${h}.${p}`;
    const expected = crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(p, "base64url").toString()) as TokenPayload;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (!payload.id) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Utilizatorul curent pentru o rută API, indiferent de sursă:
 * - dacă există `Authorization: Bearer <token>` → validează tokenul mobil;
 *   un Bearer prezent dar invalid NU cade înapoi pe cookie (returnează null).
 * - altfel → sesiunea web next-auth.
 */
export async function getApiUser(req: Request): Promise<ApiUser | null> {
  const authz = req.headers.get("authorization");
  if (authz && authz.startsWith("Bearer ")) {
    const payload = verifyMobileToken(authz.slice(7).trim());
    if (!payload) return null;
    return {
      id: payload.id,
      role: payload.role ?? null,
      organizationId: payload.organizationId ?? null,
      orgRole: payload.orgRole ?? null,
      name: payload.name ?? null,
      email: payload.email ?? null,
    };
  }

  const session = await auth();
  const u = session?.user as (ApiUser & { id?: string }) | undefined;
  if (!u?.id) return null;
  return {
    id: u.id,
    role: u.role ?? null,
    organizationId: u.organizationId ?? null,
    orgRole: u.orgRole ?? null,
    name: u.name ?? null,
    email: u.email ?? null,
  };
}
