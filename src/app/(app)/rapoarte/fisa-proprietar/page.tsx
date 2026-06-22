import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import FisaProprietarClient from "./FisaProprietarClient";

export const metadata = { title: "Fișă proprietar" };

export default async function FisaProprietarPage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  const now = new Date();
  const firstDay = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
  const today    = now.toISOString().slice(0, 10);

  return <FisaProprietarClient defaultStart={firstDay} defaultEnd={today} />;
}
