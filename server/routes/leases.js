import { Router } from "express";

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
