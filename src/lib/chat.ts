import { db } from "@/lib/db";

// ─── Părți de comunicare ──────────────────────────────────────────────────────
// ADMINISTRATOR = staff-ul firmei (OrganizationMember). Celelalte vin din AsociatieUser.

export const COMM_PARTIES = ["ADMINISTRATOR", "PRESEDINTE", "CENZOR", "PROPRIETAR"] as const;
export type Party = (typeof COMM_PARTIES)[number];

export const PARTY_LABELS: Record<Party, string> = {
  ADMINISTRATOR: "Administrator",
  PRESEDINTE:    "Președinte",
  CENZOR:        "Cenzor",
  PROPRIETAR:    "Proprietar",
};

export type CommRow = Record<Party, boolean>;
export interface CommMatrix {
  broadcast: Record<Party, boolean>;        // cine poate posta mesaje de interes
  direct:    Record<Party, CommRow>;        // direct[from][to] = from poate iniția cu to
}

// Matricea implicită cerută: proprietarul NU comunică direct cu administratorul.
export const DEFAULT_COMM: CommMatrix = {
  broadcast: { ADMINISTRATOR: true, PRESEDINTE: true, CENZOR: false, PROPRIETAR: false },
  direct: {
    PROPRIETAR:    { PROPRIETAR: true,  PRESEDINTE: true,  CENZOR: false, ADMINISTRATOR: false },
    PRESEDINTE:    { PROPRIETAR: true,  PRESEDINTE: false, CENZOR: true,  ADMINISTRATOR: true  },
    CENZOR:        { PROPRIETAR: false, PRESEDINTE: true,  CENZOR: false, ADMINISTRATOR: true  },
    ADMINISTRATOR: { PROPRIETAR: false, PRESEDINTE: true,  CENZOR: true,  ADMINISTRATOR: false },
  },
};

// ─── Încărcare / normalizare matrice ──────────────────────────────────────────

function normalizeComm(raw: unknown): CommMatrix {
  const src = (raw && typeof raw === "object" ? raw : {}) as Partial<CommMatrix>;
  const broadcast = { ...DEFAULT_COMM.broadcast };
  for (const p of COMM_PARTIES) {
    if (src.broadcast && typeof src.broadcast[p] === "boolean") broadcast[p] = src.broadcast[p]!;
  }
  const direct = {} as Record<Party, CommRow>;
  for (const from of COMM_PARTIES) {
    direct[from] = { ...DEFAULT_COMM.direct[from] };
    const row = src.direct?.[from];
    if (row) {
      for (const to of COMM_PARTIES) {
        if (typeof row[to] === "boolean") direct[from][to] = row[to]!;
      }
    }
  }
  return { broadcast, direct };
}

/** Citește matricea de comunicare din Organization.rolePermissions.comunicare (merge cu default). */
export async function loadCommMatrix(organizationId: string): Promise<CommMatrix> {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { rolePermissions: true },
  });
  let parsed: any = {};
  try { parsed = org?.rolePermissions ? JSON.parse(org.rolePermissions) : {}; } catch { parsed = {}; }
  return normalizeComm(parsed?.comunicare);
}

// ─── Verificări de permisiuni ─────────────────────────────────────────────────

export function canBroadcast(matrix: CommMatrix, party: Party): boolean {
  return !!matrix.broadcast[party];
}

export function canInitiate(matrix: CommMatrix, from: Party, to: Party): boolean {
  return !!matrix.direct[from]?.[to];
}

/** Moderatori ai feed-ului de anunțuri: președinte + administrator. */
export function canModerate(party: Party): boolean {
  return party === "PRESEDINTE" || party === "ADMINISTRATOR";
}

// ─── Rezolvarea părții unui utilizator pentru o asociație ─────────────────────

export interface ResolvedParty {
  party:          Party;
  organizationId: string;
  asociatieId:    string;
}

/**
 * Determină partea de comunicare a unui (user, asociatie):
 * 1. AsociatieUser → PRESEDINTE | CENZOR | PROPRIETAR
 * 2. altfel staff al org-ului → ADMINISTRATOR
 * 3. altfel null (fără acces)
 */
