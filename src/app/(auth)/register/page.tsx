"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/app/components/Logo";

const PLAN_INFO: Record<string, { name: string; price: string; color: string }> = {
  standard: { name: "Standard", price: "99 lei/lună", color: "#a78bfa" },
  pro:      { name: "Pro",      price: "199 lei/lună", color: "#7c3aed" },
};

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planKey = searchParams.get("plan") ?? "";
  const planInfo = PLAN_INFO[planKey] ?? null;

  const [form, setForm]     = useState({ name: "", email: "", password: "", companyName: "" });
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(form),
    });

    const data = await res.json();

    if (!res.ok) {
      setLoading(false);
      setError(data.error ?? "Eroare la înregistrare.");
      return;
    }

    // Daca a ales un plan platit, initiaza checkout Stripe inainte de login
    if (planInfo && data.userId) {
      try {
        const checkoutRes = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: planKey, userId: data.userId }),
        });
        const checkoutData = await checkoutRes.json();
        if (checkoutData.url) {
          // Login in background, redirect la Stripe
          await signIn("credentials", { email: form.email, password: form.password, redirect: false });
          window.location.href = checkoutData.url;
          return;
        }
        // Checkout a esuat — continua normal catre dashboard
        console.error("[checkout]", checkoutData.error);
      } catch (e) {
        console.error("[checkout]", e);
      }
    }

    // Fara plan platit (sau checkout esuat) → login si dashboard
    await signIn("credentials", {
      email:    form.email,
      password: form.password,
      redirect: false,
    });

    router.push("/dashboard");
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card__logo">
          <Logo height={40} />
        </div>

        <div className="auth-card__header">
          <h1 className="auth-card__title">Creează cont</h1>
          {planInfo ? (
            <p className="auth-card__sub">
              Planul ales:{" "}
              <strong style={{ color: planInfo.color }}>{planInfo.name} — {planInfo.price}</strong>
            </p>
          ) : (
            <p className="auth-card__sub">Începe administrarea profesională în câteva secunde</p>
          )}
        </div>

        {planInfo && (
          <div style={{
            margin: "0 0 1.25rem",
            padding: "0.875rem 1rem",
            background: "rgba(124,58,237,0.08)",
            border: "1px solid rgba(124,58,237,0.25)",
            borderRadius: "0.75rem",
            fontSize: "0.875rem",
            color: "#c4b5fd",
            lineHeight: 1.6,
          }}>
            <strong style={{ color: planInfo.color }}>✓ Plan {planInfo.name}</strong> — după înregistrare vei fi direcționat
            către pagina de plată Stripe pentru a activa abonamentul.
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="auth-alert">{error}</div>}

          <div className="form-field">
            <label className="form-field__label">Numele tău</label>
            <input
              type="text"
              className="input"
              placeholder="Ion Popescu"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              required
            />
          </div>

          <div className="form-field">
            <label className="form-field__label">Firma de administrare</label>
            <input
              type="text"
              className="input"
              placeholder="SC Administrare SRL"
              value={form.companyName}
              onChange={e => setForm(p => ({ ...p, companyName: e.target.value }))}
              required
            />
          </div>

          <div className="form-field">
            <label className="form-field__label">Email</label>
            <input
              type="email"
              className="input"
              placeholder="email@firma.ro"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-field">
            <label className="form-field__label">Parolă (minim 8 caractere)</label>
            <input
              type="password"
              className="input"
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          <button type="submit" className="btn btn--primary btn--full btn--lg" disabled={loading}>
            {loading
              ? (planInfo ? "Se procesează..." : "Se creează contul...")
              : (planInfo ? `Creează cont și plătește ${planInfo.name}` : "Creează cont gratuit")}
          </button>
        </form>

        <p className="auth-card__footer">
          Ai deja cont?{" "}
          <Link href="/login" className="auth-card__link">
            Conectează-te
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
