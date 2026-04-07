// Routes for importing data from external property management systems.
// Currently supports Yardi "Unit Directory" xlsx exports — see
// server/lib/parseYardiUnitDirectory.js for the file-format details.
//
// Two-phase flow so the user can review before committing:
//   POST /api/imports/yardi-units/preview  → parse the upload, return JSON
//   POST /api/imports/yardi-units/commit   → re-parse + write to DB in a tx
//
// We deliberately re-parse on commit instead of trusting client-posted JSON.
// That way the file is the source of truth and a tampered client can't
// inject arbitrary properties under another org.

import { Router } from "express";
import multer from "multer";
import { parseYardiUnitDirectory } from "../lib/parseYardiUnitDirectory.js";
import { parseYardiRentRoll } from "../lib/parseYardiRentRoll.js";
import { requireOrganization } from "../middleware/requireOrganization.js";

const XLSX_MIMES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/octet-stream", // Yardi sometimes exports with this generic mime
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const isXlsxMime = XLSX_MIMES.has(file.mimetype);
    const isXlsxExt = /\.xlsx$/i.test(file.originalname);
    if (!isXlsxMime && !isXlsxExt) {
      return cb(new Error("Only .xlsx files are allowed"));
    }
    cb(null, true);
  },
});

const router = Router();
router.use(requireOrganization);

// POST /api/imports/yardi-units/preview — parse the upload and return the
// structured preview. Does NOT write to the DB.
router.post("/yardi-units/preview", (req, res) => {
  upload.single("file")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    try {
      const result = parseYardiUnitDirectory(req.file.buffer);
      res.json(result);
    } catch (parseErr) {
      console.error("Yardi parse error:", parseErr);
      res.status(400).json({ error: `Failed to parse file: ${parseErr.message}` });
    }
  });
});

// POST /api/imports/yardi-units/commit — re-parse the upload and write the
// properties + units to the active org in a single transaction. Returns
// counts so the UI can show "imported X properties / Y units".
router.post("/yardi-units/commit", (req, res) => {
  upload.single("file")(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    let parsed;
    try {
      parsed = parseYardiUnitDirectory(req.file.buffer);
    } catch (parseErr) {
      console.error("Yardi parse error:", parseErr);
      return res.status(400).json({ error: `Failed to parse file: ${parseErr.message}` });
    }

    const prisma = req.app.locals.prisma;
    const organizationId = req.organizationId;

    try {
      // Single transaction so a half-imported file doesn't leave orphans.
      const result = await prisma.$transaction(async (tx) => {
        let propertiesCreated = 0;
        let unitsCreated = 0;
        for (const prop of parsed.properties) {
          const created = await tx.property.create({
            data: {
              name: prop.name,
              address: prop.address,
              city: prop.city,
              state: prop.state,
              zip: prop.zip,
              type: prop.type,
              organizationId,
              units: {
                create: prop.units.map((u) => ({
                  unitNumber: u.unitNumber,
                  bedrooms: u.bedrooms,
                  bathrooms: u.bathrooms,
                  sqft: u.sqft,
                  rentAmount: u.rentAmount,
                  organizationId,
                })),
              },
            },
            include: { units: true },
          });
          propertiesCreated += 1;
          unitsCreated += created.units.length;
        }
        return { propertiesCreated, unitsCreated };
      });

      res.status(201).json({
        ...result,
        warnings: parsed.warnings,
      });
    } catch (dbErr) {
      console.error("Yardi import commit error:", dbErr);
      res.status(500).json({ error: `Failed to write import: ${dbErr.message}` });
    }
  });
});

// ============================================================
// Yardi Rent Roll → Tenants + Leases (+ unit status sync)
// ============================================================
//
// The Rent Roll xlsx contains tenant data (names, deposit, lease dates)
// for each occupied unit. We use it to backfill Tenant + Lease records
// for the units that were already imported via the Unit Directory flow.
//
// Matching strategy: each unit number in the rent roll is matched to an
// existing Unit in the org. Most unit numbers are globally unique, but
// "A" and "B" appear under both pbrown and pohio — those are disambiguated
// using the property hint from the Total row in the rent roll (we look at
// the leading street number, e.g. "2005 Brown Ave" → 2005, and pick the
// Property whose address starts with that number).
//
// Tenant identity: the rent roll has no email/phone, so we synthesize a
// placeholder email from the Yardi tenant ID:
//   t0001567 → t0001567@yardi-import.local
// That makes re-imports idempotent (find-or-create on email).

const RENTROLL_EMAIL_DOMAIN = "yardi-import.local";

function placeholderEmail(yardiId) {
  const safe = String(yardiId || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "") || "unknown";
  return `${safe}@${RENTROLL_EMAIL_DOMAIN}`;
}

