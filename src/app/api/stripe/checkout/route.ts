// POST /api/stripe/checkout
// Creeaza o sesiune Stripe Checkout pentru abonament lunar (Standard / Pro).
// Necesita utilizator autentificat cu organizationId.
import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/mobile-auth";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { SPOK_PLANS, type SpokPlan, ronToBani } from "@/lib/billing";

async function getOrCreateCustomer(orgId: string, email: string | null | undefined): Promise<string> {
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { stripeCustomerId: true, name: true } });
  if (org?.stripeCustomerId) return org.stripeCustomerId;

  const customer = await stripe.customers.create({
    email: email ?? undefined,
    name: org?.name ?? undefined,
    metadata: { organizationId: orgId },
  });

  await db.organization.update({ where: { id: orgId }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}

export async function POST(req: NextRequest) {
  const user = await getApiUser(req);
  const orgId = user?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const body = await req.json();
  const planKey = body.plan as SpokPlan;
  const planInfo = SPOK_PLANS[planKey];

  if (!planInfo || planInfo.priceRon === 0)
    return NextResponse.json({ error: "Plan invalid" }, { status: 400 });

  const baseUrl = process.env.NEXTAUTH_URL || "https://www.spokadmin.ro";

  const customerId = await getOrCreateCustomer(orgId, user.email);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    mode: "subscription",
    line_items: [{
      price_data: {
        currency: "ron",
        product_data: { name: `SpokAdmin ${planInfo.name}` },
        unit_amount: ronToBani(planInfo.priceRon),
        recurring: { interval: "month" },
      },
      quantity: 1,
    }],
    metadata: { organizationId: orgId, plan: planKey },
    subscription_data: { metadata: { organizationId: orgId, plan: planKey } },
    success_url: `${baseUrl}/dashboard?abonament=success&plan=${planKey}`,
    cancel_url: `${baseUrl}/dashboard?abonament=cancel`,
    locale: "ro",
  });

  return NextResponse.json({ url: session.url });
}
