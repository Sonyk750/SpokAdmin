import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

export default async function ApartamentePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  const a = await db.asociatie.findFirst({
    where: { id, organizationId: session.user.organizationId },
    select: {
      id: true, name: true,
      apartamente: {
        where:   { isActive: true },
        orderBy: { numar: "asc" },
        select: {
          id: true, numar: true, scara: true, etaj: true, cotaParte: true,
          proprietari: {
            orderBy: { createdAt: "asc" },
            select: { proprietar: { select: { nume: true, prenume: true, telefon: true } } },
          },
          solduri: { select: { restantaIntretinere: true, intretinereCurenta: true } },
        },
      },
    },
  });

  if (!a) notFound();

  const fmt = (v: number) => v.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const totalRestante = a.apartamente.reduce((s, ap) => s + (ap.solduri[0]?.restantaIntretinere ?? 0), 0);
  const cuRestante    = a.apartamente.filter(ap => (ap.solduri[0]?.restantaIntretinere ?? 0) > 0).length;

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <Link href={`/asociatii/${id}`} className="back-link" style={{ marginBottom: "0.25rem", display: "inline-block" }}>
            ← {a.name}
          </Link>
          <h1 className="page-title">Apartamente ({a.apartamente.length})</h1>
          <p className="page-sub">
            {cuRestante > 0
              ? `${cuRestante} cu restanțe · Total restanțe: ${fmt(totalRestante)} lei`
              : "Nicio restanță"}
          </p>
        </div>
        <Link href={`/asociatii/${id}/initializare`} className="btn btn--secondary">
          ✏ Editează
        </Link>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 70 }}>Nr.</th>
              <th>Proprietar(i)</th>
              <th>Telefon</th>
              <th style={{ width: 80, textAlign: "right" }}>Cotă</th>
              <th style={{ width: 130, textAlign: "right" }}>Întrețin. curentă</th>
              <th style={{ width: 130, textAlign: "right" }}>Restanță</th>
            </tr>
          </thead>
          <tbody>
            {a.apartamente.map(ap => {
              const props     = ap.proprietari.map(p => [p.proprietar.prenume, p.proprietar.nume].filter(Boolean).join(" "));
              const telefoane = ap.proprietari.map(p => p.proprietar.telefon).filter(Boolean);
              const restanta  = ap.solduri[0]?.restantaIntretinere ?? 0;
              const curent    = ap.solduri[0]?.intretinereCurenta  ?? 0;
              return (
                <tr key={ap.id}>
                  <td style={{ fontWeight: 700, color: "#a78bfa" }}>
                    {ap.scara ? `Sc.${ap.scara} ` : ""}Ap.{ap.numar}
                    {ap.etaj != null ? <span style={{ color: "#64748b", fontWeight: 400 }}> et.{ap.etaj}</span> : ""}
                  </td>
                  <td>{props.length ? props.join(", ") : <span style={{ color: "#475569" }}>—</span>}</td>
                  <td style={{ color: "#94a3b8", fontSize: "0.8rem" }}>{telefoane.join(", ") || "—"}</td>
                  <td style={{ textAlign: "right", color: "#94a3b8" }}>
                    {ap.cotaParte != null ? `${ap.cotaParte}%` : "—"}
                  </td>
                  <td style={{ textAlign: "right", color: curent > 0 ? "#e2e8f0" : "#475569" }}>
                    {curent > 0 ? `${fmt(curent)} lei` : "—"}
                  </td>
                  <td style={{ textAlign: "right", fontWeight: restanta > 0 ? 700 : 400, color: restanta > 0 ? "#f87171" : "#475569" }}>
                    {restanta > 0 ? `${fmt(restanta)} lei` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {a.apartamente.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={4} />
                <td style={{ textAlign: "right", fontWeight: 700, borderTop: "1px solid #1e293b", paddingTop: "0.5rem" }}>
                  {fmt(a.apartamente.reduce((s, ap) => s + (ap.solduri[0]?.intretinereCurenta ?? 0), 0))} lei
                </td>
                <td style={{ textAlign: "right", fontWeight: 700, color: totalRestante > 0 ? "#f87171" : "#475569", borderTop: "1px solid #1e293b", paddingTop: "0.5rem" }}>
                  {totalRestante > 0 ? `${fmt(totalRestante)} lei` : "—"}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
