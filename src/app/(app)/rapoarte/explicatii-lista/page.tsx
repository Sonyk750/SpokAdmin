import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import ExplicatiiClient from "./ExplicatiiClient";

export const metadata = { title: "Explicații listă" };

export default async function ExplicatiiListaPage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  const now = new Date();

  return (
    <ExplicatiiClient
      defaultLuna={now.getMonth() + 1}
      defaultAn={now.getFullYear()}
    />
  );
}
