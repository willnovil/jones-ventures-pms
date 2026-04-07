import { Router } from "express";
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_ROOT = path.join(__dirname, "..", "storage");

// Per-org per-lease document storage.
function leaseDocsDirFor(organizationId) {
  return path.join(STORAGE_ROOT, organizationId, "leases");
}
function leaseDocPathFor(organizationId, leaseId) {
  return path.join(leaseDocsDirFor(organizationId), `${leaseId}.docx`);
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
    res.json(lease);
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

// GET /api/leases/:id/document — stream the filled .docx for download.
// Verifies ownership before serving the file.
router.get("/:id/document", async (req, res) => {
  try {
    const lease = await req.app.locals.prisma.lease.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
      select: { id: true },
    });
    if (!lease) return res.status(404).json({ error: "Not found" });

    const docxPath = leaseDocPathFor(req.organizationId, lease.id);
    const buffer = await fs.readFile(docxPath);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="lease-${lease.id}.docx"`
    );
    res.send(buffer);
  } catch (err) {
    if (err.code === "ENOENT") {
      return res.status(404).json({ error: "Document not generated yet" });
    }
    res.status(500).json({ error: err.message });
  }
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
