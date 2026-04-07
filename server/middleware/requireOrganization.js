// Express middleware that loads the current Better Auth session, attaches
// req.user and req.organizationId, and rejects requests that don't have
// an active organization scope. Every domain route must use this — a
// missed query is a cross-tenant data leak.

import { auth } from "../lib/auth.js";
import { fromNodeHeaders } from "better-auth/node";

export async function requireOrganization(req, res, next) {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session || !session.user) {
      return res.status(401).json({ error: "Not signed in" });
    }

    const organizationId = session.session?.activeOrganizationId;
    if (!organizationId) {
      return res.status(400).json({
        error: "No active organization on session",
        code: "NO_ACTIVE_ORG",
      });
    }

    req.user = session.user;
    req.session = session.session;
    req.organizationId = organizationId;
    next();
  } catch (err) {
    console.error("requireOrganization error:", err);
    res.status(500).json({ error: "Auth check failed" });
  }
}
