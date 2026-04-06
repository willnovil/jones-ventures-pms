import { Router } from "express";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const properties = await req.app.locals.prisma.property.findMany({
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
    const property = await req.app.locals.prisma.property.findUnique({
      where: { id: req.params.id },
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
      data: req.body,
    });
    res.status(201).json(property);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const property = await req.app.locals.prisma.property.update({
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
    await req.app.locals.prisma.property.delete({
      where: { id: req.params.id },
    });
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
