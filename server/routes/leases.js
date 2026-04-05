import { Router } from "express";

const router = Router();

router.get("/", async (req, res) => {
  const leases = await req.app.locals.prisma.lease.findMany({
    include: { unit: true, tenant: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(leases);
});

router.get("/:id", async (req, res) => {
  const lease = await req.app.locals.prisma.lease.findUnique({
    where: { id: req.params.id },
    include: { unit: true, tenant: true, transactions: true, documents: true },
  });
  if (!lease) return res.status(404).json({ error: "Not found" });
  res.json(lease);
});

router.post("/", async (req, res) => {
  const lease = await req.app.locals.prisma.lease.create({ data: req.body });
  res.status(201).json(lease);
});

router.put("/:id", async (req, res) => {
  const lease = await req.app.locals.prisma.lease.update({
    where: { id: req.params.id },
    data: req.body,
  });
  res.json(lease);
});

router.delete("/:id", async (req, res) => {
  await req.app.locals.prisma.lease.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

export default router;
