import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Sidebar from "./_components/Sidebar";
import AppHeader from "./_components/AppHeader";
import { AsociatieProvider } from "@/lib/AsociatieContext";
import { SidebarProvider } from "@/lib/SidebarContext";
import { isSuperAdmin, canManageOrg } from "@/lib/roles";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const orgId = session.user.organizationId;

  const [membership, asociatii] = await Promise.all([
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
  ]);

  const canManageUsers = isSuperAdmin(session.user.role) ||
    canManageOrg(session.user.role, session.user.orgRole);

  return (
    <SidebarProvider>
      <AsociatieProvider asociatii={asociatii}>
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
              {children}
            </main>
          </div>
        </div>
      </AsociatieProvider>
    </SidebarProvider>
  );
}
