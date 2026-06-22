import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import RegistruBancaClient from "./RegistruBancaClient";

export const metadata = { title: "Registru bancă" };

export default async function RegistruBancaPage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const today    = now.toISOString().slice(0, 10);

  return <RegistruBancaClient defaultStart={firstDay} defaultEnd={today} />;
}
