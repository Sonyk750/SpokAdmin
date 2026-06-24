import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import bcrypt from "bcryptjs"

type Params = { params: Promise<{ token: string }> }

// GET /api/invite/[token] — informații despre invitație (public)
export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params

  const inv = await db.userInvitation.findUnique({
    where: { token },
    include: {
      organization: { select: { name: true } },
      asociatie:    { select: { name: true } },
    },
  })

  if (!inv) return NextResponse.json({ error: "Invitație inexistentă" }, { status: 404 })
  if (inv.acceptedAt) return NextResponse.json({ error: "Invitație deja acceptată" }, { status: 410 })
  if (inv.expiresAt < new Date()) return NextResponse.json({ error: "Invitație expirată" }, { status: 410 })

  return NextResponse.json({
    email:     inv.email,
    name:      inv.name,
    role:      inv.role,
    orgName:   inv.organization.name,
    asocName:  inv.asociatie?.name ?? null,
    expiresAt: inv.expiresAt,
  })
}

// POST /api/invite/[token] — acceptă invitația + creează cont dacă nu există
export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await params

  const inv = await db.userInvitation.findUnique({
    where: { token },
    include: { organization: true },
  })

  if (!inv || inv.acceptedAt || inv.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invitație invalidă sau expirată" }, { status: 410 })
  }

  const { name, password } = await req.json() as { name: string; password: string }
  if (!name || !password || password.length < 6) {
    return NextResponse.json({ error: "Nume și parolă (min. 6 caractere) obligatorii" }, { status: 400 })
  }

  const hashed = await bcrypt.hash(password, 10)

  // Creează sau găsește userul
  let user = await db.user.findUnique({ where: { email: inv.email } })

  if (user) {
    // Actualizează parola/numele dacă există deja
    user = await db.user.update({ where: { id: user.id }, data: { name, password: hashed, isSuspended: false } })
  } else {
    user = await db.user.create({
      data: { email: inv.email, name, password: hashed, role: "USER", isActive: true },
    })
  }

  // Creează OrganizationMember dacă nu există
  await db.organizationMember.upsert({
    where:  { organizationId_userId: { organizationId: inv.organizationId, userId: user.id } },
    create: { organizationId: inv.organizationId, userId: user.id, role: "MEMBER" },
    update: {},
  })

  // Creează AsociatieUser dacă are asociatieId
  if (inv.asociatieId) {
    await db.asociatieUser.upsert({
      where:  { asociatieId_userId: { asociatieId: inv.asociatieId, userId: user.id } },
      create: {
        organizationId: inv.organizationId,
        asociatieId:    inv.asociatieId,
        userId:         user.id,
        role:           inv.role,
        apartamentId:   inv.apartamentId ?? null,
      },
      update: { role: inv.role },
    })
  }

  // Marchează invitația ca acceptată
  await db.userInvitation.update({
    where: { id: inv.id },
    data:  { acceptedAt: new Date() },
  })

  return NextResponse.json({ success: true, email: inv.email })
}
