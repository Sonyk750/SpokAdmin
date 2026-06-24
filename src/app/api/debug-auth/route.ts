import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import bcrypt from "bcryptjs"

// DELETE THIS FILE after debugging!
export async function GET() {
  try {
    const user = await db.user.findUnique({
      where: { email: "office@spokadmin.ro" },
      include: { memberships: { take: 1 } },
    })

    if (!user) return NextResponse.json({ step: "NOT_FOUND" })

    const passwordOk = user.password
      ? await bcrypt.compare("Sonyk750/-", user.password)
      : false

    return NextResponse.json({
      step:        "FOUND",
      email:       user.email,
      role:        user.role,
      isActive:    user.isActive,
      isSuspended: (user as any).isSuspended,
      hasPassword: !!user.password,
      passwordOk,
      memberships: user.memberships.length,
    })
  } catch (e: any) {
    return NextResponse.json({ step: "ERROR", message: e.message })
  }
}
