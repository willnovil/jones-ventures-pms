import { Router } from "express";
import { requireOrganization } from "../middleware/requireOrganization.js";

const router = Router();
router.use(requireOrganization);

router.get("/", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const orgId = req.organizationId;

    const [
      totalProperties,
      totalUnits,
      vacantUnits,
      occupiedUnits,
      maintenanceUnits,
      totalTenants,
      activeLeases,
      expiringLeases,
      openMaintenance,
      inProgressMaintenance,
      newLeads,
      recentTransactions,
      recentMaintenance,
      recentLeads,
    ] = await Promise.all([
      prisma.property.count({ where: { organizationId: orgId } }),
      prisma.unit.count({ where: { organizationId: orgId } }),
      prisma.unit.count({ where: { organizationId: orgId, status: "VACANT" } }),
      prisma.unit.count({ where: { organizationId: orgId, status: "OCCUPIED" } }),
      prisma.unit.count({ where: { organizationId: orgId, status: "MAINTENANCE" } }),
      prisma.tenant.count({ where: { organizationId: orgId } }),
      prisma.lease.count({ where: { organizationId: orgId, status: "ACTIVE" } }),
      prisma.lease.count({
        where: {
          organizationId: orgId,
          status: "ACTIVE",
          endDate: {
            lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            gte: new Date(),
          },
        },
      }),
      prisma.maintenanceRequest.count({ where: { organizationId: orgId, status: "OPEN" } }),
      prisma.maintenanceRequest.count({ where: { organizationId: orgId, status: "IN_PROGRESS" } }),
      prisma.lead.count({ where: { organizationId: orgId, status: "NEW" } }),
      prisma.transaction.findMany({
        where: { organizationId: orgId },
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { tenant: true },
      }),
      prisma.maintenanceRequest.findMany({
        where: { organizationId: orgId },
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { unit: true, tenant: true },
      }),
      prisma.lead.findMany({
        where: { organizationId: orgId },
        take: 5,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const totalRentExpected = await prisma.lease.aggregate({
      where: { organizationId: orgId, status: "ACTIVE" },
      _sum: { rentAmount: true },
    });

    const totalCollected = await prisma.transaction.aggregate({
      where: { organizationId: orgId, type: "PAYMENT" },
      _sum: { amount: true },
    });

    const totalOutstanding = await prisma.transaction.aggregate({
      where: { organizationId: orgId, type: "CHARGE", paidDate: null },
      _sum: { amount: true },
    });

    // Build recent activity feed from transactions + maintenance
    const recentActivity = [
      ...recentTransactions.map((t) => ({
        id: `txn-${t.id}`,
        type: "transaction",
        description: `${t.type} — ${t.tenant.firstName} ${t.tenant.lastName}${t.description ? `: ${t.description}` : ""}`,
        date: t.createdAt,
        status: t.type,
      })),
      ...recentMaintenance.map((m) => ({
        id: `mnt-${m.id}`,
        type: "maintenance",
        description: `${m.title} — Unit ${m.unit.unitNumber}`,
        date: m.createdAt,
        status: m.status,
      })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);

    // Build leads list
    const leads = recentLeads.map((l) => ({
      id: l.id,
      name: `${l.firstName} ${l.lastName}`,
      email: l.email,
      status: l.status,
      createdAt: l.createdAt,
    }));

    res.json({
      stats: {
        totalProperties,
        totalUnits,
        vacantUnits,
        occupiedUnits,
        maintenanceUnits,
        totalTenants,
        activeLeases,
        expiringSoon: expiringLeases,
        openMaintenance,
        inProgressMaintenance,
        newLeads,
        occupancyRate: totalUnits > 0 ? parseFloat(((occupiedUnits / totalUnits) * 100).toFixed(1)) : 0,
      },
      financials: {
        monthlyRentExpected: totalRentExpected._sum.rentAmount || 0,
        totalCollected: totalCollected._sum.amount || 0,
        outstandingBalance: totalOutstanding._sum.amount || 0,
      },
      recentActivity,
      leads,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
