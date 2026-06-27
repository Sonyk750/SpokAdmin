import type { NextAuthConfig } from "next-auth";

const APP_PATHS = [
  "/dashboard",
  "/asociatii",
  "/furnizori",
  "/facturi",
  "/incasari",
  "/contoare",
  "/ai",
  "/rapoarte",
  "/setari",
  "/transferuri",
  "/spv",
  "/utilizatori",
  "/profil",
];

export const authConfig: NextAuthConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = nextUrl;
      const isApp = APP_PATHS.some(p => pathname === p || pathname.startsWith(p + "/"));
      if (isApp && !isLoggedIn) return false;
      if (isLoggedIn && (pathname === "/login" || pathname === "/register")) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }
      return true;
    },
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id             = user.id as string;
        token.role           = (user as any).role;
        token.organizationId = (user as any).organizationId;
        token.orgRole        = (user as any).orgRole ?? null;
      }
      // Reîmprospătare la unstable_update (ex: schimbare nume din profil)
      if (trigger === "update" && session?.user) {
        if (typeof session.user.name === "string") token.name = session.user.name;
      }
      return token;
    },
    session({ session, token }) {
      if (token && session.user) {
        session.user.id             = token.id             as string;
        session.user.role           = token.role           as string;
        session.user.organizationId = token.organizationId as string | null;
        session.user.orgRole        = token.orgRole        as string | null;
      }
      return session;
    },
  },
};
