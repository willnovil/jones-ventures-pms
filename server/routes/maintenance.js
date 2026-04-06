import { Router } from "express";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const requests = await req.app.locals.prisma.maintenanceRequest.findMany({
      include: { unit: true, tenant: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const request = await req.app.locals.prisma.maintenanceRequest.findUnique({
      where: { id: req.params.id },
      include: { unit: true, tenant: true },
    });
    if (!request) return res.status(404).json({ error: "Not found" });
    res.json(request);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const request = await req.app.locals.prisma.maintenanceRequest.create({
      data: req.body,
    });
    res.status(201).json(request);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const request = await req.app.locals.prisma.maintenanceRequest.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(request);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await req.app.locals.prisma.maintenanceRequest.delete({
      where: { id: req.params.id },
    });
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
