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

// ─── Abonament SpokAdmin ──────────────────────────────────────────────────────

const PLAN_LABELS: Record<string, string> = {
  start:    "Start (gratuit)",
  standard: "Standard — 99 lei/lună",
  pro:      "Pro — 199 lei/lună",
};

export async function sendAdminAbonamentNotification(opts: {
  orgName: string;
  userName: string;
  userEmail: string;
  plan: string;
  priceRon: number;
}) {
  const { orgName, userName, userEmail, plan, priceRon } = opts;
  const planLabel = PLAN_LABELS[plan] ?? plan;
  const html = shell("Abonament nou confirmat ✓", `
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;margin:0 0 16px">
      <p style="margin:0;font-size:14px;font-weight:700;color:#166534">✓ Plată Stripe confirmată — abonament activat</p>
    </div>
    <table style="font-size:14px;border-collapse:collapse;width:100%">
      <tr><td style="padding:7px 14px 7px 0;color:#64748b;white-space:nowrap">Organizație</td><td style="padding:7px 0;font-weight:700">${orgName}</td></tr>
      <tr><td style="padding:7px 14px 7px 0;color:#64748b">Utilizator</td><td style="padding:7px 0">${userName}</td></tr>
      <tr><td style="padding:7px 14px 7px 0;color:#64748b">Email</td><td style="padding:7px 0"><a href="mailto:${userEmail}" style="color:#7c3aed">${userEmail}</a></td></tr>
      <tr><td style="padding:7px 14px 7px 0;color:#64748b">Plan</td><td style="padding:7px 0;font-weight:700;color:#7c3aed">${planLabel}</td></tr>
      <tr><td style="padding:7px 14px 7px 0;color:#64748b">Sumă</td><td style="padding:7px 0;font-weight:800;color:#16a34a;font-size:16px">${priceRon} lei/lună</td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:12px;color:#94a3b8">Abonamentul a fost activat automat. Clientul a primit confirmare pe email.</p>
  `);
  const text = `Abonament nou: ${orgName} (${userEmail}) — ${planLabel} — ${priceRon} lei/lună`;
  return sendMail({ to: NOTIFY_EMAIL, subject: `SpokAdmin — abonament nou: ${orgName} — ${planLabel}`, html, text });
}

export async function sendClientAbonamentConfirmare(opts: {
  userName: string;
  userEmail: string;
  orgName: string;
  plan: string;
  priceRon: number;
  periodEnd: Date | null;
}) {
  const { userName, userEmail, orgName, plan, priceRon, periodEnd } = opts;
  const planLabel = PLAN_LABELS[plan] ?? plan;
  const APP_URL = process.env.NEXTAUTH_URL || "https://www.spokadmin.ro";
  const dateStr = periodEnd
    ? periodEnd.toLocaleDateString("ro-RO", { day: "2-digit", month: "long", year: "numeric" })
    : null;

  const html = shell("Abonament activat — SpokAdmin", `
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;margin:0 0 16px">
      <p style="margin:0;font-size:14px;font-weight:700;color:#166534">✓ Plata a fost confirmată — abonamentul tău este activ!</p>
    </div>
    <p style="font-size:14px;line-height:1.7;margin:0 0 16px">Salut, <strong>${userName}</strong>!</p>
    <p style="font-size:14px;line-height:1.7;margin:0 0 16px;color:#374151">
      Mulțumim pentru abonarea la <strong>SpokAdmin</strong>. Contul organizației
      <strong>${orgName}</strong> este acum activ pe planul ales.
    </p>
    <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;padding:16px 18px;margin:0 0 20px">
      <p style="margin:0;font-size:14px;color:#374151;line-height:1.9">
        <span style="color:#7c3aed;font-weight:700">Plan:</span> ${planLabel}<br>
        <span style="color:#7c3aed;font-weight:700">Suma lunară:</span> ${priceRon} lei/lună<br>
        ${dateStr ? `<span style="color:#7c3aed;font-weight:700">Prima reînnoire:</span> ${dateStr}<br>` : ""}
        <span style="color:#7c3aed;font-weight:700">Anulare:</span> Oricând, fără penalități
      </p>
    </div>
    <p style="font-size:14px;line-height:1.7;margin:0 0 20px;color:#374151">
      Poți gestiona abonamentul (upgrade, anulare) direct din aplicație, la secțiunea
      <strong>Abonament</strong> din meniu.
    </p>
    <p style="margin:0 0 24px">
      <a href="${APP_URL}/dashboard" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;font-size:14px">
        Intră în aplicație →
      </a>
    </p>
    <p style="margin:0;font-size:12px;color:#94a3b8">
      Întrebări sau probleme? Scrie-ne la
      <a href="mailto:office@spokadmin.ro" style="color:#7c3aed">office@spokadmin.ro</a>
      sau sună la <a href="tel:+40756362828" style="color:#7c3aed">0756 362 828</a>.
    </p>
  `);
  const text = `Abonamentul SpokAdmin ${planLabel} pentru ${orgName} este activ. Acces: ${APP_URL}/dashboard`;
  return sendMail({ to: userEmail, subject: `SpokAdmin — abonamentul tău ${planLabel} este activ ✓`, html, text });
}

