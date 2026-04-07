import { Router } from "express";
import { requireOrganization } from "../middleware/requireOrganization.js";

const router = Router();
router.use(requireOrganization);

router.get("/", async (req, res) => {
  try {
    const properties = await req.app.locals.prisma.property.findMany({
      where: { organizationId: req.organizationId },
      include: { units: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(properties);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const property = await req.app.locals.prisma.property.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
      include: { units: true },
    });
    if (!property) return res.status(404).json({ error: "Not found" });
    res.json(property);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const property = await req.app.locals.prisma.property.create({
      data: { ...req.body, organizationId: req.organizationId },
    });
    res.status(201).json(property);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const existing = await prisma.property.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: "Not found" });
    const property = await prisma.property.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(property);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const result = await req.app.locals.prisma.property.deleteMany({
      where: { id: req.params.id, organizationId: req.organizationId },
    });
    if (result.count === 0) return res.status(404).json({ error: "Not found" });
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
