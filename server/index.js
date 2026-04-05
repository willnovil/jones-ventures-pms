import "dotenv/config";
import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";

import propertiesRouter from "./routes/properties.js";
import unitsRouter from "./routes/units.js";
import tenantsRouter from "./routes/tenants.js";
import leasesRouter from "./routes/leases.js";
import transactionsRouter from "./routes/transactions.js";
import maintenanceRouter from "./routes/maintenance.js";
import leadsRouter from "./routes/leads.js";
import dashboardRouter from "./routes/dashboard.js";

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

// Make prisma available to routes
app.locals.prisma = prisma;

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/dashboard", dashboardRouter);
app.use("/api/properties", propertiesRouter);
app.use("/api/units", unitsRouter);
app.use("/api/tenants", tenantsRouter);
app.use("/api/leases", leasesRouter);
app.use("/api/transactions", transactionsRouter);
app.use("/api/maintenance", maintenanceRouter);
app.use("/api/leads", leadsRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
