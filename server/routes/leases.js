import { Router } from "express";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const leases = await req.app.locals.prisma.lease.findMany({
      include: { unit: { include: { property: true } }, tenant: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(leases);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const lease = await req.app.locals.prisma.lease.findUnique({
      where: { id: req.params.id },
      include: { unit: true, tenant: true, transactions: true, documents: true },
    });
    if (!lease) return res.status(404).json({ error: "Not found" });
    res.json(lease);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const lease = await req.app.locals.prisma.lease.create({ data: req.body });
    res.status(201).json(lease);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const lease = await req.app.locals.prisma.lease.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(lease);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await req.app.locals.prisma.lease.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
