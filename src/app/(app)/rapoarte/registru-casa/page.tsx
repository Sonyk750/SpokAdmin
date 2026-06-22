import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import RegistruCasaClient from "./RegistruCasaClient";

export const metadata = { title: "Registru casă" };

export default async function RegistruCasaPage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const today    = now.toISOString().slice(0, 10);

  return <RegistruCasaClient defaultStart={firstDay} defaultEnd={today} />;
}