// Build the import plan: walk every parsed group, match each unit row to
// an existing Unit, and decide whether the row needs CREATE / SKIP / ERROR.
//
// Inputs:
//   parsed:     output of parseYardiRentRoll
//   units:      all units in the org (with property)
//   activeLeasesByUnitId:  map of unitId → lease (status=ACTIVE)
//   tenantsByEmail:        map of placeholder email → existing Tenant
//
// Output: { plan: [...], summary: {...} }
function buildRentRollPlan(parsed, units, activeLeasesByUnitId, tenantsByEmail) {
  const plan = [];
  let willCreateLeases = 0;
  let willCreateTenants = 0;
  let willSkipExisting = 0;
  let willSkipConflict = 0;
  let unmatched = 0;
  let willMarkVacant = 0;
  const unmatchedDetails = [];

  for (const group of parsed.groups) {
    const hint = group.propertyHint || {};
    // Pre-filter candidate units to those matching the property hint
    // (street number from the Total row), if we have one. This is what
    // disambiguates the A/B-in-two-properties case.
    let propertyCandidates = units;
    if (hint.streetNumber) {
      const filtered = units.filter((u) =>
        (u.property?.address || "").startsWith(hint.streetNumber + " ")
      );
      if (filtered.length > 0) propertyCandidates = filtered;
    }

    // Process occupied unit rows
    for (const row of group.units) {
      const matches = propertyCandidates.filter((u) => u.unitNumber === row.unitNumber);
      // Fallback: if scoped match failed, try the whole org
      const finalMatches = matches.length > 0
        ? matches
        : units.filter((u) => u.unitNumber === row.unitNumber);

      if (finalMatches.length === 0) {
        unmatched += 1;
        unmatchedDetails.push(
          `Unit "${row.unitNumber}" (${row.tenantName}) — no matching unit in org`
        );
        plan.push({
          status: "unmatched",
          unitNumber: row.unitNumber,
          tenantName: row.tenantName,
          reason: "No unit with this number in your org",
        });
        continue;
      }
      if (finalMatches.length > 1) {
        // Couldn't disambiguate even with the property hint
        unmatched += 1;
        unmatchedDetails.push(
          `Unit "${row.unitNumber}" (${row.tenantName}) — ambiguous, ${finalMatches.length} units share this number`
        );
        plan.push({
          status: "ambiguous",
          unitNumber: row.unitNumber,
          tenantName: row.tenantName,
          reason: `${finalMatches.length} units share this number, can't disambiguate`,
        });
        continue;
      }
      const unit = finalMatches[0];

      const email = placeholderEmail(row.yardiTenantId);
      const tenantExists = tenantsByEmail.has(email);
      const existingActive = activeLeasesByUnitId.get(unit.id);

      if (existingActive) {
        // Don't blow away an existing active lease — just skip with a note.
        if (tenantExists && existingActive.tenantId === tenantsByEmail.get(email).id) {
          willSkipExisting += 1;
          plan.push({
            status: "skip-existing",
            unitNumber: row.unitNumber,
            tenantName: row.tenantName,
            propertyName: unit.property?.name,
            unitId: unit.id,
            reason: "This lease was already imported",
          });
        } else {
          willSkipConflict += 1;
          plan.push({
            status: "skip-conflict",
            unitNumber: row.unitNumber,
            tenantName: row.tenantName,
            propertyName: unit.property?.name,
            unitId: unit.id,
            reason: "Unit already has a different active lease — delete it first if you want to re-import",
          });
        }
        continue;
      }

      if (!tenantExists) willCreateTenants += 1;
      willCreateLeases += 1;
      plan.push({
        status: "will-create",
        unitNumber: row.unitNumber,
        propertyName: unit.property?.name,
        unitId: unit.id,
        tenantEmail: email,
        tenantExists,
        firstName: row.firstName,
        lastName: row.lastName,
        tenantName: row.tenantName,
        startDate: row.startDate,
        endDate: row.endDate,
        rentAmount: row.rentAmount,
        depositAmount: row.depositAmount,
      });
    }

    // Vacant rows — flag the unit for status=VACANT sync
    for (const v of group.vacant) {
      const matches = propertyCandidates.filter((u) => u.unitNumber === v.unitNumber);
      const finalMatches = matches.length > 0
        ? matches
        : units.filter((u) => u.unitNumber === v.unitNumber);
      if (finalMatches.length === 1) {
        willMarkVacant += 1;
        plan.push({
          status: "mark-vacant",
          unitNumber: v.unitNumber,
          unitId: finalMatches[0].id,
          propertyName: finalMatches[0].property?.name,
        });
      } else {
        unmatched += 1;
        plan.push({
          status: "unmatched",
          unitNumber: v.unitNumber,
          tenantName: "(vacant)",
          reason: "No unit with this number in your org",
        });
      }
    }
  }

  return {
    plan,
    summary: {
      willCreateLeases,
      willCreateTenants,
      willSkipExisting,
      willSkipConflict,
      willMarkVacant,
      unmatched,
      unmatchedDetails,
    },
  };
}

