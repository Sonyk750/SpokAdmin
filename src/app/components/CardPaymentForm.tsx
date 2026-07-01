"use client";
import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface CardPaymentFormProps {
  clientSecret: string;
  onSuccess: () => void;
  onCancel: () => void;
  suma: number;
}

export default function CardPaymentForm({ clientSecret, onSuccess, onCancel, suma }: CardPaymentFormProps) {
  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: "night",
          variables: {
            colorPrimary: "#7c3aed",
            colorBackground: "#0d1117",
            colorText: "#ffffff",
            colorTextSecondary: "#9ca3af",
            colorDanger: "#f87171",
            borderRadius: "12px",
            fontFamily: "DM Sans, sans-serif",
          },
          rules: {
            ".Input": { border: "1px solid rgba(255,255,255,0.1)", padding: "12px 14px" },
            ".Input:focus": { border: "1px solid rgba(124,58,237,0.6)", boxShadow: "0 0 0 3px rgba(124,58,237,0.15)" },
            ".Label": { color: "#9ca3af", fontSize: "12px", fontWeight: "600", letterSpacing: "0.08em", textTransform: "uppercase" },
          },
        },
      }}
    >
      <CheckoutForm onSuccess={onSuccess} onCancel={onCancel} suma={suma} />
    </Elements>
  );
}

function CheckoutForm({ onSuccess, onCancel, suma }: { onSuccess: () => void; onCancel: () => void; suma: number }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError("");

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message || "A aparut o eroare la procesarea platii.");
      setSubmitting(false);
      return;
    }

    if (paymentIntent?.status === "succeeded" || paymentIntent?.status === "processing") {
      onSuccess();
    }
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <PaymentElement />
      {error && (
        <p style={{
          padding: "0.75rem 1rem",
          background: "rgba(248,113,113,0.1)",
          border: "1px solid rgba(248,113,113,0.3)",
          borderRadius: "0.75rem",
          color: "#f87171",
          fontSize: "0.875rem",
        }}>
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={!stripe || submitting}
        style={{
          width: "100%",
          padding: "0.875rem 1.5rem",
          background: submitting ? "rgba(124,58,237,0.5)" : "#7c3aed",
          color: "#fff",
          border: "none",
          borderRadius: "0.75rem",
          fontSize: "1rem",
          fontWeight: "700",
          cursor: submitting ? "not-allowed" : "pointer",
          transition: "background 0.2s",
          boxShadow: "0 0 24px rgba(124,58,237,0.4)",
        }}
      >
        {submitting ? "Se proceseaza..." : `Plateste ${suma.toFixed(2)} lei`}
      </button>
      <button
        type="button"
        onClick={onCancel}
        style={{
          background: "none",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "#9ca3af",
          borderRadius: "0.75rem",
          padding: "0.625rem",
          cursor: "pointer",
          fontSize: "0.875rem",
        }}
      >
        Anuleaza
      </button>
    </form>
  );
}
