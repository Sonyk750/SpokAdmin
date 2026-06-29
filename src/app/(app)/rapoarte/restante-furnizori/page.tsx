import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import RestanteFurnizoriClient from "./RestanteFurnizoriClient";

export const metadata = { title: "Restanțe furnizori" };

export default async function RestanteFurnizoriPage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  return <RestanteFurnizoriClient />;
}