// POST /api/imports/yardi-rentroll/preview — parse + match + plan, no writes.
router.post("/yardi-rentroll/preview", (req, res) => {
  upload.single("file")(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    let parsed;
    try {
      parsed = parseYardiRentRoll(req.file.buffer);
    } catch (parseErr) {
      console.error("Rent roll parse error:", parseErr);
      return res
        .status(400)
        .json({ error: `Failed to parse file: ${parseErr.message}` });
    }

    const prisma = req.app.locals.prisma;
    const organizationId = req.organizationId;

    try {
      const [units, activeLeases, tenants] = await Promise.all([
        prisma.unit.findMany({
          where: { organizationId },
          include: { property: true },
        }),
        prisma.lease.findMany({
          where: { organizationId, status: "ACTIVE" },
          select: { id: true, unitId: true, tenantId: true },
        }),
        prisma.tenant.findMany({
          where: { organizationId, email: { endsWith: `@${RENTROLL_EMAIL_DOMAIN}` } },
          select: { id: true, email: true },
        }),
      ]);

      const activeLeasesByUnitId = new Map(activeLeases.map((l) => [l.unitId, l]));
      const tenantsByEmail = new Map(tenants.map((t) => [t.email, t]));

      const result = buildRentRollPlan(parsed, units, activeLeasesByUnitId, tenantsByEmail);
      res.json({
        ...result,
        warnings: parsed.warnings,
        totals: {
          unitsInFile: parsed.totalUnits,
          leasesInFile: parsed.totalLeases,
          vacantInFile: parsed.totalVacant,
        },
      });
    } catch (dbErr) {
      console.error("Rent roll preview error:", dbErr);
      res.status(500).json({ error: dbErr.message });
    }
  });
});

// POST /api/imports/yardi-rentroll/commit — re-parse, re-plan, then write
// in a single transaction. Idempotent: re-running on the same file is a
// no-op (everything will be skip-existing).
router.post("/yardi-rentroll/commit", (req, res) => {
  upload.single("file")(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    let parsed;
    try {
      parsed = parseYardiRentRoll(req.file.buffer);
    } catch (parseErr) {
      console.error("Rent roll parse error:", parseErr);
      return res
        .status(400)
        .json({ error: `Failed to parse file: ${parseErr.message}` });
    }

    const prisma = req.app.locals.prisma;
    const organizationId = req.organizationId;

    try {
      const [units, activeLeases, tenants] = await Promise.all([
        prisma.unit.findMany({
          where: { organizationId },
          include: { property: true },
        }),
        prisma.lease.findMany({
          where: { organizationId, status: "ACTIVE" },
          select: { id: true, unitId: true, tenantId: true },
        }),
        prisma.tenant.findMany({
          where: { organizationId, email: { endsWith: `@${RENTROLL_EMAIL_DOMAIN}` } },
          select: { id: true, email: true },
        }),
      ]);

      const activeLeasesByUnitId = new Map(activeLeases.map((l) => [l.unitId, l]));
      const tenantsByEmail = new Map(tenants.map((t) => [t.email, t]));

      const { plan } = buildRentRollPlan(parsed, units, activeLeasesByUnitId, tenantsByEmail);

      const result = await prisma.$transaction(async (tx) => {
        let tenantsCreated = 0;
        let leasesCreated = 0;
        let unitsMarkedVacant = 0;

        for (const item of plan) {
          if (item.status === "will-create") {
            // Find or create tenant by placeholder email
            let tenant = tenantsByEmail.get(item.tenantEmail);
            if (!tenant) {
              tenant = await tx.tenant.create({
                data: {
                  firstName: item.firstName,
                  lastName: item.lastName,
                  email: item.tenantEmail,
                  phone: "",
                  organizationId,
                },
              });
              tenantsByEmail.set(item.tenantEmail, tenant);
              tenantsCreated += 1;
            }

            await tx.lease.create({
              data: {
                unitId: item.unitId,
                tenantId: tenant.id,
                startDate: item.startDate,
                endDate: item.endDate,
                rentAmount: item.rentAmount,
                depositAmount: item.depositAmount,
                depositPaid: item.depositAmount > 0,
                status: "ACTIVE",
                signatureStatus: "SIGNED",
                executedAt: item.startDate,
                organizationId,
              },
            });
            await tx.unit.update({
              where: { id: item.unitId },
              data: { status: "OCCUPIED" },
            });
            leasesCreated += 1;
          } else if (item.status === "mark-vacant") {
            await tx.unit.update({
              where: { id: item.unitId },
              data: { status: "VACANT" },
            });
            unitsMarkedVacant += 1;
          }
          // skip-existing / skip-conflict / unmatched / ambiguous → no-op
        }

        return { tenantsCreated, leasesCreated, unitsMarkedVacant };
      });

      res.status(201).json({
        ...result,
        warnings: parsed.warnings,
      });
    } catch (dbErr) {
      console.error("Rent roll commit error:", dbErr);
      res.status(500).json({ error: dbErr.message });
    }
  });
});

export default router;
