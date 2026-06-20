"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/app/components/Logo";

export default function RegisterPage() {
  const router = useRouter();
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
          <p className="auth-card__sub">Începe administrarea profesională în câteva secunde</p>
        </div>

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
            {loading ? "Se creează contul..." : "Creează cont gratuit"}
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
