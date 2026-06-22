import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import VenituriCheltuieliClient from "./VenituriCheltuieliClient";

export const metadata = { title: "Venituri și cheltuieli" };

export default async function VenituriCheltuieliPage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const today    = now.toISOString().slice(0, 10);

  return <VenituriCheltuieliClient defaultStart={firstDay} defaultEnd={today} />;
}
