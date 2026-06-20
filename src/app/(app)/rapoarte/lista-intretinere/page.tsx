import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import ListaPlataClient from "./ListaPlataClient";

export const metadata = { title: "Lista întreținere" };

export default async function ListaIntretinerePage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  const now = new Date();

  return (
    <ListaPlataClient
      defaultLuna={now.getMonth() + 1}
      defaultAn={now.getFullYear()}
    />
  );
}
