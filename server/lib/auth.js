// Better Auth instance for the PMS.
//
// Multi-tenancy strategy:
//   - Each landlord business is a Better Auth Organization (the org plugin
//     creates Organization, Member, Invitation tables for us).
//   - Sessions automatically carry `activeOrganizationId`, which the
//     requireOrganization middleware exposes as req.organizationId.
//   - Every domain table (Property, Unit, Tenant, Lease, etc.) has an
//     organizationId column and every query in routes/* is scoped by it.
//
// Bootstrap behaviour: when the very FIRST user signs up (no orgs exist
// yet, but a "Jones Properties" placeholder org may be in the DB from
// the backfill), they're added to that placeholder org as OWNER instead
// of getting a fresh empty one. Every subsequent signup gets their own
// new org.

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { organization } from "better-auth/plugins";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
    // Email verification disabled until Phase 2 (Resend integration)
    requireEmailVerification: false,
    minPasswordLength: 8,
  },

  trustedOrigins: [
    process.env.CLIENT_URL || "http://localhost:5173",
  ],

  plugins: [
    organization({
      allowUserToCreateOrganization: true,
      creatorRole: "owner",
    }),
  ],

  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Bootstrap: if there's exactly one org with no members
          // (the seed Jones Properties placeholder), the first signup
          // claims it as OWNER. Otherwise, create a fresh org for the
          // new user.
          const orphanedOrgs = await prisma.organization.findMany({
            where: { members: { none: {} } },
            orderBy: { createdAt: "asc" },
            take: 1,
          });

          let organizationId;
          if (orphanedOrgs.length === 1) {
            organizationId = orphanedOrgs[0].id;
          } else {
            // Create a new org named after the user.
            const orgName = user.name
              ? `${user.name}'s Properties`
              : "My Properties";
            const baseSlug = slugify(orgName) || `org-${user.id}`;
            // Ensure slug uniqueness with a short random suffix if needed.
            const slug = `${baseSlug}-${user.id.slice(0, 6)}`;
            const created = await prisma.organization.create({
              data: { id: crypto.randomUUID(), name: orgName, slug },
            });
            organizationId = created.id;
          }

          await prisma.member.create({
            data: {
              id: crypto.randomUUID(),
              userId: user.id,
              organizationId,
              role: "owner",
            },
          });

          // Stamp the new user's session/active org on first session creation
          // happens automatically via better-auth when only one membership
          // exists, but we set it here too for clarity.
          await prisma.session.updateMany({
            where: { userId: user.id, activeOrganizationId: null },
            data: { activeOrganizationId: organizationId },
          });
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          // If a session is being created and has no active org, default
          // to the user's first membership so subsequent requests have a
          // scope right away.
          if (!session.activeOrganizationId) {
            const member = await prisma.member.findFirst({
              where: { userId: session.userId },
              orderBy: { createdAt: "asc" },
            });
            if (member) {
              return { data: { ...session, activeOrganizationId: member.organizationId } };
            }
          }
          return { data: session };
        },
      },
    },
  },
});
