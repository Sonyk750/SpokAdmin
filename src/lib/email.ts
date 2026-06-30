import nodemailer from "nodemailer";

// ─── Configurare SMTP (cPanel — office@spokadmin.ro) ──────────────────────────
// Valorile vin din variabile de mediu (Vercel). Implicit: serverul cPanel.
const SMTP_HOST = process.env.SMTP_HOST ?? "mail.spokadmin.ro";
const SMTP_PORT = parseInt(process.env.SMTP_PORT ?? "465", 10);
const SMTP_USER = process.env.SMTP_USER ?? "office@spokadmin.ro";
const SMTP_PASS = process.env.SMTP_PASS ?? "";
const SMTP_FROM = process.env.SMTP_FROM ?? `SpokAdmin <${SMTP_USER}>`;
// Adresa unde primește administratorul notificările.
export const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL ?? "office@spokadmin.ro";

let cachedTransporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;
  cachedTransporter = nodemailer.createTransport({
    host:   SMTP_HOST,
    port:   SMTP_PORT,
    secure: SMTP_PORT === 465, // 465 = SSL/TLS direct
    auth:   { user: SMTP_USER, pass: SMTP_PASS },
    // Timeouts mici ca trimiterea să nu blocheze niciodată requestul prea mult.
    connectionTimeout: 10_000,
    greetingTimeout:   10_000,
    socketTimeout:     15_000,
  });
  return cachedTransporter;
}

export function emailConfigured(): boolean {
  return Boolean(SMTP_PASS);
}

interface MailInput { to: string; subject: string; html: string; text?: string; }

/**
 * Trimite un email. Nu aruncă — întoarce { ok }. Apelantul decide ce face dacă
 * trimiterea eșuează (ex. invitația rămâne validă, cu link de copiat ca fallback).
 */
export async function sendMail({ to, subject, html, text }: MailInput): Promise<{ ok: boolean; error?: string }> {
  if (!emailConfigured()) {
    return { ok: false, error: "SMTP neconfigurat (lipsește SMTP_PASS)." };
  }
  try {
    await getTransporter().sendMail({ from: SMTP_FROM, to, subject, html, text });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}

// ─── Șabloane ─────────────────────────────────────────────────────────────────

function shell(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
    <div style="background:#7c3aed;padding:18px 24px"><span style="color:#fff;font-size:18px;font-weight:800;letter-spacing:.3px">SpokAdmin</span></div>
    <div style="padding:24px">
      <h1 style="font-size:18px;margin:0 0 14px">${title}</h1>
      ${bodyHtml}
    </div>
    <div style="padding:14px 24px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:12px">Acest email a fost trimis automat de aplicația SpokAdmin.</div>
  </div></body></html>`;
}

export async function sendInvitationEmail(opts: {
  to: string; inviteUrl: string; orgName: string; asocName?: string | null; roleLabel: string;
}) {
  const { to, inviteUrl, orgName, asocName, roleLabel } = opts;
  const html = shell("Ai fost invitat în SpokAdmin", `
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6">Ai primit acces în aplicația <strong>SpokAdmin</strong> pentru <strong>${orgName}</strong>${asocName ? ` — asociația <strong>${asocName}</strong>` : ""}, cu rolul <strong>${roleLabel}</strong>.</p>
    <p style="margin:0 0 18px;font-size:14px;line-height:1.6">Apasă butonul de mai jos ca să-ți setezi parola și să-ți activezi contul:</p>
    <p style="margin:0 0 18px"><a href="${inviteUrl}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700;font-size:14px">Activează contul</a></p>
    <p style="margin:0;font-size:12px;color:#64748b">Sau copiază linkul: <br><span style="word-break:break-all">${inviteUrl}</span></p>
    <p style="margin:14px 0 0;font-size:12px;color:#94a3b8">Linkul este valabil 7 zile.</p>
  `);
  const text = `Ai fost invitat în SpokAdmin pentru ${orgName}${asocName ? ` (asociația ${asocName})` : ""}, rol ${roleLabel}.\nActivează-ți contul: ${inviteUrl}\nLink valabil 7 zile.`;
  return sendMail({ to, subject: "Invitație SpokAdmin — activează-ți contul", html, text });
}

export async function sendLoginNotification(opts: {
  userName: string | null; userEmail: string; orgName?: string | null;
}) {
  const { userName, userEmail, orgName } = opts;
  const html = shell("Un utilizator a intrat în aplicație", `
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6">Utilizatorul invitat s-a logat pentru prima dată în SpokAdmin:</p>
    <table style="font-size:14px;border-collapse:collapse">
      <tr><td style="padding:4px 12px 4px 0;color:#64748b">Nume</td><td style="padding:4px 0;font-weight:700">${userName || "—"}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#64748b">Email</td><td style="padding:4px 0;font-weight:700">${userEmail}</td></tr>
      ${orgName ? `<tr><td style="padding:4px 12px 4px 0;color:#64748b">Organizație</td><td style="padding:4px 0;font-weight:700">${orgName}</td></tr>` : ""}
    </table>
  `);
  const text = `Utilizatorul ${userName || ""} (${userEmail}) s-a logat pentru prima dată în SpokAdmin.`;
  return sendMail({ to: NOTIFY_EMAIL, subject: "SpokAdmin — un utilizator a intrat în aplicație", html, text });
}
