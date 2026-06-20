"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/app/components/Logo";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm]     = useState({ email: "", password: "" });
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await signIn("credentials", {
      email:    form.email,
      password: form.password,
      redirect: false,
    });

    setLoading(false);
    if (res?.error) {
      setError("Email sau parolă incorectă.");
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card__logo">
          <Logo height={40} />
        </div>

        <div className="auth-card__header">
          <h1 className="auth-card__title">Bun venit înapoi</h1>
          <p className="auth-card__sub">Conectează-te la contul tău DecoImob</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="auth-alert">{error}</div>}

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
            <label className="form-field__label">Parolă</label>
            <input
              type="password"
              className="input"
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              required
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="btn btn--primary btn--full btn--lg" disabled={loading}>
            {loading ? "Se conectează..." : "Conectare"}
          </button>
        </form>

        <p className="auth-card__footer">
          Nu ai cont?{" "}
          <Link href="/register" className="auth-card__link">
            Creează cont gratuit
          </Link>
        </p>
      </div>
    </div>
  );
}