export async function resolveParty(userId: string, asociatieId: string): Promise<ResolvedParty | null> {
  const asoc = await db.asociatie.findUnique({
    where: { id: asociatieId },
    select: { id: true, organizationId: true },
  });
  if (!asoc) return null;

  const au = await db.asociatieUser.findUnique({
    where: { asociatieId_userId: { asociatieId, userId } },
    select: { role: true, isSuspended: true },
  });
  if (au && !au.isSuspended && (COMM_PARTIES as readonly string[]).includes(au.role)) {
    return { party: au.role as Party, organizationId: asoc.organizationId, asociatieId };
  }

  const member = await db.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: asoc.organizationId, userId } },
    select: { id: true },
  });
  if (member) {
    return { party: "ADMINISTRATOR", organizationId: asoc.organizationId, asociatieId };
  }

  return null;
}

// ─── Destinatari permiși pentru o conversație nouă ────────────────────────────

export interface Recipient {
  kind:  "user" | "role";
  id:    string;          // userId, sau "ADMINISTRATOR" pentru slotul firmei
  label: string;
  party: Party;
}

/** Lista destinatarilor cu care `party` poate iniția o conversație privată. */
export async function allowedRecipients(
  matrix: CommMatrix,
  party: Party,
  organizationId: string,
  asociatieId: string,
  currentUserId: string,
): Promise<Recipient[]> {
  const out: Recipient[] = [];

  // Roluri-țintă de tip user (din AsociatieUser)
  const userTargets = (["PRESEDINTE", "CENZOR", "PROPRIETAR"] as Party[])
    .filter(to => canInitiate(matrix, party, to));

  if (userTargets.length) {
    const members = await db.asociatieUser.findMany({
      where: { asociatieId, role: { in: userTargets }, isSuspended: false },
      select: {
        userId: true,
        role:   true,
        user:   { select: { name: true, email: true } },
      },
    });

    for (const m of members) {
      if (m.userId === currentUserId) continue;
      const name = m.user?.name || m.user?.email || "Utilizator";
      out.push({
        kind:  "user",
        id:    m.userId,
        label: `${name} (${PARTY_LABELS[m.role as Party]})`,
        party: m.role as Party,
      });
    }
  }

  // Slotul ADMINISTRATOR (firma) — o singură "intrare", vizibilă de tot staff-ul
  if (canInitiate(matrix, party, "ADMINISTRATOR")) {
    out.push({ kind: "role", id: "ADMINISTRATOR", label: "Administrator", party: "ADMINISTRATOR" });
  }

  return out;
}

// ─── Thread: get-or-create anunțuri + acces ───────────────────────────────────

export interface SlotRow { userId: string | null; role: string | null }

/** Feed-ul de anunțuri al asociației (unul singur, creat la nevoie). */
export async function getOrCreateAnnouncementThread(
  asociatieId: string,
  organizationId: string,
  userId: string,
) {
  const existing = await db.chatThread.findFirst({
    where: { asociatieId, kind: "announcement" },
  });
  if (existing) return existing;
  return db.chatThread.create({
    data: { asociatieId, organizationId, kind: "announcement", title: "Mesaje de interes", createdById: userId },
  });
}

/** Încarcă un thread + verifică accesul utilizatorului; întoarce null dacă n-are acces. */
export async function loadThreadForUser(threadId: string, userId: string) {
  const thread = await db.chatThread.findUnique({
    where: { id: threadId },
    include: { participants: { select: { userId: true, role: true } } },
  });
  if (!thread) return null;

  const rp = await resolveParty(userId, thread.asociatieId);
  if (!rp) return null;

  if (thread.kind === "announcement") {
    return { thread, party: rp.party };
  }

  // direct: acces dacă ești slot-user sau ești staff pe slotul ADMINISTRATOR
  const isSlotUser  = thread.participants.some(p => p.userId === userId);
  const isAdminSlot = rp.party === "ADMINISTRATOR" && thread.participants.some(p => p.role === "ADMINISTRATOR");
  if (isSlotUser || isAdminSlot) return { thread, party: rp.party };

  return null;
}

/** Slotul "celuilalt" dintr-o conversație directă, relativ la utilizatorul curent. */
export function directCounterpart(
  participants: SlotRow[],
  userId: string,
  party: Party,
): { kind: "role" | "user"; userId?: string } {
  const others = participants.filter(p =>
    party === "ADMINISTRATOR" ? p.role !== "ADMINISTRATOR" : p.userId !== userId
  );
  const other = others[0];
  if (!other) return { kind: "user" };
  if (other.role === "ADMINISTRATOR") return { kind: "role" };
  return { kind: "user", userId: other.userId ?? undefined };
}
