import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import IncasariClient from "./IncasariClient";

export default async function IncasariPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const now = new Date();
  return <IncasariClient defaultLuna={now.getMonth() + 1} defaultAn={now.getFullYear()} />;
}
