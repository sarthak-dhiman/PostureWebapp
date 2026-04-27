import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import type { AuthOptions, User } from "next-auth";
import { apiFetch } from "./api";

// Our custom User type mirroring Django's response
interface DjangoUser extends User {
  accessToken?: string;
  refreshToken?: string;
  role?: string;
  organization?: {
    id: string;
    name: string;
    isActive: boolean;
    hasSubscription: boolean;
  };
}

const backendBaseUrl =
  process.env.INTERNAL_API_URL ||
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "https://postureos.onrender.com";

const googleClientId =
  process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "";
const googleClientSecret =
  process.env.GOOGLE_OAUTH_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || "";

const providers: AuthOptions["providers"] = [
  CredentialsProvider({
    name: "Credentials",
    credentials: {
      username: { label: "Username", type: "text" },
      password: { label: "Password", type: "password" }
    },
    async authorize(credentials) {
      console.log("AUTHORIZE START for", credentials?.username);
      if (!credentials?.username || !credentials?.password) {
        console.log("Missing credentials");
        return null;
      }

      try {
        console.log("Using API_URL:", backendBaseUrl);

        // Build the payload mapping credentials exactly to what DRF expects
        const payload: any = {
          username: credentials?.username,
          password: credentials?.password,
        }

        const tokenRes = await apiFetch(`${backendBaseUrl}/api/v1/auth/token/`, {
          method: 'POST',
          body: JSON.stringify(payload),
          headers: { "Content-Type": "application/json" }
        });

        console.log("Token response status:", tokenRes.status, "url:", `${backendBaseUrl}/api/v1/auth/token/`);
        if (!tokenRes.ok) {
          console.log("Token response NOT OK");
          const errData = await tokenRes.json().catch(() => ({}));
          // NextAuth catches this and sends the message string directly to res.error
          throw new Error(errData.detail || "Invalid credentials");
        }
        const tokens = await tokenRes.json();
        console.log("Token generated successfully");

        const userRes = await fetch(`${backendBaseUrl}/api/v1/users/me/`, {
          headers: {
            "Authorization": `Bearer ${tokens.access}`
          }
        });

        console.log("Profile response status:", userRes.status);
        if (!userRes.ok) {
          console.log("Profile response NOT OK");
          return null;
        }
        const userProfile = await userRes.json();
        console.log("Parsed profile:", JSON.stringify(userProfile));

        const user = {
          id: userProfile.id.toString(),
          name: `${userProfile.first_name} ${userProfile.last_name}`.trim() || userProfile.username,
          email: userProfile.email,
          accessToken: tokens.access,
          refreshToken: tokens.refresh,
          role: userProfile.role,
          organization: userProfile.organization ? {
            id: userProfile.organization.id,
            name: userProfile.organization.name,
            isActive: userProfile.organization.is_active,
            hasSubscription: userProfile.organization.has_subscription
          } : undefined
        };
        console.log("Returning mapped NextAuth user:", JSON.stringify(user));
        return user;

      } catch (e: any) {
        console.error("Auth error catch block:", e);
        throw new Error(e.message || "Authentication failed");
      }
    }
  }),
];

if (googleClientId && googleClientSecret) {
  providers.push(
    GoogleProvider({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    })
  );
} else {
  console.warn("Google OAuth provider is disabled: missing GOOGLE_OAUTH_CLIENT_ID/SECRET.");
}

export const authOptions: AuthOptions = {
  // Allow single-service deployments to reuse Django SECRET_KEY if NEXTAUTH_SECRET is omitted.
  secret: process.env.NEXTAUTH_SECRET || process.env.SECRET_KEY,
  providers,
  callbacks: {
    async jwt({ token, user, account, trigger, session }: { token: any, user: any, account?: any, trigger?: string, session?: any }) {
      console.log("JWT callback START. User present:", !!user, "Account present:", !!account);

      // Handle explicit session updates from the client (e.g. afterorg upgrade)
      if (trigger === "update" && session) {
        if (session.role) token.role = session.role;
        if (session.organization) token.organization = session.organization;
        return token;
      }

      // 1. Handle Google OAuth sign-in token exchange
      if (account?.provider === 'google' && account.id_token) {
        console.log("Exchanging Google id_token with Django backend...");
        try {
          const res = await fetch(`${backendBaseUrl}/api/v1/auth/google/verify/`, {
            method: 'POST',
            body: JSON.stringify({ id_token: account.id_token }),
            headers: { "Content-Type": "application/json" }
          });

          if (res.ok) {
            const data = await res.json();
            token.accessToken = data.access;
            token.role = data.user?.role || "VIEWER";
            token.organization = data.user?.organization;
            token.userId = data.user?.id;
            console.log("Successfully mapped Django tokens for Google User.");
          } else {
            console.error("Google token verification failed:", await res.text());
          }
        } catch (e) {
          console.error("Failed to verify google token with backend", e);
        }
      }
      // 2. Handle native credentials login
      else if (user) {
        console.log("Mapping Native user to token. Dropping refresh token to save cookie space.");
        const u = user as DjangoUser;
        token.accessToken = u.accessToken;
        token.role = u.role;
        // NextAuth v4 cookie chunking is broken in Next 15.
        // We MUST keep the token under 4096 bytes. Refresh token is huge, remove it for now.
        // token.refreshToken = u.refreshToken;
        token.organization = u.organization;
        token.userId = u.id;
      }
      return token;
    },
    async session({ session, token }: { session: any, token: any }) {
      if (session.user) {
        (session.user as any).id = token.userId;
        (session.user as any).accessToken = token.accessToken as string;
        (session.user as any).role = token.role as string;
        if (token.organization) {
          (session.user as any).organization = token.organization;
        }
      }
      return session;
    }
  },
  pages: {
    signIn: '/login', // Custom login page
  },
  session: {
    strategy: "jwt" as const,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  }
};


