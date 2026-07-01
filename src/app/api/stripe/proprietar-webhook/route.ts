// POST /api/stripe/proprietar-webhook
// Webhook Stripe: la payment_intent.succeeded creeaza Incasare in DB.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import type Stripe from "stripe";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig!,
      process.env.STRIPE_PROPRIETAR_WEBHOOK_SECRET!,
    );
  } catch (e) {
    console.error("[proprietar-webhook] Semnatura invalida:", e);
    return NextResponse.json({ error: "Semnatura invalida" }, { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as Stripe.PaymentIntent;

    // Evita procesare dubla
    const intent = await db.stripePaymentIntent.findUnique({ where: { stripeId: pi.id } });
    if (!intent || intent.status === "succeeded") {
      return NextResponse.json({ received: true });
    }

    const { apartamentId, asociatieId, organizationId, nrApartament, proprietarNume, pozitiiJson } = pi.metadata as Record<string, string>;

    const pozitii: { tip: string; denumire: string; suma: number; fondId?: string }[] =
      JSON.parse(pozitiiJson || "[]");

    const sumaIncasata = pozitii.reduce((s, p) => s + (p.suma || 0), 0);

    // Actualizeaza solduri
    for (const p of pozitii) {
      if (!p.suma || p.suma <= 0) continue;
      if (p.tip === "intretinere_curenta") {
        await db.soldApartament.updateMany({
          where: { apartamentId },
          data: { intretinereCurenta: { decrement: p.suma } },
        });
      } else if (p.tip === "intretinere") {
        await db.soldApartament.updateMany({
          where: { apartamentId },
          data: { restantaIntretinere: { decrement: p.suma } },
        });
      } else if (p.tip === "fond" && p.fondId) {
        await db.fondApartament.updateMany({
          where: { apartamentId, fondId: p.fondId },
          data: { restanta: { decrement: p.suma } },
        });
      }
    }

    // Creeaza incasarea
    await db.incasare.create({
      data: {
        organizationId,
        asociatieId,
        apartamentId,
        nrApartament,
        proprietarNume: proprietarNume || null,
        serie: null,
        numarDocument: null,
        tipDocument: "chitanta",
        data: new Date(),
        tipPlata: "online",
        sumaIncasata,
        totalSelectat: sumaIncasata,
        pozitiiJson,
        observatii: `Plata online Stripe — ${pi.id}`,
        createdById: intent.userId,
      },
    });

    // Marcheaza intent-ul ca procesat
    await db.stripePaymentIntent.update({
      where: { stripeId: pi.id },
      data: { status: "succeeded" },
    });
  }

  if (event.type === "payment_intent.payment_failed") {
    const pi = event.data.object as Stripe.PaymentIntent;
    await db.stripePaymentIntent.updateMany({
      where: { stripeId: pi.id, status: "pending" },
      data: { status: "canceled" },
    });
  }

  return NextResponse.json({ received: true });
}
