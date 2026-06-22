import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import RegistruJurnalClient from "./RegistruJurnalClient";

export const metadata = { title: "Registru jurnal" };

export default async function RegistruJurnalPage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const today    = now.toISOString().slice(0, 10);

  return <RegistruJurnalClient defaultStart={firstDay} defaultEnd={today} />;
}
