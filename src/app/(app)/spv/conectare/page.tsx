import { Suspense } from "react"
import SpvConectareClient from "./SpvConectareClient"

export const metadata = { title: "Conectare SPV" }

export default function SpvConectarePage() {
  return (
    <Suspense fallback={<div className="page-shell"><p style={{ padding: "2rem", color: "#94a3b8" }}>Se încarcă...</p></div>}>
      <SpvConectareClient />
    </Suspense>
  )
}
