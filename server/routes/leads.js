import { Router } from "express";

const router = Router();

router.get("/", async (req, res) => {
  const leads = await req.app.locals.prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
  });
  res.json(leads);
});

router.get("/:id", async (req, res) => {
  const lead = await req.app.locals.prisma.lead.findUnique({
    where: { id: req.params.id },
  });
  if (!lead) return res.status(404).json({ error: "Not found" });
  res.json(lead);
});

router.post("/", async (req, res) => {
  const lead = await req.app.locals.prisma.lead.create({ data: req.body });
  res.status(201).json(lead);
});

router.put("/:id", async (req, res) => {
  const lead = await req.app.locals.prisma.lead.update({
    where: { id: req.params.id },
    data: req.body,
  });
  res.json(lead);
});

router.delete("/:id", async (req, res) => {
  await req.app.locals.prisma.lead.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

export default router;
