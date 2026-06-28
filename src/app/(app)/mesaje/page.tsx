import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import MesajeClient from "./MesajeClient";

export default async function MesajePage() {
  const session = await auth();
  if (!session) redirect("/login");
  return <MesajeClient />;
}
