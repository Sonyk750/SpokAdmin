import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import AbonamentClient from "./AbonamentClient";

export const metadata = { title: "Abonament — SpokAdmin" };

export default async function AbonamentPage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  const org = await db.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { plan: true, subscriptionStatus: true, currentPeriodEnd: true, stripeSubscriptionId: true },
  });

  return <AbonamentClient org={org} />;
}
