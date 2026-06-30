import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import PlatiClient from "./PlatiClient";

export const metadata = { title: "Plăți furnizori" };

export default async function PlatiPage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");
  return <PlatiClient />;
}
