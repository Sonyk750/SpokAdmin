import { Suspense } from "react";
import AsociatieContacteClient from "./AsociatieContacteClient";

export const metadata = { title: "Contacte proprietari" };

export default function AsociatieContactePage() {
  return (
    <Suspense>
      <AsociatieContacteClient />
    </Suspense>
  );
}
