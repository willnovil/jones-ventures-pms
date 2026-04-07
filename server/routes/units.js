import { Router } from "express";
import { requireOrganization } from "../middleware/requireOrganization.js";

const router = Router();
router.use(requireOrganization);

router.get("/", async (req, res) => {
  try {
    const units = await req.app.locals.prisma.unit.findMany({
      where: { organizationId: req.organizationId },
      include: { property: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(units);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const unit = await req.app.locals.prisma.unit.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
      include: { property: true, leases: true },
    });
    if (!unit) return res.status(404).json({ error: "Not found" });
    res.json(unit);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    // FK validation: the parent property must belong to the same org.
    if (req.body.propertyId) {
      const parent = await prisma.property.findFirst({
        where: { id: req.body.propertyId, organizationId: req.organizationId },
        select: { id: true },
      });
      if (!parent) return res.status(400).json({ error: "Invalid propertyId" });
    }
    const unit = await prisma.unit.create({
      data: { ...req.body, organizationId: req.organizationId },
    });
    res.status(201).json(unit);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const existing = await prisma.unit.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: "Not found" });
    const unit = await prisma.unit.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(unit);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const result = await req.app.locals.prisma.unit.deleteMany({
      where: { id: req.params.id, organizationId: req.organizationId },
    });
    if (result.count === 0) return res.status(404).json({ error: "Not found" });
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
