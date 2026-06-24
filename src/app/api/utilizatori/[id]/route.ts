import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isSuperAdmin, canManageOrg } from "@/lib/roles"

type Params = { params: Promise<{ id: string }> }

// PATCH /api/utilizatori/[id]  — suspend/unsuspend/change role
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  const me      = session?.user
  if (!me) return NextResponse.json({ error: "Neautorizat" }, { status: 401 })

  const { id } = await params
  const body    = await req.json() as {
    action?: "suspend" | "unsuspend" | "delete_asoc_user" | "revoke_invitation"
    asocUserId?:    string
    invitationId?:  string
    role?:          string
  }

  const isSA = isSuperAdmin(me.role)
  const isOW = canManageOrg(me.role, me.orgRole)

  if (!isSA && !isOW) return NextResponse.json({ error: "Acces interzis" }, { status: 403 })

  // Nu te poți modifica pe tine însuți prin acest endpoint
  if (id === me.id) return NextResponse.json({ error: "Nu te poți modifica pe tine însuți" }, { status: 400 })

  const { action } = body

  if (action === "suspend" || action === "unsuspend") {
    const suspended = action === "suspend"

    if (isSA) {
      await db.user.update({ where: { id }, data: { isSuspended: suspended } })
    } else {
      // OWNER poate suspenda doar utilizatori din organizația sa
      const target = await db.user.findFirst({
        where: { id, memberships: { some: { organizationId: me.organizationId! } } },
      })
      if (!target) return NextResponse.json({ error: "Utilizator negăsit" }, { status: 404 })
      await db.user.update({ where: { id }, data: { isSuspended: suspended } })
    }
    return NextResponse.json({ success: true })
  }

  if (action === "delete_asoc_user" && body.asocUserId) {
    const asocUser = await db.asociatieUser.findUnique({ where: { id: body.asocUserId } })
    if (!asocUser) return NextResponse.json({ error: "Negăsit" }, { status: 404 })
    if (!isSA && asocUser.organizationId !== me.organizationId)
      return NextResponse.json({ error: "Acces interzis" }, { status: 403 })
    await db.asociatieUser.delete({ where: { id: body.asocUserId } })
    return NextResponse.json({ success: true })
  }

  if (action === "revoke_invitation" && body.invitationId) {
    const inv = await db.userInvitation.findUnique({ where: { id: body.invitationId } })
    if (!inv) return NextResponse.json({ error: "Negăsit" }, { status: 404 })
    if (!isSA && inv.organizationId !== me.organizationId)
      return NextResponse.json({ error: "Acces interzis" }, { status: 403 })
    await db.userInvitation.delete({ where: { id: body.invitationId } })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: "Acțiune necunoscută" }, { status: 400 })
}

// DELETE /api/utilizatori/[id]  — SUPER_ADMIN only: șterge user complet
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!isSuperAdmin(session?.user?.role))
    return NextResponse.json({ error: "Acces interzis" }, { status: 403 })

  const { id } = await params
  if (id === session!.user.id)
    return NextResponse.json({ error: "Nu te poți șterge pe tine însuți" }, { status: 400 })

  await db.user.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
