// Server-only: rezolvă drepturile efective ale utilizatorului curent.
// NU importa acest fișier în componente client (folosește db).
import { db } from "@/lib/db";
import { isSuperAdmin, isOwner } from "@/lib/roles";
import { roleKeyFromAsoc, permsForRole, fullPerms, emptyPerms, type PermMap } from "@/lib/permissions";

export interface Access {
  isAdmin: boolean;        // SUPER_ADMIN sau OWNER → acces total
  role:    string | null;  // rolul pe asociație (CASIER, PRESEDINTE, …) sau null
  perms:   PermMap;
}

interface SessionUserLike {
  id?: string | null;
  role?: string | null;            // rol global (SUPER_ADMIN / USER)
  orgRole?: string | null;         // OWNER / MEMBER
  organizationId?: string | null;
}

export async function resolveAccess(
  user: SessionUserLike | null | undefined,
  asociatieId?: string | null,
): Promise<Access> {
  if (!user?.id) return { isAdmin: false, role: null, perms: emptyPerms() };

  // Owner / super-admin → acces total, indiferent de asociație.
  if (isSuperAdmin(user.role) || isOwner(user.orgRole)) {
    return { isAdmin: true, role: "ADMIN", perms: fullPerms() };
  }

  // Utilizator restricționat (membru cu rol pe asociație).
  if (!asociatieId) return { isAdmin: false, role: null, perms: emptyPerms() };

  const au = await db.asociatieUser.findFirst({
    where:  { userId: user.id, asociatieId },
    select: { role: true, isSuspended: true },
  });
  if (!au || au.isSuspended) return { isAdmin: false, role: au?.role ?? null, perms: emptyPerms() };

  const key = roleKeyFromAsoc(au.role);
  if (!key) return { isAdmin: false, role: au.role, perms: emptyPerms() };

  let orgPerms: any = null;
  if (user.organizationId) {
    const org = await db.organization.findUnique({
      where: { id: user.organizationId }, select: { rolePermissions: true },
    });
    try { if (org?.rolePermissions) orgPerms = JSON.parse(org.rolePermissions); } catch {}
  }

  return { isAdmin: false, role: au.role, perms: permsForRole(key, orgPerms) };
}

/** Helper scurt pentru rute API: are userul dreptul `key`? */
export function can(access: Access, key: string): boolean {
  return access.isAdmin || access.perms[key] === true;
}
