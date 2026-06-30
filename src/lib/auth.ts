import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { authConfig } from "@/lib/auth.config";
import { sendLoginNotification } from "@/lib/email";

export const { handlers, auth, signIn, signOut, unstable_update: updateSession } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email:    { label: "Email",   type: "email"    },
        password: { label: "Parolă", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await db.user.findUnique({
          where: { email: credentials.email as string },
          include: {
            memberships: {
              include: { organization: true },
              take: 1,
            },
            asocUsers: { select: { id: true }, take: 1 },
          },
        });

        if (!user || !user.password || !user.isActive || user.isSuspended) return null;

        const ok = await bcrypt.compare(credentials.password as string, user.password);
        if (!ok) return null;

        // Notificare la primul login al unui utilizator invitat (rol pe asociație).
        // Marcăm „a intrat deja" prin emailVerified (nefolosit altfel la conturile pe parolă).
        // Nu blocăm / nu eșuăm autentificarea dacă emailul nu poate fi trimis.
        if (!user.emailVerified && user.asocUsers.length > 0) {
          try {
            await db.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } });
            await sendLoginNotification({
              userName:  user.name,
              userEmail: user.email,
              orgName:   user.memberships[0]?.organization?.name ?? null,
            });
          } catch { /* ignoră erorile de notificare */ }
        }

        return {
          id:             user.id,
          name:           user.name,
          email:          user.email,
          image:          user.image,
          role:           user.role,
          organizationId: user.memberships[0]?.organizationId ?? null,
          orgRole:        user.memberships[0]?.role ?? null,
        };
      },
    }),
  ],
});
