"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAsociatie } from "@/lib/AsociatieContext";

// ─── Tipuri ───────────────────────────────────────────────────────────────────

interface ThreadItem {
  id: string;
  kind: "announcement" | "direct";
  title: string;
  unread: number;
  lastMessage: { body: string; createdAt: string } | null;
  lastMessageAt: string;
}
interface Message {
  id: string;
  body: string;
  isPinned: boolean;
  createdAt: string;
  mine: boolean;
  senderName: string;
  senderRole: string;
  senderRoleLabel: string;
}
interface ThreadDetail {
  id: string;
  kind: "announcement" | "direct";
  title: string;
  party: string;
  canPost: boolean;
  canModerate: boolean;
  messages: Message[];
}
interface Recipient { kind: "user" | "role"; id: string; label: string; party: string }

// ─── Utilitare ──────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit" }) + " " +
      d.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
}

async function jget(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || "Eroare");
  return r.json();
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function MesajeClient() {
  const { activeId, activeName } = useAsociatie();

  const [threads, setThreads]   = useState<ThreadItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [detail, setDetail]     = useState<ThreadDetail | null>(null);
  const [text, setText]         = useState("");
  const [sending, setSending]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const [newOpen, setNewOpen]   = useState(false);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [recLoading, setRecLoading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<string>("");
  selectedRef.current = selectedId;

  // ── Încarcă lista de fire ──
  const loadThreads = useCallback(async (autoSelect = false) => {
    if (!activeId) return;
    try {
      const data = await jget(`/api/mesaje/threads?asociatieId=${activeId}`);
      setThreads(data.threads);
      if (autoSelect && !selectedRef.current && data.announcementThreadId) {
        setSelectedId(data.announcementThreadId);
      }
      setError(null);
    } catch (e: any) { setError(e.message); }
  }, [activeId]);

  // ── Încarcă firul selectat ──
  const loadDetail = useCallback(async (id: string, markRead = false) => {
    if (!id) return;
    try {
      const data = await jget(`/api/mesaje/threads/${id}?asociatieId=${activeId}`);
      setDetail(data);
      if (markRead) {
        fetch(`/api/mesaje/threads/${id}/read`, { method: "POST" })
          .then(() => loadThreads());
      }
    } catch (e: any) { setError(e.message); }
  }, [activeId, loadThreads]);

  // Reset la schimbarea asociației
  useEffect(() => {
    setSelectedId(""); setDetail(null); setThreads([]);
    loadThreads(true);
  }, [activeId, loadThreads]);

  // La selectarea unui fir
  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    loadDetail(selectedId, true);
  }, [selectedId, loadDetail]);

  // Polling: lista la 15s, firul deschis la 5s
  useEffect(() => {
    if (!activeId) return;
    const a = setInterval(() => loadThreads(), 15000);
    const b = setInterval(() => { if (selectedRef.current) loadDetail(selectedRef.current); }, 5000);
    return () => { clearInterval(a); clearInterval(b); };
  }, [activeId, loadThreads, loadDetail]);

  // Auto-scroll jos la mesaje noi
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [detail?.messages.length, selectedId]);

  // ── Trimite mesaj ──
  async function send() {
    const t = text.trim();
    if (!t || !detail || sending) return;
    setSending(true);
    try {
      const r = await fetch(`/api/mesaje/threads/${detail.id}/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: t }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || "Eroare la trimitere");
      setText("");
      await loadDetail(detail.id);
      await loadThreads();
    } catch (e: any) { setError(e.message); }
    finally { setSending(false); }
  }

  // ── Moderare ──
  async function moderate(messageId: string, action: "delete" | "pin" | "unpin") {
    if (action === "delete" && !confirm("Ștergi acest mesaj?")) return;
    try {
      const r = await fetch(`/api/mesaje/messages/${messageId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || "Eroare");
      if (detail) await loadDetail(detail.id);
    } catch (e: any) { setError(e.message); }
  }

  // ── Conversație nouă ──
  async function openNew() {
    setNewOpen(true); setRecLoading(true);
    try {
      const data = await jget(`/api/mesaje/recipients?asociatieId=${activeId}`);
      setRecipients(data.recipients);
    } catch (e: any) { setError(e.message); }
    finally { setRecLoading(false); }
  }
  async function startConv(rec: Recipient) {
    try {
      const r = await fetch(`/api/mesaje/threads`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asociatieId: activeId, recipientKind: rec.kind, recipientId: rec.id }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Eroare");
      setNewOpen(false);
      await loadThreads();
      setSelectedId(data.id);
    } catch (e: any) { setError(e.message); }
  }

  if (!activeId) {
    return <div className="page-shell"><div className="empty-state">Selectează o asociație din antet.</div></div>;
  }

  const pinned = detail?.messages.filter(m => m.isPinned) ?? [];

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <div className="page-kicker">Comunicare</div>
          <h1 className="page-title">Mesaje</h1>
          <p className="page-sub">{activeName}</p>
        </div>
        <button className="btn btn--primary" onClick={openNew}>+ Conversație nouă</button>
      </div>

      {error && <div className="auth-alert" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="chat">
        {/* Lista de fire */}
        <aside className="chat__list">
          {threads.map(t => (
            <button
              key={t.id}
              className={`chat__item${selectedId === t.id ? " chat__item--active" : ""}`}
              onClick={() => setSelectedId(t.id)}
            >
              <div className="chat__item-top">
                <span className="chat__item-title">
                  {t.kind === "announcement" ? "📣 Mesaje de interes" : t.title}
                </span>
                {t.unread > 0 && <span className="chat__badge">{t.unread}</span>}
              </div>
              {t.lastMessage && (
                <span className="chat__item-preview">{t.lastMessage.body}</span>
              )}
            </button>
          ))}
          {!threads.length && <div className="chat__empty">Nicio conversație încă.</div>}
        </aside>

        {/* Firul activ */}
        <section className="chat__main">
          {!detail && <div className="chat__placeholder">Alege o conversație din stânga.</div>}

          {detail && (
            <>
              <header className="chat__header">
                <span className="chat__header-title">
                  {detail.kind === "announcement" ? "📣 Mesaje de interes" : detail.title}
                </span>
                {detail.kind === "announcement" && (
                  <span className="pill pill--violet">Anunțuri</span>
                )}
              </header>

              {pinned.length > 0 && (
                <div className="chat__pinned">
                  {pinned.map(m => (
                    <div key={`pin-${m.id}`} className="chat__pin">📌 {m.body}</div>
                  ))}
                </div>
              )}

              <div className="chat__messages" ref={scrollRef}>
                {detail.messages.map(m => (
                  <div key={m.id} className={`chat__msg${m.mine ? " chat__msg--mine" : ""}`}>
                    <div className="chat__msg-meta">
                      <span className="chat__msg-name">{m.senderName}</span>
                      <span className="chat__msg-role">{m.senderRoleLabel}</span>
                      <span className="chat__msg-time">{fmtTime(m.createdAt)}</span>
                    </div>
                    <div className="chat__bubble">{m.body}</div>
                    {(detail.canModerate || m.mine) && (
                      <div className="chat__msg-actions">
                        {detail.canModerate && (
                          <button onClick={() => moderate(m.id, m.isPinned ? "unpin" : "pin")}>
                            {m.isPinned ? "Anulează fixarea" : "Fixează"}
                          </button>
                        )}
                        <button onClick={() => moderate(m.id, "delete")}>Șterge</button>
                      </div>
                    )}
                  </div>
                ))}
                {!detail.messages.length && (
                  <div className="chat__placeholder">Niciun mesaj încă.</div>
                )}
              </div>

              {detail.canPost ? (
                <div className="chat__composer">
                  <textarea
                    className="input"
                    rows={2}
                    placeholder={detail.kind === "announcement" ? "Scrie un mesaj de interes…" : "Scrie un mesaj…"}
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  />
                  <button className="btn btn--primary" onClick={send} disabled={sending || !text.trim()}>
                    {sending ? "…" : "Trimite"}
                  </button>
                </div>
              ) : (
                <div className="chat__readonly">
                  {detail.kind === "announcement"
                    ? "Doar președintele și administratorul pot posta aici."
                    : "Nu poți scrie în această conversație."}
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {/* Modal conversație nouă */}
      {newOpen && (
        <div className="modal-overlay">
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal__header">
              <span className="modal__title">Conversație nouă</span>
              <button className="modal__close" onClick={() => setNewOpen(false)}>✕</button>
            </div>
            <div className="modal__body">
              {recLoading && <div className="chat__empty">Se încarcă…</div>}
              {!recLoading && !recipients.length && (
                <div className="chat__empty">Nu ai cu cine iniția o conversație directă.</div>
              )}
              {!recLoading && recipients.map(rec => (
                <button
                  key={`${rec.kind}-${rec.id}`}
                  className="chat__recipient"
                  onClick={() => startConv(rec)}
                >
                  {rec.kind === "role" ? "🏢 " : "👤 "}{rec.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
