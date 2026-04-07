import { Router } from "express";
import { renderLeaseHtml } from "../lib/leaseTemplate.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const leases = await req.app.locals.prisma.lease.findMany({
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
    const lease = await req.app.locals.prisma.lease.findUnique({
      where: { id: req.params.id },
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
    const lease = await prisma.lease.create({ data: req.body });

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
          where: { unitId: lease.unitId, status: "ACTIVE", id: { not: lease.id } },
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
    const lease = await prisma.lease.findUnique({
      where: { id: req.params.id },
      include: { tenant: true, unit: { include: { property: true } } },
    });
    if (!lease) return res.status(404).json({ error: "Not found" });

    const leaseHtml = renderLeaseHtml(lease);
    const updated = await prisma.lease.update({
      where: { id: req.params.id },
      data: { leaseHtml, status: "DRAFT" },
    });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/:id/review", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
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
    const updated = await prisma.lease.update({
      where: { id: req.params.id },
      data: {
        status: "APPROVED",
        approvedBy: req.body.approvedBy || "system",
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
    const lease = await prisma.lease.findUnique({ where: { id: req.params.id } });
    await prisma.lease.delete({ where: { id: req.params.id } });

    // If deleted lease was active, check if unit should go vacant
    if (lease && lease.unitId && lease.status === "ACTIVE") {
      const otherActive = await prisma.lease.count({
        where: { unitId: lease.unitId, status: "ACTIVE" },
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
