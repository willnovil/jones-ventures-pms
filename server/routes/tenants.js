import { Router } from "express";
import { requireOrganization } from "../middleware/requireOrganization.js";

const router = Router();
router.use(requireOrganization);

router.get("/", async (req, res) => {
  try {
    const tenants = await req.app.locals.prisma.tenant.findMany({
      where: { organizationId: req.organizationId },
      orderBy: { createdAt: "desc" },
    });
    res.json(tenants);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const tenant = await req.app.locals.prisma.tenant.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
      include: {
        leases: {
          include: { unit: { include: { property: true } } },
          orderBy: { createdAt: "desc" },
        },
        transactions: { orderBy: { createdAt: "desc" } },
        maintenanceRequests: {
          include: { unit: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!tenant) return res.status(404).json({ error: "Not found" });
    res.json(tenant);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const tenant = await req.app.locals.prisma.tenant.create({
      data: { ...req.body, organizationId: req.organizationId },
    });
    res.status(201).json(tenant);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const existing = await prisma.tenant.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: "Not found" });
    const tenant = await prisma.tenant.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(tenant);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const result = await req.app.locals.prisma.tenant.deleteMany({
      where: { id: req.params.id, organizationId: req.organizationId },
    });
    if (result.count === 0) return res.status(404).json({ error: "Not found" });
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
