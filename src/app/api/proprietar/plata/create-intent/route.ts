// POST /api/proprietar/plata/create-intent
// Creeaza un PaymentIntent Stripe pentru plata online a cotei de intretinere.
// Accesibil de catre utilizatorii cu rol PROPRIETAR (sau orice user cu apartamentId).
import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/mobile-auth";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";

function ronToBani(ron: number): number {
  return Math.round(ron * 100);
}

export async function POST(req: NextRequest) {
  const user = await getApiUser(req);
  if (!user?.id) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const body = await req.json();
  const { apartamentId, asociatieId, pozitii } = body as {
    apartamentId: string;
    asociatieId: string;
    pozitii: { tip: string; denumire: string; suma: number; fondId?: string }[];
  };

  if (!apartamentId || !asociatieId || !Array.isArray(pozitii) || pozitii.length === 0)
    return NextResponse.json({ error: "Date incomplete" }, { status: 400 });

  // Verifica ca userul are acces la acest apartament
  const link = await db.asociatieUser.findFirst({
    where: { userId: user.id, apartamentId, isSuspended: false },
  });
  if (!link) return NextResponse.json({ error: "Acces interzis" }, { status: 403 });

  // Verifica ca apartamentul apartine asociatiei
  const ap = await db.apartament.findFirst({
    where: { id: apartamentId, asociatieId, isActive: true },
    include: {
      asociatie: { select: { name: true, organizationId: true } },
      proprietari: {
        where: { isMain: true },
        include: { proprietar: { select: { nume: true, prenume: true } } },
        take: 1,
      },
    },
  });
  if (!ap) return NextResponse.json({ error: "Apartament negasit" }, { status: 404 });

  const suma = pozitii.reduce((s, p) => s + (p.suma || 0), 0);
  if (suma < 1) return NextResponse.json({ error: "Suma minima este 1 leu" }, { status: 400 });

  const prop = ap.proprietari[0]?.proprietar;
  const proprietarNume = prop
    ? [prop.prenume, prop.nume].filter(Boolean).join(" ") || prop.nume
    : (user.name ?? undefined);

  const baseUrl = process.env.NEXTAUTH_URL || "https://www.spokadmin.ro";

  const paymentIntent = await stripe.paymentIntents.create({
    amount: ronToBani(suma),
    currency: "ron",
    description: `SpokAdmin — Cota intretinere Ap. ${ap.numar}, ${ap.asociatie.name}`,
    metadata: {
      apartamentId,
      asociatieId,
      organizationId: ap.asociatie.organizationId,
      userId: user.id,
      nrApartament: ap.numar,
      proprietarNume: proprietarNume ?? "",
      pozitiiJson: JSON.stringify(pozitii),
    },
    automatic_payment_methods: { enabled: true },
  });

  // Salvam intent-ul pending in DB pentru reconciliere in webhook
  await db.stripePaymentIntent.create({
    data: {
      stripeId: paymentIntent.id,
      organizationId: ap.asociatie.organizationId,
      asociatieId,
      apartamentId,
      userId: user.id,
      suma,
      pozitiiJson: JSON.stringify(pozitii),
    },
  });

  return NextResponse.json({ clientSecret: paymentIntent.client_secret });
}
