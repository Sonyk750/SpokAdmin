import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import CitiriClient from "./CitiriClient";

export const metadata = { title: "Citiri manuale contoare" };

export default async function CitiriPage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  const now = new Date();
  return <CitiriClient defaultLuna={now.getMonth() + 1} defaultAn={now.getFullYear()} />;
}
