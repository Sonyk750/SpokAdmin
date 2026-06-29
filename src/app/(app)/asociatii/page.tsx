import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import AsociatieCard from "./_components/AsociatieCard";

export default async function AsociatiiPage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  const orgId = session.user.organizationId;

  const asociatii = await db.asociatie.findMany({
    where:   { organizationId: orgId, isActive: true },
    include: { apartamente: { where: { isActive: true }, select: { id: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="page-kicker">IMOBILE</p>
          <h1 className="page-title">Asociații</h1>
          <p className="page-sub">Administrează toate asociațiile de proprietari din portofoliu.</p>
        </div>
      </div>

      {asociatii.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state__icon">🏢</span>
          <h2 className="empty-state__title">Nicio asociație adăugată</h2>
          <p className="empty-state__desc">
            Folosește butonul <strong>Inițializare</strong> din meniu pentru a adăuga prima asociație.
          </p>
        </div>
      ) : (
        <div className="asociatii-grid">
          {asociatii.map(a => (
            <AsociatieCard key={a.id} asociatie={a} nrAp={a.apartamente.length} />
          ))}
        </div>
      )}
    </div>
  );
}
