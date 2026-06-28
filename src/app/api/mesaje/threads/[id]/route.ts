import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  loadThreadForUser, loadCommMatrix, canBroadcast, canModerate,
  directCounterpart, PARTY_LABELS, type Party,
} from "@/lib/chat";

// GET /api/mesaje/threads/[id] — mesajele firului + metadata
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId  = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const ctx = await loadThreadForUser(id, userId);
  if (!ctx) return NextResponse.json({ error: "Fără acces" }, { status: 403 });

  const { thread, party } = ctx;

  const messages = await db.chatMessage.findMany({
    where: { threadId: id, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, senderId: true, senderRole: true, body: true, isPinned: true, createdAt: true },
  });

  const senderIds = [...new Set(messages.map(m => m.senderId))];
  const users = senderIds.length
    ? await db.user.findMany({ where: { id: { in: senderIds } }, select: { id: true, name: true, email: true } })
    : [];
  const nameMap = new Map(users.map(u => [u.id, u.name || u.email || "Utilizator"]));

  // titlu
  let title = thread.title || "Conversație";
  if (thread.kind === "direct") {
    const cp = directCounterpart(thread.participants, userId, party);
    if (cp.kind === "role") title = "Administrator";
    else if (cp.userId) {
      const u = await db.user.findUnique({ where: { id: cp.userId }, select: { name: true, email: true } });
      title = u?.name || u?.email || "Utilizator";
    }
  }

  const matrix = thread.kind === "announcement" ? await loadCommMatrix(thread.organizationId) : null;
  const canPost = thread.kind === "announcement" ? canBroadcast(matrix!, party) : true;
  const canMod  = thread.kind === "announcement" && canModerate(party);

  return NextResponse.json({
    id: thread.id,
    kind: thread.kind,
    title,
    party,
    canPost,
    canModerate: canMod,
    messages: messages.map(m => ({
      id: m.id,
      body: m.body,
      isPinned: m.isPinned,
      createdAt: m.createdAt,
      mine: m.senderId === userId,
      senderName: nameMap.get(m.senderId) ?? "Utilizator",
      senderRole: m.senderRole,
      senderRoleLabel: PARTY_LABELS[m.senderRole as Party] ?? m.senderRole,
    })),
  });
}
