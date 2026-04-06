import { Router } from "express";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const tenants = await req.app.locals.prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json(tenants);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const tenant = await req.app.locals.prisma.tenant.findUnique({
      where: { id: req.params.id },
      include: { leases: true, transactions: true, maintenanceRequests: true },
    });
    if (!tenant) return res.status(404).json({ error: "Not found" });
    res.json(tenant);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const tenant = await req.app.locals.prisma.tenant.create({ data: req.body });
    res.status(201).json(tenant);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const tenant = await req.app.locals.prisma.tenant.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(tenant);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await req.app.locals.prisma.tenant.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
