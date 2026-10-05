import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Facebook from "next-auth/providers/facebook";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Provider } from "next-auth/providers";

// Social providers only register when their keys are present, so the app boots
// fine on a fresh clone and the buttons light up the moment keys are added.
const social: Provider[] = [];
if (process.env.AUTH_GOOGLE_ID) {
  social.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  );
}
if (process.env.AUTH_FACEBOOK_ID) {
  social.push(
    Facebook({
      clientId: process.env.AUTH_FACEBOOK_ID,
      clientSecret: process.env.AUTH_FACEBOOK_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

export const socialProviders = social.map((p) => {
  const cfg = typeof p === "function" ? p() : p;
  return { id: cfg.id as string, name: cfg.name as string };
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    ...social,
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const email = String(raw?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(raw?.password ?? "");
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;
        if (!(await bcrypt.compare(password, user.passwordHash))) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    // A Google / Facebook first-time login creates the local Contributor record.
    async signIn({ user, account }) {
      if (!account || account.provider === "credentials") return true;
      const email = user.email?.toLowerCase();
      if (!email) return false;

      const existing = await prisma.user.findUnique({ where: { email } });
      const local =
        existing ??
        (await prisma.user.create({
          data: {
            email,
            name: user.name ?? email.split("@")[0],
            image: user.image ?? null,
          },
        }));

      await prisma.oAuthAccount.upsert({
        where: {
          provider_providerAccountId: {
            provider: account.provider,
            providerAccountId: account.providerAccountId,
          },
        },
        create: {
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          userId: local.id,
        },
        update: { userId: local.id },
      });
      return true;
    },
    async jwt({ token }) {
      if (!token.email) return token;
      // Role / tier are read fresh so an Admin promotion takes effect on the
      // contributor's next request instead of after a re-login.
      const user = await prisma.user.findUnique({
        where: { email: token.email.toLowerCase() },
        select: { id: true, role: true, tier: true, name: true, image: true },
      });
      if (user) {
        token.sub = user.id;
        token.role = user.role;
        token.tier = user.tier;
        token.name = user.name;
        token.picture = user.image ?? undefined;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.role = token.role as string;
        session.user.tier = token.tier as string;
      }
      return session;
    },
  },
});
