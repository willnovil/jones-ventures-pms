// Local development seed.
//
// Wipes app data (properties, units, tenants, leases, transactions, maintenance,
// leads) for ONE organization, then inserts a realistic set of test data scoped
// to that org. Auth tables (user/session/account/organization/member) are left
// alone so you stay signed in.
//
// By default it targets the most recently created organization — typically the
// one you just signed up as in dev. Pass an org id as the first CLI arg to
// override:
//
//   node prisma/seed.js                              # most recent org
//   node prisma/seed.js de68372f-cfcd-4fbf-b51d-... # specific org
//
// Re-run any time to reset to a known fixture state.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const overrideOrgId = process.argv[2];

function daysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function monthsFromNow(months) {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d;
}

async function main() {
  // 1. Pick the target organization
  let org;
  if (overrideOrgId) {
    org = await prisma.organization.findUnique({ where: { id: overrideOrgId } });
    if (!org) throw new Error(`Organization ${overrideOrgId} not found`);
  } else {
    org = await prisma.organization.findFirst({ orderBy: { createdAt: "desc" } });
    if (!org) throw new Error("No organizations exist. Sign up first.");
  }
  const organizationId = org.id;
  console.log(`Seeding org: ${org.name} (${organizationId})`);

  // 2. Wipe app data for this org. Order matters because of FK constraints —
  //    children before parents. Cascade delete on Property → Unit → Lease/etc.
  //    would cover most of it, but we also have Lead/Document not under Property.
  console.log("Wiping existing app data for this org...");
  await prisma.transaction.deleteMany({ where: { organizationId } });
  await prisma.maintenanceRequest.deleteMany({ where: { organizationId } });
  await prisma.document.deleteMany({ where: { organizationId } });
  await prisma.lease.deleteMany({ where: { organizationId } });
  await prisma.tenant.deleteMany({ where: { organizationId } });
  await prisma.unit.deleteMany({ where: { organizationId } });
  await prisma.property.deleteMany({ where: { organizationId } });
  await prisma.lead.deleteMany({ where: { organizationId } });

  // 3. Properties
  console.log("Creating properties...");
  const sunset = await prisma.property.create({
    data: {
      organizationId,
      name: "Sunset Ridge Apartments",
      address: "1240 Sunset Blvd",
      city: "Austin",
      state: "TX",
      zip: "78704",
      type: "Apartment",
    },
  });
  const oakwood = await prisma.property.create({
    data: {
      organizationId,
      name: "Oakwood Commons",
      address: "55 Oakwood Lane",
      city: "Austin",
      state: "TX",
      zip: "78745",
      type: "Townhome",
    },
  });
  const riverside = await prisma.property.create({
    data: {
      organizationId,
      name: "Riverside Lofts",
      address: "300 River St",
      city: "Austin",
      state: "TX",
      zip: "78701",
      type: "Condo",
    },
  });

  // 4. Units (organizationId required, status will be set later based on leases)
  console.log("Creating units...");
  const unitData = [
    // Sunset Ridge — 6 units
    { propertyId: sunset.id, unitNumber: "A-101", bedrooms: 1, bathrooms: 1, sqft: 650, rentAmount: 1450 },
    { propertyId: sunset.id, unitNumber: "A-102", bedrooms: 2, bathrooms: 1, sqft: 850, rentAmount: 1750 },
    { propertyId: sunset.id, unitNumber: "A-103", bedrooms: 2, bathrooms: 2, sqft: 950, rentAmount: 1900 },
    { propertyId: sunset.id, unitNumber: "B-201", bedrooms: 1, bathrooms: 1, sqft: 680, rentAmount: 1500 },
    { propertyId: sunset.id, unitNumber: "B-202", bedrooms: 3, bathrooms: 2, sqft: 1200, rentAmount: 2400 },
    { propertyId: sunset.id, unitNumber: "B-203", bedrooms: 2, bathrooms: 2, sqft: 950, rentAmount: 1900 },
    // Oakwood — 4 townhomes
    { propertyId: oakwood.id, unitNumber: "1", bedrooms: 3, bathrooms: 2.5, sqft: 1450, rentAmount: 2650 },
    { propertyId: oakwood.id, unitNumber: "2", bedrooms: 3, bathrooms: 2.5, sqft: 1450, rentAmount: 2650 },
    { propertyId: oakwood.id, unitNumber: "3", bedrooms: 4, bathrooms: 3, sqft: 1700, rentAmount: 3100 },
    { propertyId: oakwood.id, unitNumber: "4", bedrooms: 3, bathrooms: 2.5, sqft: 1450, rentAmount: 2650 },
    // Riverside — 4 condos
    { propertyId: riverside.id, unitNumber: "PH-1", bedrooms: 2, bathrooms: 2, sqft: 1100, rentAmount: 2900 },
    { propertyId: riverside.id, unitNumber: "PH-2", bedrooms: 2, bathrooms: 2, sqft: 1100, rentAmount: 2900 },
    { propertyId: riverside.id, unitNumber: "L-1", bedrooms: 1, bathrooms: 1, sqft: 750, rentAmount: 2100 },
    { propertyId: riverside.id, unitNumber: "L-2", bedrooms: 1, bathrooms: 1, sqft: 750, rentAmount: 2100 },
  ];

  const units = [];
  for (const u of unitData) {
    const created = await prisma.unit.create({
      data: { organizationId, status: "VACANT", ...u },
    });
    units.push(created);
  }

  // 5. Tenants
  console.log("Creating tenants...");
  // Email is globally unique on Tenant — use a per-run suffix so re-seeding doesn't collide
  // with stale tenants from another org (or with test users from auth).
  const tenantData = [
    { firstName: "Sarah", lastName: "Mitchell", email: "sarah.mitchell@example.com", phone: "(512) 555-0101" },
    { firstName: "James", lastName: "Chen", email: "james.chen@example.com", phone: "(512) 555-0102" },
    { firstName: "Maria", lastName: "Rodriguez", email: "maria.rodriguez@example.com", phone: "(512) 555-0103" },
    { firstName: "David", lastName: "Park", email: "david.park@example.com", phone: "(512) 555-0104" },
    { firstName: "Emily", lastName: "Watson", email: "emily.watson@example.com", phone: "(512) 555-0105" },
    { firstName: "Michael", lastName: "O'Brien", email: "michael.obrien@example.com", phone: "(512) 555-0106" },
    { firstName: "Priya", lastName: "Patel", email: "priya.patel@example.com", phone: "(512) 555-0107" },
    { firstName: "Tom", lastName: "Nguyen", email: "tom.nguyen@example.com", phone: "(512) 555-0108" },
  ];

  const tenants = [];
  for (const t of tenantData) {
    const created = await prisma.tenant.create({
      data: {
        organizationId,
        emergencyContact: null,
        emergencyPhone: null,
        ...t,
      },
    });
    tenants.push(created);
  }

  // 6. Leases — pair tenants with units, mix of statuses
  console.log("Creating leases...");
  const leaseConfigs = [
    // 6 ACTIVE leases
    { tenantIdx: 0, unitIdx: 0, status: "ACTIVE", monthsAgoStart: -8, monthsFromNowEnd: 4, depositPaid: true },
    { tenantIdx: 1, unitIdx: 2, status: "ACTIVE", monthsAgoStart: -3, monthsFromNowEnd: 9, depositPaid: true },
    { tenantIdx: 2, unitIdx: 4, status: "ACTIVE", monthsAgoStart: -11, monthsFromNowEnd: 1, depositPaid: true }, // expiring soon!
    { tenantIdx: 3, unitIdx: 6, status: "ACTIVE", monthsAgoStart: -5, monthsFromNowEnd: 7, depositPaid: true },
    { tenantIdx: 4, unitIdx: 10, status: "ACTIVE", monthsAgoStart: -2, monthsFromNowEnd: 10, depositPaid: false },
    { tenantIdx: 5, unitIdx: 12, status: "ACTIVE", monthsAgoStart: -6, monthsFromNowEnd: 6, depositPaid: true },
    // 1 DRAFT (in workflow)
    { tenantIdx: 6, unitIdx: 8, status: "DRAFT", monthsAgoStart: 0, monthsFromNowEnd: 12, depositPaid: false },
    // 1 EXPIRED
    { tenantIdx: 7, unitIdx: 1, status: "EXPIRED", monthsAgoStart: -14, monthsFromNowEnd: -2, depositPaid: true },
  ];

  const leases = [];
  for (const cfg of leaseConfigs) {
    const tenant = tenants[cfg.tenantIdx];
    const unit = units[cfg.unitIdx];
    const lease = await prisma.lease.create({
      data: {
        organizationId,
        unitId: unit.id,
        tenantId: tenant.id,
        startDate: monthsFromNow(cfg.monthsAgoStart),
        endDate: monthsFromNow(cfg.monthsFromNowEnd),
        rentAmount: unit.rentAmount,
        depositAmount: unit.rentAmount, // 1 month deposit
        depositPaid: cfg.depositPaid,
        status: cfg.status,
        signatureStatus: cfg.status === "ACTIVE" ? "SIGNED" : cfg.status === "DRAFT" ? "PENDING" : "SIGNED",
      },
    });
    leases.push({ lease, unit, tenant, cfg });

    // Set unit status based on lease
    if (cfg.status === "ACTIVE") {
      await prisma.unit.update({
        where: { id: unit.id },
        data: { status: "OCCUPIED" },
      });
    }
  }

  // 7. Transactions — for active leases, generate past rent charges + payments,
  //    plus the current month outstanding
  console.log("Creating transactions...");
  const now = new Date();
  let txnCount = 0;
  for (const { lease, unit, tenant, cfg } of leases) {
    if (cfg.status !== "ACTIVE") continue;

    // Deposit charge (paid or unpaid based on cfg)
    await prisma.transaction.create({
      data: {
        organizationId,
        leaseId: lease.id,
        tenantId: tenant.id,
        type: "CHARGE",
        amount: lease.depositAmount,
        dueDate: lease.startDate,
        paidDate: cfg.depositPaid ? lease.startDate : null,
        description: "Security deposit",
      },
    });
    txnCount++;

    // Rent charges from lease start to now, all paid except current month
    const monthsElapsed = Math.max(1, Math.abs(cfg.monthsAgoStart));
    for (let m = 0; m < monthsElapsed; m++) {
      const dueDate = new Date(lease.startDate);
      dueDate.setMonth(dueDate.getMonth() + m);
      const isCurrentMonth = m === monthsElapsed - 1;
      const monthLabel = dueDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

      // Charge
      await prisma.transaction.create({
        data: {
          organizationId,
          leaseId: lease.id,
          tenantId: tenant.id,
          type: "CHARGE",
          amount: lease.rentAmount,
          dueDate,
          paidDate: isCurrentMonth ? null : new Date(dueDate.getTime() + 2 * 24 * 60 * 60 * 1000),
          description: `Rent — ${monthLabel}`,
        },
      });
      txnCount++;

      // Payment (only for past months, not current)
      if (!isCurrentMonth) {
        await prisma.transaction.create({
          data: {
            organizationId,
            leaseId: lease.id,
            tenantId: tenant.id,
            type: "PAYMENT",
            amount: lease.rentAmount,
            dueDate,
            paidDate: new Date(dueDate.getTime() + 2 * 24 * 60 * 60 * 1000),
            description: `Rent payment — ${monthLabel}`,
          },
        });
        txnCount++;
      }
    }
  }

  // Add a late fee on one tenant for variety
  await prisma.transaction.create({
    data: {
      organizationId,
      leaseId: leases[0].lease.id,
      tenantId: leases[0].tenant.id,
      type: "LATE_FEE",
      amount: 75,
      dueDate: now,
      description: "Late fee — rent received after grace period",
    },
  });
  txnCount++;

  // 8. Maintenance requests
  console.log("Creating maintenance requests...");
  const maintenanceData = [
    {
      unitIdx: 0, tenantIdx: 0,
      title: "Kitchen sink leaking",
      description: "Slow drip under the sink, looks like the trap needs to be replaced.",
      priority: "MEDIUM", status: "OPEN",
    },
    {
      unitIdx: 2, tenantIdx: 1,
      title: "AC not cooling",
      description: "Thermostat says 72 but the apartment is 84. Filters were just changed.",
      priority: "HIGH", status: "IN_PROGRESS",
      vendorNotes: "HVAC vendor scheduled for tomorrow morning.",
    },
    {
      unitIdx: 4, tenantIdx: 2,
      title: "Front door deadbolt sticking",
      description: "Have to wiggle the key for 30 seconds to lock it.",
      priority: "LOW", status: "OPEN",
    },
    {
      unitIdx: 6, tenantIdx: 3,
      title: "Water heater not working — NO HOT WATER",
      description: "Pilot light keeps going out. This is a 3-person household.",
      priority: "EMERGENCY", status: "IN_PROGRESS",
      vendorNotes: "Plumber dispatched. ETA 2 hours.",
    },
    {
      unitIdx: 10, tenantIdx: 4,
      title: "Dishwasher replacement",
      description: "Old dishwasher beyond repair, needs full replacement.",
      priority: "MEDIUM", status: "COMPLETED",
      vendorNotes: "Installed new GE Profile unit. Warranty paperwork emailed to tenant.",
    },
  ];

  for (const m of maintenanceData) {
    await prisma.maintenanceRequest.create({
      data: {
        organizationId,
        unitId: units[m.unitIdx].id,
        tenantId: tenants[m.tenantIdx].id,
        title: m.title,
        description: m.description,
        priority: m.priority,
        status: m.status,
        photoUrls: [],
        vendorNotes: m.vendorNotes || null,
        completedAt: m.status === "COMPLETED" ? daysFromNow(-2) : null,
      },
    });
  }

  // 9. Leads
  console.log("Creating leads...");
  const leadData = [
    {
      firstName: "Alex", lastName: "Thompson",
      email: "alex.thompson@example.com", phone: "(512) 555-0201",
      unitInterest: "2BR at Sunset Ridge", source: "Website", status: "NEW",
      notes: "Submitted contact form 2 days ago. Looking for move-in by next month.",
    },
    {
      firstName: "Jessica", lastName: "Lin",
      email: "jessica.lin@example.com", phone: "(512) 555-0202",
      unitInterest: "Townhome at Oakwood", source: "Zillow", status: "CONTACTED",
      notes: "Spoke briefly Tuesday. Wants to schedule a showing this weekend.",
    },
    {
      firstName: "Robert", lastName: "Garcia",
      email: "robert.garcia@example.com", phone: "(512) 555-0203",
      unitInterest: "Loft at Riverside", source: "Referral", status: "SHOWING",
      notes: "Showing scheduled for Saturday 2pm. Referred by Maria Rodriguez (current tenant).",
    },
    {
      firstName: "Lisa", lastName: "Anderson",
      email: "lisa.anderson@example.com", phone: "(512) 555-0204",
      unitInterest: "Any 1BR", source: "Apartments.com", status: "APPLIED",
      notes: "Application submitted. Background check in progress.",
    },
    {
      firstName: "Daniel", lastName: "Kumar",
      email: "daniel.kumar@example.com", phone: "(512) 555-0205",
      unitInterest: "B-202 (3BR)", source: "Walk-in", status: "LOST",
      notes: "Decided to buy instead of rent. Closed lost.",
    },
    {
      firstName: "Hannah", lastName: "Schmidt",
      email: "hannah.schmidt@example.com", phone: "(512) 555-0206",
      unitInterest: "PH at Riverside", source: "Social Media", status: "NEW",
      notes: "DM'd via Instagram. Asked about pet policy.",
    },
  ];

  for (const l of leadData) {
    await prisma.lead.create({
      data: { organizationId, ...l },
    });
  }

  // 10. Summary
  const counts = {
    properties: await prisma.property.count({ where: { organizationId } }),
    units: await prisma.unit.count({ where: { organizationId } }),
    tenants: await prisma.tenant.count({ where: { organizationId } }),
    leases: await prisma.lease.count({ where: { organizationId } }),
    transactions: await prisma.transaction.count({ where: { organizationId } }),
    maintenance: await prisma.maintenanceRequest.count({ where: { organizationId } }),
    leads: await prisma.lead.count({ where: { organizationId } }),
  };

  console.log("\nSeed complete:");
  for (const [key, val] of Object.entries(counts)) {
    console.log(`  ${key.padEnd(15)} ${val}`);
  }
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
