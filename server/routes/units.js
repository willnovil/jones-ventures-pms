import { Router } from "express";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const units = await req.app.locals.prisma.unit.findMany({
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
    const unit = await req.app.locals.prisma.unit.findUnique({
      where: { id: req.params.id },
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
    const unit = await req.app.locals.prisma.unit.create({ data: req.body });
    res.status(201).json(unit);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const unit = await req.app.locals.prisma.unit.update({
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
    await req.app.locals.prisma.unit.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