// ─── Lista de plată — confirmare contabil ────────────────────────────────────

const LUNI_LABELS = [
  "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
  "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie",
];

export async function sendListaPlataPublicata(opts: {
  to: string; asocName: string; luna: number; an: number;
}) {
  const { to, asocName, luna, an } = opts;
  const perioada = `${LUNI_LABELS[luna - 1] ?? luna} ${an}`;
  const html = shell("Listă de plată disponibilă spre verificare", `
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6">Lista de plată pentru <strong>${asocName}</strong> — perioada <strong>${perioada}</strong> — a fost întocmită de contabil și este disponibilă pentru verificare.</p>
    <p style="margin:0;font-size:14px;line-height:1.6">O poți consulta din aplicația SpokAdmin.</p>
  `);
  const text = `Lista de plată ${asocName} — ${perioada} a fost întocmită și este disponibilă pentru verificare.`;
  return sendMail({ to, subject: `SpokAdmin — listă de plată ${perioada} disponibilă pentru verificare`, html, text });
}

export async function sendInstiintarePlataProprietar(opts: {
  to: string; asocName: string; luna: number; an: number; numarAp: string; suma: number; numeProprietar?: string | null;
}) {
  const { to, asocName, luna, an, numarAp, suma, numeProprietar } = opts;
  const perioada = `${LUNI_LABELS[luna - 1] ?? luna} ${an}`;
  const sumaStr = suma.toFixed(2);
  const APP_URL = process.env.NEXTAUTH_URL || "https://www.spokadmin.ro";
  const salut = numeProprietar ? `Stimate proprietar, <strong>${numeProprietar}</strong>,` : "Stimate proprietar,";

  const html = shell("Înștiințare de plată", `
    <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#374151">${salut}</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#374151">
      Asociația de proprietari <strong>${asocName}</strong> vă anunță că aveți de achitat cotele de întreținere
      pentru apartamentul <strong>${numarAp}</strong>, perioada <strong>${perioada}</strong>, în valoare de:
    </p>
    <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;padding:16px 18px;margin:0 0 20px;text-align:center">
      <p style="margin:0;font-size:22px;font-weight:800;color:#7c3aed">${sumaStr} lei</p>
    </div>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#374151">
      Pentru documentare (listă de întreținere, facturi, chitanțe), vă rugăm să accesați contul dumneavoastră din aplicația de administrare:
    </p>
    <p style="margin:0 0 20px">
      <a href="${APP_URL}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;font-size:14px">
        Accesează contul →
      </a>
    </p>
    <p style="margin:0;font-size:13px;color:#64748b">Cu stimă,<br>${asocName}</p>
  `);
  const text = `${numeProprietar ? `Stimate proprietar, ${numeProprietar},` : "Stimate proprietar,"}\n\nAsociația de proprietari ${asocName} vă anunță că aveți de achitat cotele de întreținere pentru apartamentul ${numarAp}, perioada ${perioada}, în valoare de ${sumaStr} lei.\n\nPentru documentare, accesați contul dumneavoastră: ${APP_URL}\n\nCu stimă,\n${asocName}`;
  return sendMail({ to, subject: `SpokAdmin — înștiințare de plată ${perioada} (ap. ${numarAp})`, html, text });
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
