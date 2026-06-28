import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import SituatiaActivPasivClient from "./SituatiaActivPasivClient";

export const metadata = { title: "Situaţia activ / pasiv" };

export default async function SituatiaActivPasivPage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  const today = new Date().toISOString().slice(0, 10);

  return <SituatiaActivPasivClient defaultDate={today} />;
}
