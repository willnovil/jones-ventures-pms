// Better Auth React client. Hooks like useSession, useActiveOrganization,
// and methods like signIn / signUp / signOut are exposed off authClient.
//
// IMPORTANT: baseURL must resolve to the SAME origin the rest of the API
// calls use, so the session cookie ends up on the right origin. In dev,
// vite proxies /api/* (including /api/auth/*) to the Express server on
// 3001, so we point at window.location.origin and let the proxy handle
// it. In production, the client + server are served from the same origin
// anyway, so this Just Works.

import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : undefined,
  plugins: [organizationClient()],
});

export const {
  useSession,
  useActiveOrganization,
  useListOrganizations,
  signIn,
  signUp,
  signOut,
} = authClient;
