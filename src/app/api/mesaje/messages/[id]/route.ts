import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { loadThreadForUser, canModerate } from "@/lib/chat";

// PATCH /api/mesaje/messages/[id] — { action: "delete" | "pin" | "unpin" }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId  = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const msg = await db.chatMessage.findUnique({
    where: { id },
    select: { id: true, threadId: true, senderId: true, deletedAt: true },
  });
  if (!msg) return NextResponse.json({ error: "Mesaj negăsit" }, { status: 404 });

  const ctx = await loadThreadForUser(msg.threadId, userId);
  if (!ctx) return NextResponse.json({ error: "Fără acces" }, { status: 403 });
  const { thread, party } = ctx;

  const { action } = await req.json().catch(() => ({}));
  const isMod = thread.kind === "announcement" && canModerate(party);

  if (action === "delete") {
    // moderator pe anunțuri, sau autorul propriului mesaj
    if (!isMod && msg.senderId !== userId)
      return NextResponse.json({ error: "Nu ai dreptul să ștergi acest mesaj" }, { status: 403 });
    await db.chatMessage.update({ where: { id }, data: { deletedAt: new Date(), deletedById: userId } });
    return NextResponse.json({ ok: true });
  }

  if (action === "pin" || action === "unpin") {
    if (!isMod) return NextResponse.json({ error: "Doar moderatorii pot fixa mesaje" }, { status: 403 });
    await db.chatMessage.update({ where: { id }, data: { isPinned: action === "pin" } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Acțiune invalidă" }, { status: 400 });
}
