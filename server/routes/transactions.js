import { Router } from "express";
import { requireOrganization } from "../middleware/requireOrganization.js";

const router = Router();
router.use(requireOrganization);

router.get("/", async (req, res) => {
  try {
    const transactions = await req.app.locals.prisma.transaction.findMany({
      where: { organizationId: req.organizationId },
      include: { lease: true, tenant: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const transaction = await req.app.locals.prisma.transaction.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
      include: { lease: true, tenant: true },
    });
    if (!transaction) return res.status(404).json({ error: "Not found" });
    res.json(transaction);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    // FK validation: lease + tenant must belong to the same org.
    if (req.body.leaseId) {
      const lease = await prisma.lease.findFirst({
        where: { id: req.body.leaseId, organizationId: req.organizationId },
        select: { id: true },
      });
      if (!lease) return res.status(400).json({ error: "Invalid leaseId" });
    }
    if (req.body.tenantId) {
      const tenant = await prisma.tenant.findFirst({
        where: { id: req.body.tenantId, organizationId: req.organizationId },
        select: { id: true },
      });
      if (!tenant) return res.status(400).json({ error: "Invalid tenantId" });
    }
    const transaction = await prisma.transaction.create({
      data: { ...req.body, organizationId: req.organizationId },
    });
    res.status(201).json(transaction);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const existing = await prisma.transaction.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: "Not found" });
    const transaction = await prisma.transaction.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(transaction);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const result = await req.app.locals.prisma.transaction.deleteMany({
      where: { id: req.params.id, organizationId: req.organizationId },
    });
    if (result.count === 0) return res.status(404).json({ error: "Not found" });
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
