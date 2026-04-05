import { Router } from "express";

const router = Router();

router.get("/", async (req, res) => {
  const units = await req.app.locals.prisma.unit.findMany({
    include: { property: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(units);
});

router.get("/:id", async (req, res) => {
  const unit = await req.app.locals.prisma.unit.findUnique({
    where: { id: req.params.id },
    include: { property: true, leases: true },
  });
  if (!unit) return res.status(404).json({ error: "Not found" });
  res.json(unit);
});

router.post("/", async (req, res) => {
  const unit = await req.app.locals.prisma.unit.create({ data: req.body });
  res.status(201).json(unit);
});

router.put("/:id", async (req, res) => {
  const unit = await req.app.locals.prisma.unit.update({
    where: { id: req.params.id },
    data: req.body,
  });
  res.json(unit);
});

router.delete("/:id", async (req, res) => {
  await req.app.locals.prisma.unit.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

export default router;
