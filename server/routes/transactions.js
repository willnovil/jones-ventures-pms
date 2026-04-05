import { Router } from "express";

const router = Router();

router.get("/", async (req, res) => {
  const transactions = await req.app.locals.prisma.transaction.findMany({
    include: { lease: true, tenant: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(transactions);
});

router.get("/:id", async (req, res) => {
  const transaction = await req.app.locals.prisma.transaction.findUnique({
    where: { id: req.params.id },
    include: { lease: true, tenant: true },
  });
  if (!transaction) return res.status(404).json({ error: "Not found" });
  res.json(transaction);
});

router.post("/", async (req, res) => {
  const transaction = await req.app.locals.prisma.transaction.create({
    data: req.body,
  });
  res.status(201).json(transaction);
});

router.put("/:id", async (req, res) => {
  const transaction = await req.app.locals.prisma.transaction.update({
    where: { id: req.params.id },
    data: req.body,
  });
  res.json(transaction);
});

router.delete("/:id", async (req, res) => {
  await req.app.locals.prisma.transaction.delete({
    where: { id: req.params.id },
  });
  res.status(204).end();
});

export default router;
