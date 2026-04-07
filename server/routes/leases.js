import { Router } from "express";
import multer from "multer";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildLeaseData,
  renderLeaseDocx,
  docxToHtml,
} from "../lib/leaseDocx.js";
import { leaseTemplatePathFor } from "./templates.js";
import { requireOrganization } from "../middleware/requireOrganization.js";

// Multer config used by POST /import-existing and POST /:id/upload-document
// — memory storage, 10 MB cap, .docx OR .pdf accepted. The mime check is
// permissive because some clients (DocuSign downloads, certain browsers)
// send octet-stream; we fall back to extension matching in that case.
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF_MIME = "application/pdf";
const ACCEPTED_MIMES = new Set([DOCX_MIME, PDF_MIME, "application/octet-stream"]);
const leaseDocUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase();
    const isDocxExt = name.endsWith(".docx");
    const isPdfExt = name.endsWith(".pdf");
    const mimeOk = ACCEPTED_MIMES.has(file.mimetype);
    if (!(isDocxExt || isPdfExt) || !mimeOk) {
      return cb(new Error("Only .docx or .pdf files are allowed"));
    }
    cb(null, true);
  },
});

// Pick the storage extension from an uploaded file (prefer mime, fall back
// to filename — handles octet-stream uploads correctly).
function uploadedExt(file) {
  if (file.mimetype === PDF_MIME) return "pdf";
  if (file.mimetype === DOCX_MIME) return "docx";
  const name = file.originalname.toLowerCase();
  if (name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".docx")) return "docx";
  return null;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_ROOT = path.join(__dirname, "..", "storage");

// Per-org per-lease document storage. A lease has at most one document on
// disk and it's either a .docx (generated from a template, OR uploaded as
// the original signed copy) OR a .pdf (uploaded — typically the version
// that came back from DocuSign). The two formats are mutually exclusive
// per lease — when a new doc is uploaded we always wipe both extensions
// before writing the new one.
function leaseDocsDirFor(organizationId) {
  return path.join(STORAGE_ROOT, organizationId, "leases");
}
function leaseDocPathForExt(organizationId, leaseId, ext) {
  return path.join(leaseDocsDirFor(organizationId), `${leaseId}.${ext}`);
}
// Backward-compat alias used by the lease generator (which only writes .docx).
function leaseDocPathFor(organizationId, leaseId) {
  return leaseDocPathForExt(organizationId, leaseId, "docx");
}

const LEASE_DOC_EXTS = ["pdf", "docx"];
const MIME_BY_EXT = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

// Find whichever stored file exists for a given lease, or null if neither.
async function findLeaseDocFile(organizationId, leaseId) {
  for (const ext of LEASE_DOC_EXTS) {
    const p = leaseDocPathForExt(organizationId, leaseId, ext);
    try {
      await fs.access(p);
      return { path: p, ext, mime: MIME_BY_EXT[ext] };
    } catch {
      /* not present, try next */
    }
  }
  return null;
}

// Delete any stored doc for this lease (both extensions). Used before
// writing a replacement so we don't end up with a stale file in the other
// format hanging around.
async function deleteLeaseDocFiles(organizationId, leaseId) {
  for (const ext of LEASE_DOC_EXTS) {
    const p = leaseDocPathForExt(organizationId, leaseId, ext);
    try {
      await fs.unlink(p);
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
    }
  }
}

const router = Router();
router.use(requireOrganization);

