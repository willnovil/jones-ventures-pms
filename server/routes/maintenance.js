import { Router } from "express";
import { requireOrganization } from "../middleware/requireOrganization.js";

const router = Router();
router.use(requireOrganization);

router.get("/", async (req, res) => {
  try {
    const requests = await req.app.locals.prisma.maintenanceRequest.findMany({
      where: { organizationId: req.organizationId },
      include: { unit: true, tenant: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const request = await req.app.locals.prisma.maintenanceRequest.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
      include: { unit: true, tenant: true },
    });
    if (!request) return res.status(404).json({ error: "Not found" });
    res.json(request);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
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
    const request = await prisma.maintenanceRequest.create({
      data: { ...req.body, organizationId: req.organizationId },
    });
    res.status(201).json(request);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const existing = await prisma.maintenanceRequest.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: "Not found" });
    const request = await prisma.maintenanceRequest.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(request);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const result = await req.app.locals.prisma.maintenanceRequest.deleteMany({
      where: { id: req.params.id, organizationId: req.organizationId },
    });
    if (result.count === 0) return res.status(404).json({ error: "Not found" });
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
