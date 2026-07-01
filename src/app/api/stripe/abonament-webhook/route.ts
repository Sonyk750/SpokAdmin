// POST /api/stripe/abonament-webhook
// Sincronizeaza starea abonamentului SpokAdmin cu Stripe.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import type Stripe from "stripe";

async function syncSubscription(sub: Stripe.Subscription) {
  const orgId = sub.metadata?.organizationId;
  const plan  = sub.metadata?.plan ?? "standard";
  if (!orgId) return;

  const periodEndUnix = sub.items.data[0]?.current_period_end;
  const currentPeriodEnd = periodEndUnix ? new Date(periodEndUnix * 1000) : null;

  await db.organization.update({
    where: { id: orgId },
    data: {
      plan:                sub.status === "active" ? plan : "start",
      stripeSubscriptionId: sub.id,
      subscriptionStatus:  sub.status,
      currentPeriodEnd,
    },
  });
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig  = req.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig!, process.env.STRIPE_ABONAMENT_WEBHOOK_SECRET!);
  } catch (e) {
    console.error("[abonament-webhook] Semnatura invalida:", e);
    return NextResponse.json({ error: "Semnatura invalida" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object as Stripe.Checkout.Session;
      if (s.mode === "subscription" && s.subscription) {
        const sub = await stripe.subscriptions.retrieve(s.subscription as string);
        await syncSubscription(sub);
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      await syncSubscription(event.data.object as Stripe.Subscription);
      break;
    }
    case "invoice.payment_failed": {
      const inv = event.data.object as Stripe.Invoice;
      const subRef = inv.parent?.subscription_details?.subscription;
      const subId = typeof subRef === "string" ? subRef : (subRef as any)?.id;
      if (subId) {
        const orgId = (await stripe.subscriptions.retrieve(subId)).metadata?.organizationId;
        if (orgId) {
          await db.organization.update({
            where: { id: orgId },
            data: { subscriptionStatus: "past_due" },
          });
        }
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
