import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import RegistruFonduriClient from "./RegistruFonduriClient";

export const metadata = { title: "Registru fonduri" };

export default async function RegistruFonduriPage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const today    = now.toISOString().slice(0, 10);

  return <RegistruFonduriClient defaultStart={firstDay} defaultEnd={today} />;
}
