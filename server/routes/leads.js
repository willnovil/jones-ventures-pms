import { Router } from "express";
import { requireOrganization } from "../middleware/requireOrganization.js";

const router = Router();
router.use(requireOrganization);

router.get("/", async (req, res) => {
  try {
    const leads = await req.app.locals.prisma.lead.findMany({
      where: { organizationId: req.organizationId },
      orderBy: { createdAt: "desc" },
    });
    res.json(leads);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const lead = await req.app.locals.prisma.lead.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
    });
    if (!lead) return res.status(404).json({ error: "Not found" });
    res.json(lead);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const lead = await req.app.locals.prisma.lead.create({
      data: { ...req.body, organizationId: req.organizationId },
    });
    res.status(201).json(lead);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const existing = await prisma.lead.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: "Not found" });
    const lead = await prisma.lead.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(lead);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const result = await req.app.locals.prisma.lead.deleteMany({
      where: { id: req.params.id, organizationId: req.organizationId },
    });
    if (result.count === 0) return res.status(404).json({ error: "Not found" });
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
