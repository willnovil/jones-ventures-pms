import { Router } from "express";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const leads = await req.app.locals.prisma.lead.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json(leads);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const lead = await req.app.locals.prisma.lead.findUnique({
      where: { id: req.params.id },
    });
    if (!lead) return res.status(404).json({ error: "Not found" });
    res.json(lead);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const lead = await req.app.locals.prisma.lead.create({ data: req.body });
    res.status(201).json(lead);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const lead = await req.app.locals.prisma.lead.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(lead);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await req.app.locals.prisma.lead.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
