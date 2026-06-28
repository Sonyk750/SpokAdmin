import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import DrepturiClient from "./DrepturiClient";

export const metadata = { title: "Drepturi & roluri — Administrare Asociații" };

export default async function DrepturiPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return <DrepturiClient />;
}
