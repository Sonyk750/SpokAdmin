import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { canManageOrg, invitationExpiresAt, ASOC_ROLES, ASOC_ROLE_LABELS } from "@/lib/roles"
import { sendInvitationEmail, emailConfigured } from "@/lib/email"

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

  const baseUrl   = process.env.NEXTAUTH_URL ?? new URL(req.url).origin
  const inviteUrl = `${baseUrl}/invite/${invitation.token}`

  // Trimite emailul de invitație. Dacă SMTP eșuează, invitația rămâne validă
  // (adminul poate copia linkul returnat), deci nu blocăm răspunsul.
  let emailSent = false
  let emailError: string | null = null
  if (emailConfigured()) {
    const org = await db.organization.findUnique({ where: { id: me.organizationId }, select: { name: true } })
    const asoc = asociatieId
      ? await db.asociatie.findUnique({ where: { id: asociatieId }, select: { name: true } })
      : null
    const res = await sendInvitationEmail({
      to:        email,
      inviteUrl,
      orgName:   org?.name ?? "asociația ta",
      asocName:  asoc?.name ?? null,
      roleLabel: ASOC_ROLE_LABELS[role as keyof typeof ASOC_ROLE_LABELS] ?? role,
    })
    emailSent  = res.ok
    emailError = res.ok ? null : (res.error ?? "Eroare la trimiterea emailului")
  } else {
    emailError = "SMTP neconfigurat — folosește linkul de mai jos."
  }

  return NextResponse.json({ invitation, inviteUrl, emailSent, emailError }, { status: 201 })
}
