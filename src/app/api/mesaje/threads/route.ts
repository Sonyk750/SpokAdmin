import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  resolveParty, loadCommMatrix, canBroadcast, canInitiate,
  getOrCreateAnnouncementThread, directCounterpart, type Party,
} from "@/lib/chat";

interface Slot { userId?: string; role?: string }

function slotEq(p: { userId: string | null; role: string | null }, s: Slot): boolean {
  if (s.userId) return p.userId === s.userId;
  if (s.role)   return p.role === s.role;
  return false;
}
function matchPair(parts: { userId: string | null; role: string | null }[], a: Slot, b: Slot): boolean {
  if (parts.length !== 2) return false;
  return (slotEq(parts[0], a) && slotEq(parts[1], b)) || (slotEq(parts[0], b) && slotEq(parts[1], a));
}

// ── GET: feed-ul de anunțuri + conversațiile directe ale utilizatorului ───────
export async function GET(req: NextRequest) {
  const session = await auth();
  const userId  = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const asociatieId = req.nextUrl.searchParams.get("asociatieId");
  if (!asociatieId) return NextResponse.json({ error: "asociatieId lipsă" }, { status: 400 });

  const rp = await resolveParty(userId, asociatieId);
  if (!rp) return NextResponse.json({ error: "Fără acces" }, { status: 403 });

  const matrix = await loadCommMatrix(rp.organizationId);

  // Asigură feed-ul de anunțuri
  const ann = await getOrCreateAnnouncementThread(asociatieId, rp.organizationId, userId);

  const directOr: any[] = [{ participants: { some: { userId } } }];
  if (rp.party === "ADMINISTRATOR") directOr.push({ participants: { some: { role: "ADMINISTRATOR" } } });

  const threads = await db.chatThread.findMany({
    where: {
      asociatieId,
      OR: [{ id: ann.id }, { kind: "direct", OR: directOr }],
    },
    include: {
      participants: { select: { userId: true, role: true } },
      messages: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { body: true, createdAt: true, senderId: true },
      },
    },
    orderBy: { lastMessageAt: "desc" },
  });

  const reads = await db.chatRead.findMany({
    where: { userId, threadId: { in: threads.map(t => t.id) } },
    select: { threadId: true, lastReadAt: true },
  });
  const readMap = new Map(reads.map(r => [r.threadId, r.lastReadAt]));

  // Nume pentru sloturile-user din conversațiile directe
  const otherUserIds = new Set<string>();
  for (const t of threads) {
    if (t.kind !== "direct") continue;
    const cp = directCounterpart(t.participants, userId, rp.party);
    if (cp.kind === "user" && cp.userId) otherUserIds.add(cp.userId);
  }
  const users = otherUserIds.size
    ? await db.user.findMany({ where: { id: { in: [...otherUserIds] } }, select: { id: true, name: true, email: true } })
    : [];
  const userMap = new Map(users.map(u => [u.id, u.name || u.email || "Utilizator"]));

  const items = await Promise.all(threads.map(async t => {
    const lastReadAt = readMap.get(t.id);
    const unread = await db.chatMessage.count({
      where: { threadId: t.id, deletedAt: null, senderId: { not: userId }, ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}) },
    });
    let title = t.title || "Conversație";
    if (t.kind === "direct") {
      const cp = directCounterpart(t.participants, userId, rp.party);
      title = cp.kind === "role" ? "Administrator" : (cp.userId ? userMap.get(cp.userId) ?? "Utilizator" : "Conversație");
    }
    const last = t.messages[0];
    return {
      id: t.id,
      kind: t.kind,
      title,
      unread,
      lastMessage: last ? { body: last.body, createdAt: last.createdAt } : null,
      lastMessageAt: t.lastMessageAt,
    };
  }));

  // anunțul mereu primul
  items.sort((a, b) => {
    if (a.kind === "announcement") return -1;
    if (b.kind === "announcement") return 1;
    return +new Date(b.lastMessageAt) - +new Date(a.lastMessageAt);
  });

  return NextResponse.json({
    party: rp.party,
    canBroadcast: canBroadcast(matrix, rp.party),
    announcementThreadId: ann.id,
    threads: items,
  });
}

// ── POST: creează (sau găsește) o conversație directă ─────────────────────────
export async function POST(req: NextRequest) {
  const session = await auth();
  const userId  = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { asociatieId, recipientKind, recipientId } = body as
    { asociatieId?: string; recipientKind?: "user" | "role"; recipientId?: string };

  if (!asociatieId || !recipientKind || !recipientId)
    return NextResponse.json({ error: "Parametri lipsă" }, { status: 400 });

  const rp = await resolveParty(userId, asociatieId);
  if (!rp) return NextResponse.json({ error: "Fără acces" }, { status: 403 });

  const matrix = await loadCommMatrix(rp.organizationId);

  // Determină rolul țintă
  let targetParty: Party;
  if (recipientKind === "role") {
    if (recipientId !== "ADMINISTRATOR") return NextResponse.json({ error: "Destinatar invalid" }, { status: 400 });
    targetParty = "ADMINISTRATOR";
  } else {
    if (recipientId === userId) return NextResponse.json({ error: "Nu poți iniția cu tine însuți" }, { status: 400 });
    const tu = await db.asociatieUser.findUnique({
      where: { asociatieId_userId: { asociatieId, userId: recipientId } },
      select: { role: true, isSuspended: true },
    });
    if (!tu || tu.isSuspended) return NextResponse.json({ error: "Destinatar negăsit" }, { status: 404 });
    targetParty = tu.role as Party;
  }

  if (!canInitiate(matrix, rp.party, targetParty))
    return NextResponse.json({ error: "Nu ai dreptul să inițiezi această conversație" }, { status: 403 });

  // Sloturile conversației
  const mySlot:     Slot = rp.party === "ADMINISTRATOR" ? { role: "ADMINISTRATOR" } : { userId };
  const targetSlot: Slot = recipientKind === "role"     ? { role: "ADMINISTRATOR" } : { userId: recipientId };

  // Dedupe: caută un thread direct existent cu aceleași sloturi
  const candidates = await db.chatThread.findMany({
    where: { asociatieId, kind: "direct" },
    include: { participants: { select: { userId: true, role: true } } },
  });
  const found = candidates.find(t => matchPair(t.participants, mySlot, targetSlot));
  if (found) return NextResponse.json({ id: found.id, existing: true });

  const created = await db.chatThread.create({
    data: {
      asociatieId,
      organizationId: rp.organizationId,
      kind: "direct",
      createdById: userId,
      participants: { create: [mySlot, targetSlot] },
    },
    select: { id: true },
  });

  return NextResponse.json({ id: created.id, existing: false });
}
