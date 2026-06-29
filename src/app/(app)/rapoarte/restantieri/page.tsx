import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import RestantieriClient from "./RestantieriClient";

export const metadata = { title: "Restanțe proprietari" };

export default async function RestantieriPage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  return <RestantieriClient />;
}
