import { Router } from "express";

const router = Router();

router.get("/", async (req, res) => {
  const properties = await req.app.locals.prisma.property.findMany({
    include: { units: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(properties);
});

router.get("/:id", async (req, res) => {
  const property = await req.app.locals.prisma.property.findUnique({
    where: { id: req.params.id },
    include: { units: true },
  });
  if (!property) return res.status(404).json({ error: "Not found" });
  res.json(property);
});

router.post("/", async (req, res) => {
  const property = await req.app.locals.prisma.property.create({
    data: req.body,
  });
  res.status(201).json(property);
});

router.put("/:id", async (req, res) => {
  const property = await req.app.locals.prisma.property.update({
    where: { id: req.params.id },
    data: req.body,
  });
  res.json(property);
});

router.delete("/:id", async (req, res) => {
  await req.app.locals.prisma.property.delete({
    where: { id: req.params.id },
  });
  res.status(204).end();
});

export default router;
