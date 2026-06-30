import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import FisaFurnizorClient from "./FisaFurnizorClient";

export const metadata = { title: "Fișă furnizor" };

export default async function FisaFurnizorPage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  return <FisaFurnizorClient />;
}
