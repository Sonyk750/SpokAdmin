import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { loadThreadForUser } from "@/lib/chat";

// POST /api/mesaje/threads/[id]/read — marchează firul ca citit
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId  = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const ctx = await loadThreadForUser(id, userId);
  if (!ctx) return NextResponse.json({ error: "Fără acces" }, { status: 403 });

  const now = new Date();
  await db.chatRead.upsert({
    where:  { threadId_userId: { threadId: id, userId } },
    create: { threadId: id, userId, lastReadAt: now },
    update: { lastReadAt: now },
  });

  return NextResponse.json({ ok: true });
}
