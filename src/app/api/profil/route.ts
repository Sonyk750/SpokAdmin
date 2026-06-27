import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth, updateSession } from "@/lib/auth";
import { db } from "@/lib/db";

// GET — datele contului curent
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const user = await db.user.findUnique({
    where:  { id: userId },
    select: { id: true, name: true, email: true, password: true },
  });
  if (!user) return NextResponse.json({ error: "Utilizator negăsit" }, { status: 404 });

  return NextResponse.json({ name: user.name, email: user.email, hasPassword: !!user.password });
}

// PATCH — actualizează numele și/sau parola contului curent
export async function PATCH(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const body = await req.json() as {
    name?: string;
    currentPassword?: string;
    newPassword?: string;
  };

  const user = await db.user.findUnique({ where: { id: userId }, select: { password: true } });
  if (!user) return NextResponse.json({ error: "Utilizator negăsit" }, { status: 404 });

  const data: { name?: string; password?: string } = {};

  // Nume
  if (body.name !== undefined) {
    const nume = body.name.trim();
    if (!nume) return NextResponse.json({ error: "Numele nu poate fi gol." }, { status: 400 });
    data.name = nume;
  }

  // Parolă (opțional)
  if (body.newPassword) {
    if (body.newPassword.length < 6)
      return NextResponse.json({ error: "Parola nouă trebuie să aibă minim 6 caractere." }, { status: 400 });
    if (user.password) {
      if (!body.currentPassword)
        return NextResponse.json({ error: "Introdu parola actuală." }, { status: 400 });
      const ok = await bcrypt.compare(body.currentPassword, user.password);
      if (!ok) return NextResponse.json({ error: "Parola actuală este incorectă." }, { status: 400 });
    }
    data.password = await bcrypt.hash(body.newPassword, 10);
  }

  if (Object.keys(data).length === 0)
    return NextResponse.json({ error: "Nimic de salvat." }, { status: 400 });

  const updated = await db.user.update({
    where:  { id: userId },
    data,
    select: { name: true, email: true },
  });

  // Reîmprospătează sesiunea (numele din antet) fără re-login
  if (data.name !== undefined) {
    try { await updateSession({ user: { name: updated.name } }); } catch { /* fallback: re-login */ }
  }

  return NextResponse.json({ ok: true, name: updated.name });
}
