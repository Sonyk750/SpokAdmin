import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import RaportIncasariClient from "./RaportIncasariClient";

export const metadata = { title: "Raport încasări" };

export default async function RaportIncasariPage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const today    = now.toISOString().slice(0, 10);

  return <RaportIncasariClient defaultStart={firstDay} defaultEnd={today} />;
}
