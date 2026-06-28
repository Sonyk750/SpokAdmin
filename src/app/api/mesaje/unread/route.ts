import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveParty } from "@/lib/chat";

// GET /api/mesaje/unread?asociatieId= — total mesaje necitite (badge sidebar)
export async function GET(req: NextRequest) {
  const session = await auth();
  const userId  = session?.user?.id;
  if (!userId) return NextResponse.json({ unread: 0 });

  const asociatieId = req.nextUrl.searchParams.get("asociatieId");
  if (!asociatieId) return NextResponse.json({ unread: 0 });

  const rp = await resolveParty(userId, asociatieId);
  if (!rp) return NextResponse.json({ unread: 0 });

  // Fire accesibile: anunțuri + direct (slot user sau, pt. staff, slot ADMINISTRATOR)
  const directOr: any[] = [{ participants: { some: { userId } } }];
  if (rp.party === "ADMINISTRATOR") directOr.push({ participants: { some: { role: "ADMINISTRATOR" } } });

  const threads = await db.chatThread.findMany({
    where: {
      asociatieId,
      OR: [{ kind: "announcement" }, { kind: "direct", OR: directOr }],
    },
    select: { id: true },
  });
  if (!threads.length) return NextResponse.json({ unread: 0 });

  const threadIds = threads.map(t => t.id);
  const reads = await db.chatRead.findMany({
    where: { userId, threadId: { in: threadIds } },
    select: { threadId: true, lastReadAt: true },
  });
  const readMap = new Map(reads.map(r => [r.threadId, r.lastReadAt]));

  let unread = 0;
  for (const id of threadIds) {
    const lastReadAt = readMap.get(id);
    unread += await db.chatMessage.count({
      where: {
        threadId: id,
        deletedAt: null,
        senderId: { not: userId },
        ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
      },
    });
  }

  return NextResponse.json({ unread });
}
