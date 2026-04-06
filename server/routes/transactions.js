import { Router } from "express";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const transactions = await req.app.locals.prisma.transaction.findMany({
      include: { lease: true, tenant: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const transaction = await req.app.locals.prisma.transaction.findUnique({
      where: { id: req.params.id },
      include: { lease: true, tenant: true },
    });
    if (!transaction) return res.status(404).json({ error: "Not found" });
    res.json(transaction);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const transaction = await req.app.locals.prisma.transaction.create({
      data: req.body,
    });
    res.status(201).json(transaction);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const transaction = await req.app.locals.prisma.transaction.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(transaction);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await req.app.locals.prisma.transaction.delete({
      where: { id: req.params.id },
    });
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
