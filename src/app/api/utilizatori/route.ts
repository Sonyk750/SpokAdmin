import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isSuperAdmin, canManageOrg } from "@/lib/roles"

// GET /api/utilizatori
// SUPER_ADMIN → toți utilizatorii (grupați pe organizație)
// OWNER       → utilizatorii organizației proprii (AsociatieUser + OrganizationMember)
export async function GET(_req: NextRequest) {
  const session = await auth()
  const user    = session?.user
  if (!user) return NextResponse.json({ error: "Neautorizat" }, { status: 401 })

  if (isSuperAdmin(user.role)) {
    const users = await db.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, email: true, role: true,
        isActive: true, isSuspended: true, createdAt: true,
        memberships: {
          select: {
            role: true,
            organization: { select: { id: true, name: true } },
          },
        },
        asocUsers: {
          select: {
            role: true, isSuspended: true,
            asociatie: { select: { id: true, name: true } },
          },
        },
      },
    })
    return NextResponse.json({ type: "super_admin", users })
  }

  if (!canManageOrg(user.role, user.orgRole) || !user.organizationId) {
    return NextResponse.json({ error: "Acces interzis" }, { status: 403 })
  }

  const orgId = user.organizationId

  // Members cu rol OWNER/MEMBER
  const members = await db.organizationMember.findMany({
    where:   { organizationId: orgId },
    include: { user: { select: { id: true, name: true, email: true, role: true, isActive: true, isSuspended: true, createdAt: true } } },
    orderBy: { createdAt: "asc" },
  })

  // Utilizatori la nivel de asociație (PRESEDINTE, CENZOR, PROPRIETAR)
  const asocUsers = await db.asociatieUser.findMany({
    where:   { organizationId: orgId },
    include: {
      user:     { select: { id: true, name: true, email: true, isActive: true, isSuspended: true, createdAt: true } },
      asociatie: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  // Invitații în așteptare
  const invitations = await db.userInvitation.findMany({
    where:     { organizationId: orgId, acceptedAt: null, expiresAt: { gt: new Date() } },
    include:   { asociatie: { select: { id: true, name: true } } },
    orderBy:   { createdAt: "desc" },
  })

  // Asociații disponibile pentru dropdown
  const asociatii = await db.asociatie.findMany({
    where:   { organizationId: orgId, isActive: true },
    select:  { id: true, name: true },
    orderBy: { name: "asc" },
  })

  return NextResponse.json({ type: "owner", members, asocUsers, invitations, asociatii })
}
