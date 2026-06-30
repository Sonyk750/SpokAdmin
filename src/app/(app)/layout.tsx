import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Sidebar from "./_components/Sidebar";
import AppHeader from "./_components/AppHeader";
import AsociatieScope from "./_components/AsociatieScope";
import AccessGuard from "./_components/AccessGuard";
import { AsociatieProvider } from "@/lib/AsociatieContext";
import { AccessProvider } from "@/lib/AccessContext";
import { SidebarProvider } from "@/lib/SidebarContext";
import { isSuperAdmin, canManageOrg, isOwner } from "@/lib/roles";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const orgId = session.user.organizationId;
  const isAdmin = isSuperAdmin(session.user.role) || isOwner(session.user.orgRole);

  const [membership, allAsociatii, myAsocUsers] = await Promise.all([
    db.organizationMember.findFirst({
      where:   { userId: session.user.id },
      include: { organization: true },
      orderBy: { createdAt: "asc" },
    }),
    orgId
      ? db.asociatie.findMany({
          where:   { organizationId: orgId, isActive: true },
          select:  { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : [],
    // Asociațiile la care userul restricționat are explicit un rol.
    isAdmin
      ? Promise.resolve([] as { asociatieId: string }[])
      : db.asociatieUser.findMany({
          where:  { userId: session.user.id, isSuspended: false },
          select: { asociatieId: true },
        }),
  ]);

  // Userii restricționați văd doar asociațiile la care au rol atribuit.
  const allowedAsocIds = new Set(myAsocUsers.map(a => a.asociatieId));
  const asociatii = isAdmin ? allAsociatii : allAsociatii.filter(a => allowedAsocIds.has(a.id));

  const canManageUsers = isSuperAdmin(session.user.role) ||
    canManageOrg(session.user.role, session.user.orgRole);

  // Asociația activă din cookie (setată la schimbarea din header) — ca să avem
  // contextul corect deja la primul render pe server.
  const cookieStore = await cookies();
  const storedAsoc  = cookieStore.get("spokadmin-asoc")?.value;
  const initialAsocId = storedAsoc && asociatii.some(a => a.id === storedAsoc)
    ? storedAsoc
    : (asociatii[0]?.id ?? "");

  return (
    <SidebarProvider>
      <AsociatieProvider asociatii={asociatii} initialId={initialAsocId}>
        <AccessProvider initialIsAdmin={isAdmin}>
          <div className="app-layout">
            <Sidebar
              userRole={session.user.role}
              canManageUsers={canManageUsers}
            />
            <div className="app-body">
              <AppHeader
                userName={session.user.name}
                orgName={membership?.organization.name}
              />
              <main className="app-main">
                <AsociatieScope>
                  <AccessGuard>
                    {children}
                  </AccessGuard>
                </AsociatieScope>
              </main>
            </div>
          </div>
        </AccessProvider>
      </AsociatieProvider>
    </SidebarProvider>
  );
}
