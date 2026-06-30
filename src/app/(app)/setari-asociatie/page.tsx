import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import SetariAsociatieClient from "./SetariAsociatieClient";

export default async function SetariAsociatiePage() {
  const session = await auth();
  if (!session) redirect("/login");
  return <SetariAsociatieClient />;
}
