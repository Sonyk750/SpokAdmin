import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { canManageOrg, invitationExpiresAt, ASOC_ROLES } from "@/lib/roles"

// POST /api/utilizatori/invite
// OWNER creează o invitație pentru un PRESEDINTE / CENZOR / PROPRIETAR
export async function POST(req: NextRequest) {
  const session = await auth()
  const me      = session?.user
  if (!me || !canManageOrg(me.role, me.orgRole) || !me.organizationId) {
    return NextResponse.json({ error: "Acces interzis" }, { status: 403 })
  }

  const { email, name, role, asociatieId, apartamentId } = await req.json() as {
    email: string; name?: string
    role: string; asociatieId?: string; apartamentId?: string
  }

  if (!email || !role) return NextResponse.json({ error: "Email și rol sunt obligatorii" }, { status: 400 })
  const validRoles = Object.values(ASOC_ROLES)
  if (!validRoles.includes(role as any))
    return NextResponse.json({ error: "Rol invalid" }, { status: 400 })

  // Verifică că asociatia aparține organizației
  if (asociatieId) {
    const asoc = await db.asociatie.findFirst({
      where: { id: asociatieId, organizationId: me.organizationId },
    })
    if (!asoc) return NextResponse.json({ error: "Asociație negăsită" }, { status: 404 })
  }

  // Verifică dacă există deja o invitație activă pentru acest email + asociație
  const existing = await db.userInvitation.findFirst({
    where: {
      organizationId: me.organizationId,
      email,
      asociatieId:  asociatieId ?? null,
      acceptedAt:   null,
      expiresAt:    { gt: new Date() },
    },
  })
  if (existing) return NextResponse.json({ error: "Există deja o invitație activă pentru acest email" }, { status: 409 })

  const invitation = await db.userInvitation.create({
    data: {
      organizationId: me.organizationId,
      email,
      name:          name ?? null,
      role,
      asociatieId:   asociatieId ?? null,
      apartamentId:  apartamentId ?? null,
      expiresAt:     invitationExpiresAt(),
      createdById:   me.id,
    },
  })

  const inviteUrl = `${process.env.NEXTAUTH_URL ?? ""}/invite/${invitation.token}`
  return NextResponse.json({ invitation, inviteUrl }, { status: 201 })
}
