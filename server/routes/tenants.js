import { Router } from "express";

const router = Router();

router.get("/", async (req, res) => {
  const tenants = await req.app.locals.prisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
  });
  res.json(tenants);
});

router.get("/:id", async (req, res) => {
  const tenant = await req.app.locals.prisma.tenant.findUnique({
    where: { id: req.params.id },
    include: { leases: true, transactions: true, maintenanceRequests: true },
  });
  if (!tenant) return res.status(404).json({ error: "Not found" });
  res.json(tenant);
});

router.post("/", async (req, res) => {
  const tenant = await req.app.locals.prisma.tenant.create({ data: req.body });
  res.status(201).json(tenant);
});

router.put("/:id", async (req, res) => {
  const tenant = await req.app.locals.prisma.tenant.update({
    where: { id: req.params.id },
    data: req.body,
  });
  res.json(tenant);
});

router.delete("/:id", async (req, res) => {
  await req.app.locals.prisma.tenant.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

export default router;
