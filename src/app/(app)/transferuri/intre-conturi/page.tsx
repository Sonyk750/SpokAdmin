import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import TransferuriClient from "./TransferuriClient";

export const metadata = { title: "Transferuri între conturi" };

export default async function TransferuriIntreConturiPage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  return <TransferuriClient />;
}