router.get("/", async (req, res) => {
  try {
    const leases = await req.app.locals.prisma.lease.findMany({
      where: { organizationId: req.organizationId },
      include: { unit: { include: { property: true } }, tenant: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(leases);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const lease = await req.app.locals.prisma.lease.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
      include: { unit: true, tenant: true, transactions: true, documents: true },
    });
    if (!lease) return res.status(404).json({ error: "Not found" });
    // Tell the client whether the on-disk document (if any) is pdf or docx
    // so it knows whether to render the leaseHtml preview vs an iframe
    // pointing at the document URL.
    const found = await findLeaseDocFile(req.organizationId, lease.id);
    res.json({ ...lease, documentExtension: found?.ext || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    // FK validation
    if (req.body.unitId) {
      const unit = await prisma.unit.findFirst({
        where: { id: req.body.unitId, organizationId: req.organizationId },
        select: { id: true },
      });
      if (!unit) return res.status(400).json({ error: "Invalid unitId" });
    }
    if (req.body.tenantId) {
      const tenant = await prisma.tenant.findFirst({
        where: { id: req.body.tenantId, organizationId: req.organizationId },
        select: { id: true },
      });
      if (!tenant) return res.status(400).json({ error: "Invalid tenantId" });
    }
    const lease = await prisma.lease.create({
      data: { ...req.body, organizationId: req.organizationId },
    });

    // Auto-set unit to OCCUPIED when creating an active lease
    if (lease.status === "ACTIVE" && lease.unitId) {
      await prisma.unit.update({
        where: { id: lease.unitId },
        data: { status: "OCCUPIED" },
      });
    }

    res.status(201).json(lease);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/leases/import-existing — multipart endpoint for ingesting a
// pre-existing signed lease (i.e. one that was signed outside this PMS).
//
// Request shape (multipart/form-data):
//   tenantId        — optional; if present, reuse this existing tenant
//   firstName       — required when tenantId is omitted
//   lastName        — required when tenantId is omitted
//   email           — required when tenantId is omitted (Tenant.email is unique)
//   phone           — required when tenantId is omitted
//   emergencyContact, emergencyPhone — optional
//   unitId          — required
//   startDate       — required (ISO date)
//   endDate         — required (ISO date)
//   rentAmount      — required (number)
//   depositAmount   — required (number)
//   depositPaid     — "true" | "false" string from FormData
//   file            — optional .docx; if present, gets attached to the lease
//
// Side effects:
//   - Creates the Tenant when tenantId is omitted (or 409s if email taken)
//   - Creates the Lease with status=ACTIVE, signatureStatus=SIGNED,
//     executedAt=startDate (or now if no startDate)
//   - Sets the Unit to OCCUPIED
//   - When a file is uploaded: writes to {storage}/{orgId}/leases/{id}.docx,
//     populates lease.leaseHtml via mammoth, sets lease.documentUrl so the
//     existing GET /api/leases/:id/document handler will stream it
//
// All DB writes happen in a single transaction. The file is written AFTER
// the transaction commits — if the file write fails we still have the row,
// which is the lesser of two evils (the user can re-upload the doc later).
router.post("/import-existing", (req, res) => {
  leaseDocUpload.single("file")(req, res, async (uploadErr) => {
    if (uploadErr) return res.status(400).json({ error: uploadErr.message });

    const prisma = req.app.locals.prisma;
    const orgId = req.organizationId;
    const body = req.body || {};

    // Required fields
    const required = ["unitId", "startDate", "endDate", "rentAmount", "depositAmount"];
    for (const f of required) {
      if (body[f] === undefined || body[f] === "") {
        return res.status(400).json({ error: `Missing required field: ${f}` });
      }
    }
    // Either an existing tenantId, or all the fields needed to create one.
    if (!body.tenantId) {
      for (const f of ["firstName", "lastName", "email", "phone"]) {
        if (!body[f]) {
          return res.status(400).json({
            error: `Missing required field: ${f} (or provide tenantId)`,
          });
        }
      }
    }

    // FK / ownership check on the unit BEFORE we open the transaction.
    const unit = await prisma.unit.findFirst({
      where: { id: body.unitId, organizationId: orgId },
      select: { id: true },
    });
    if (!unit) return res.status(400).json({ error: "Invalid unitId" });

    if (body.tenantId) {
      const t = await prisma.tenant.findFirst({
        where: { id: body.tenantId, organizationId: orgId },
        select: { id: true },
      });
      if (!t) return res.status(400).json({ error: "Invalid tenantId" });
    }

    const startDate = new Date(body.startDate);
    const endDate = new Date(body.endDate);
    const rentAmount = parseFloat(body.rentAmount);
    const depositAmount = parseFloat(body.depositAmount);
    const depositPaid = body.depositPaid === "true" || body.depositPaid === true;

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return res.status(400).json({ error: "Invalid startDate or endDate" });
    }
    if (!Number.isFinite(rentAmount) || !Number.isFinite(depositAmount)) {
      return res.status(400).json({ error: "Invalid rentAmount or depositAmount" });
    }

    let createdLease;
    try {
      createdLease = await prisma.$transaction(async (tx) => {
        let tenantId = body.tenantId;
        if (!tenantId) {
          const tenant = await tx.tenant.create({
            data: {
              firstName: body.firstName.trim(),
              lastName: body.lastName.trim(),
              email: body.email.trim().toLowerCase(),
              phone: body.phone.trim(),
              emergencyContact: body.emergencyContact?.trim() || null,
              emergencyPhone: body.emergencyPhone?.trim() || null,
              organizationId: orgId,
            },
          });
          tenantId = tenant.id;
        }

        const lease = await tx.lease.create({
          data: {
            unitId: body.unitId,
            tenantId,
            startDate,
            endDate,
            rentAmount,
            depositAmount,
            depositPaid,
            status: "ACTIVE",
            signatureStatus: "SIGNED",
            executedAt: startDate,
            organizationId: orgId,
          },
        });

        await tx.unit.update({
          where: { id: body.unitId },
          data: { status: "OCCUPIED" },
        });

        return lease;
      });
    } catch (dbErr) {
      // Surface the unique-email collision in a friendlier way than P2002.
      if (dbErr.code === "P2002" && dbErr.meta?.target?.includes("email")) {
        return res.status(409).json({
          error: "A tenant with that email already exists. Pick them from the existing tenant list.",
        });
      }
      console.error("import-existing transaction failed:", dbErr);
      return res.status(500).json({ error: dbErr.message });
    }

    // Optional file attachment — done AFTER the tx so a file write failure
    // doesn't roll back the lease/tenant. If this fails, the lease row still
    // exists and the user can edit/re-upload later.
    if (req.file) {
      try {
        const ext = uploadedExt(req.file);
        if (!ext) throw new Error("Unsupported file type");

        const docsDir = leaseDocsDirFor(orgId);
        await fs.mkdir(docsDir, { recursive: true });
        // Wipe both extensions before writing — keeps "one doc per lease".
        await deleteLeaseDocFiles(orgId, createdLease.id);
        const filePath = leaseDocPathForExt(orgId, createdLease.id, ext);
        await fs.writeFile(filePath, req.file.buffer);

        // Only docx can be previewed in-app via mammoth. PDFs render in an
        // iframe on the client, so we leave leaseHtml null.
        const leaseHtml = ext === "docx" ? await docxToHtml(req.file.buffer) : null;

        createdLease = await prisma.lease.update({
          where: { id: createdLease.id },
          data: {
            leaseHtml,
            documentUrl: `/api/leases/${createdLease.id}/document`,
          },
        });
      } catch (fileErr) {
        console.error("import-existing file write failed:", fileErr);
        // Lease still created; just warn in the response.
        return res.status(201).json({
          lease: createdLease,
          warning: `Lease created but document attach failed: ${fileErr.message}`,
        });
      }
    }

    res.status(201).json({ lease: createdLease });
  });
});

router.put("/:id", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const existing = await prisma.lease.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: "Not found" });

    const lease = await prisma.lease.update({
      where: { id: req.params.id },
      data: req.body,
    });

    // Auto-update unit status based on lease status
    if (lease.unitId) {
      if (lease.status === "ACTIVE") {
        await prisma.unit.update({
          where: { id: lease.unitId },
          data: { status: "OCCUPIED" },
        });
      } else if (lease.status === "EXPIRED" || lease.status === "TERMINATED") {
        // Only set VACANT if no other active lease exists on this unit
        const otherActive = await prisma.lease.count({
          where: {
            organizationId: req.organizationId,
            unitId: lease.unitId,
            status: "ACTIVE",
            id: { not: lease.id },
          },
        });
        if (otherActive === 0) {
          await prisma.unit.update({
            where: { id: lease.unitId },
            data: { status: "VACANT" },
          });
        }
      }
    }

    res.json(lease);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- Workflow endpoints ---

router.post("/:id/generate", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const lease = await prisma.lease.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
      include: { tenant: true, unit: { include: { property: true } } },
    });
    if (!lease) return res.status(404).json({ error: "Not found" });

    // Read the user-uploaded lease template (.docx) for this org.
    const templatePath = leaseTemplatePathFor(req.organizationId);
    let templateBuffer;
    try {
      templateBuffer = await fs.readFile(templatePath);
    } catch (err) {
      if (err.code === "ENOENT") {
        return res.status(400).json({
          error: "No lease template uploaded. Upload one in Templates first.",
          code: "NO_TEMPLATE",
        });
      }
      throw err;
    }

    // Render the .docx with the lease data.
    const data = buildLeaseData(lease);
    const filledDocx = renderLeaseDocx(templateBuffer, data);

    // Persist the filled .docx to per-org per-lease storage.
    const docsDir = leaseDocsDirFor(req.organizationId);
    await fs.mkdir(docsDir, { recursive: true });
    const docxPath = leaseDocPathFor(req.organizationId, lease.id);
    await fs.writeFile(docxPath, filledDocx);

    // Convert to HTML for the in-app preview.
    const leaseHtml = await docxToHtml(filledDocx);

    const updated = await prisma.lease.update({
      where: { id: req.params.id },
      data: {
        leaseHtml,
        documentUrl: `/api/leases/${lease.id}/document`,
        status: "DRAFT",
      },
    });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/leases/:id/document — stream whatever document is stored for
// this lease (.docx or .pdf), with the right content-type. Verifies
// ownership before reading the file.
router.get("/:id/document", async (req, res) => {
  try {
    const lease = await req.app.locals.prisma.lease.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
      select: { id: true },
    });
    if (!lease) return res.status(404).json({ error: "Not found" });

    const found = await findLeaseDocFile(req.organizationId, lease.id);
    if (!found) {
      return res.status(404).json({ error: "Document not generated yet" });
    }
    const buffer = await fs.readFile(found.path);
    res.setHeader("Content-Type", found.mime);
    // PDFs default to inline so the iframe preview on LeaseDetail can
    // render them; docx must be attachment because browsers can't display
    // them. The download button on the client passes ?download=1 to force
    // attachment for both formats.
    const forceDownload = req.query.download === "1" || found.ext === "docx";
    const disposition = forceDownload ? "attachment" : "inline";
    res.setHeader(
      "Content-Disposition",
      `${disposition}; filename="lease-${lease.id}.${found.ext}"`
    );
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/leases/:id/upload-document — attach OR replace the document on
// an existing lease. The two main use cases:
//   1. A lease was generated as .docx, sent via DocuSign, and the user is
//      now attaching the signed PDF that came back.
//   2. A lease was created via "Add Existing" without a file and the user
//      is now attaching the original signed copy.
//
// The endpoint accepts .docx or .pdf, wipes any pre-existing file for this
// lease, writes the new one with its real extension, and updates leaseHtml
// + documentUrl. PDFs get a null leaseHtml (the client embeds them in an
// iframe instead of showing the mammoth-rendered HTML).
router.post("/:id/upload-document", (req, res) => {
  leaseDocUpload.single("file")(req, res, async (uploadErr) => {
    if (uploadErr) return res.status(400).json({ error: uploadErr.message });
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    try {
      const prisma = req.app.locals.prisma;
      const lease = await prisma.lease.findFirst({
        where: { id: req.params.id, organizationId: req.organizationId },
        select: { id: true },
      });
      if (!lease) return res.status(404).json({ error: "Not found" });

      const ext = uploadedExt(req.file);
      if (!ext) return res.status(400).json({ error: "Unsupported file type" });

      const docsDir = leaseDocsDirFor(req.organizationId);
      await fs.mkdir(docsDir, { recursive: true });
      // Wipe the other format (if any) so we never have stale stale leftovers.
      await deleteLeaseDocFiles(req.organizationId, lease.id);
      const filePath = leaseDocPathForExt(req.organizationId, lease.id, ext);
      await fs.writeFile(filePath, req.file.buffer);

      const leaseHtml = ext === "docx" ? await docxToHtml(req.file.buffer) : null;

      const updated = await prisma.lease.update({
        where: { id: lease.id },
        data: {
          leaseHtml,
          documentUrl: `/api/leases/${lease.id}/document`,
        },
      });

      res.json({ ...updated, documentExtension: ext });
    } catch (err) {
      console.error("upload-document failed:", err);
      res.status(500).json({ error: err.message });
    }
  });
});

router.post("/:id/review", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const existing = await prisma.lease.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: "Not found" });
    const updated = await prisma.lease.update({
      where: { id: req.params.id },
      data: { status: "PENDING_REVIEW", reviewedAt: new Date() },
    });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/:id/approve", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const existing = await prisma.lease.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: "Not found" });
    const updated = await prisma.lease.update({
      where: { id: req.params.id },
      data: {
        status: "APPROVED",
        approvedBy: req.body.approvedBy || req.user?.email || "system",
        approvedAt: new Date(),
      },
    });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/:id/send", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const existing = await prisma.lease.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: "Not found" });
    const updated = await prisma.lease.update({
      where: { id: req.params.id },
      data: { status: "SENT", signatureStatus: "SENT", sentAt: new Date() },
    });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/:id/sign", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const existing = await prisma.lease.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: "Not found" });
    const updated = await prisma.lease.update({
      where: { id: req.params.id },
      data: {
        status: "ACTIVE",
        signatureStatus: "SIGNED",
        executedAt: new Date(),
      },
    });

    // Mirror unit auto-status sync from PUT /:id
    if (updated.unitId) {
      await prisma.unit.update({
        where: { id: updated.unitId },
        data: { status: "OCCUPIED" },
      });
    }

    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const lease = await prisma.lease.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
    });
    if (!lease) return res.status(404).json({ error: "Not found" });

    await prisma.lease.delete({ where: { id: req.params.id } });

    // If deleted lease was active, check if unit should go vacant
    if (lease.unitId && lease.status === "ACTIVE") {
      const otherActive = await prisma.lease.count({
        where: {
          organizationId: req.organizationId,
          unitId: lease.unitId,
          status: "ACTIVE",
        },
      });
      if (otherActive === 0) {
        await prisma.unit.update({
          where: { id: lease.unitId },
          data: { status: "VACANT" },
        });
      }
    }

    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
