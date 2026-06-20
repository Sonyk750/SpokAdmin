import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import FacturiClient from "./FacturiClient";

export const metadata = { title: "Facturi" };

export default async function FacturiPage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  const orgId = session.user.organizationId;

  const furnizori = await db.furnizor.findMany({
    where:   { organizationId: orgId, isActive: true },
    select:  { id: true, nume: true },
    orderBy: { nume: "asc" },
  });

  const now = new Date();

  return (
    <FacturiClient
      furnizori={furnizori}
      defaultLuna={now.getMonth() + 1}
      defaultAn={now.getFullYear()}
    />
  );
}
