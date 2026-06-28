import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { loadThreadForUser, loadCommMatrix, canBroadcast } from "@/lib/chat";

// POST /api/mesaje/threads/[id]/messages — postează un mesaj în fir
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId  = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const ctx = await loadThreadForUser(id, userId);
  if (!ctx) return NextResponse.json({ error: "Fără acces" }, { status: 403 });

  const { thread, party } = ctx;

  const { body } = await req.json().catch(() => ({}));
  const text = typeof body === "string" ? body.trim() : "";
  if (!text) return NextResponse.json({ error: "Mesaj gol" }, { status: 400 });
  if (text.length > 5000) return NextResponse.json({ error: "Mesaj prea lung" }, { status: 400 });

  // Pe feed-ul de anunțuri pot posta doar rolurile cu drept de broadcast
  if (thread.kind === "announcement") {
    const matrix = await loadCommMatrix(thread.organizationId);
    if (!canBroadcast(matrix, party))
      return NextResponse.json({ error: "Nu poți posta mesaje de interes" }, { status: 403 });
  }

  const now = new Date();
  const [msg] = await db.$transaction([
    db.chatMessage.create({
      data: { threadId: id, senderId: userId, senderRole: party, body: text },
      select: { id: true, createdAt: true },
    }),
    db.chatThread.update({ where: { id }, data: { lastMessageAt: now } }),
    db.chatRead.upsert({
      where:  { threadId_userId: { threadId: id, userId } },
      create: { threadId: id, userId, lastReadAt: now },
      update: { lastReadAt: now },
    }),
  ]);

  return NextResponse.json({ id: msg.id, createdAt: msg.createdAt });
}
