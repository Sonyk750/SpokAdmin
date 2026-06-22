import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import TransferuriFonduriClient from "./TransferuriFonduriClient";

export const metadata = { title: "Transferuri între fonduri" };

export default async function TransferuriIntreFonduriPage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  return <TransferuriFonduriClient />;
}
