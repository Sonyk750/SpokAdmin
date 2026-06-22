import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import RegistruPlatiClient from "./RegistruPlatiClient";

export const metadata = { title: "Registru plăți" };

export default async function RegistruPlatiPage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const today    = now.toISOString().slice(0, 10);

  return <RegistruPlatiClient defaultStart={firstDay} defaultEnd={today} />;
}
