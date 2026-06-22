import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import FisaFurnizorClient from "./FisaFurnizorClient";

export const metadata = { title: "Fișă furnizor" };

export default async function FisaFurnizorPage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  const now = new Date();
  const firstDay = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
  const today    = now.toISOString().slice(0, 10);

  return <FisaFurnizorClient defaultStart={firstDay} defaultEnd={today} />;
}
