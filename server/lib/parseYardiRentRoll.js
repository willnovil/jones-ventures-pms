// Parse a Yardi "Rent Roll" xlsx export.
//
// File shape (from a sample exported on 04/07/2026):
//   Rows 1-4: header metadata (title, "For Selected Properties", As Of, Month Year)
//   Row 5-6:  column headers (split across two rows for some columns)
//   Row 7:    section label "Current/Notice/Vacant Residents"
//   Rows 8-N: unit rows interleaved with per-property "Total {name}({code})" rows
//   Row N+1:  "Total All Properties" grand total
//   Rows N+2..end: summary stats (Square Footage / Rent / Occupancy etc.)
//
// Per-row column meanings on a unit row:
//   A=Unit#  B=Unit Type  C=Sqft  D=Resident (yardi tenant id or "VACANT")
//   E=Tenant Name        F=Market Rent G=Actual Rent
//   H=Resident Deposit   I=Other Deposit
//   J=Move In  K=Lease Expiration  L=Move Out  M=Balance
//
// Strategy: walk rows, buffer unit rows in `currentGroup`, and on each
// "Total ..." row flush the buffer with the property hint extracted from
// the Total row's display name. The Yardi group code in parens at the end
// of the Total display ("Jordan/17th St.(pjordan)") is preserved as a hint
// for the importer to match against the existing Property records.
//
// Returns:
//   {
//     groups: [{ propertyHint: { displayName, code, streetNumber }, units: [...], vacant: [...] }],
//     warnings: ["..."],
//     totalUnits: number,        // unit rows seen (occupied + vacant)
//     totalLeases: number,       // unit rows with a real tenant
//     totalVacant: number,       // unit rows marked VACANT
//   }

import * as XLSX from "xlsx";

// "Total" rows have col D == "Total".
function isTotalRow(row) {
  return row[3] === "Total" || row[3] === "Totals:";
}

// VACANT rows have col D == "VACANT".
function isVacantRow(row) {
  return row[3] === "VACANT";
}

// Top-of-sheet noise — title + "For Selected", As Of, Month Year, header rows.
const HEADER_TEXT = new Set([
  "Rent Roll",
  "For Selected Properties",
  "Unit",
  "Current/Notice/Vacant Residents",
  "Future Residents/Applicants",
  "Occupied Units",
  "Total Non Rev Units",
  "Total Vacant Units",
  "Summary Groups",
  "Totals:",
]);
function isHeaderNoise(row) {
  const a = String(row[0] || "").trim();
  if (HEADER_TEXT.has(a)) return true;
  // "As Of = ..." and "Month Year = ..." rows
  if (/^(As Of|Month Year)\s*=/.test(a)) return true;
  return false;
}

// Pull the Yardi group code from the parens at the end of a Total display
// name like "Jordan/17th St.(pjordan)" → "pjordan", and the leading text
// (which often contains a street address) for property matching.
function parseTotalDisplayName(s) {
  const raw = String(s || "").trim();
  if (!raw) return { displayName: "", code: null, streetNumber: null };
  const m = raw.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  let displayName, code;
  if (m) {
    displayName = m[1].trim();
    code = m[2].trim();
  } else {
    displayName = raw;
    code = null;
  }
  // Yardi exports sometimes prefix the display with a street number.
  // Extract the leading number so the importer can match a Property by
  // street number when the display name doesn't match the saved name
  // verbatim (e.g. "1860 Harle Ave NW" vs "1860 Harle Ave NW Cleveland TN").
  const numMatch = displayName.match(/^(\d+)\b/);
  return {
    displayName,
    code,
    streetNumber: numMatch ? numMatch[1] : null,
  };
}

// xlsx returns numbers as numbers and dates as Date objects (with cellDates: true).
function toFloat(v) {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}
function toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  // Some exports keep dates as strings — try to parse.
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
function splitName(full) {
  const cleaned = String(full || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return { firstName: "", lastName: "" };
  const parts = cleaned.split(" ");
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

export function parseYardiRentRoll(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("Workbook contains no sheets");
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  });

  const groups = [];
  const warnings = [];
  let currentGroup = { propertyHint: null, units: [], vacant: [] };
  let totalUnits = 0;
  let totalLeases = 0;
  let totalVacant = 0;
  // After we hit the "Totals:" / "Total All Properties" grand-total row we
  // stop processing — anything after is summary stats.
  let stopProcessing = false;

  for (const row of rows) {
    if (stopProcessing) break;
    if (!row || row.length === 0) continue;
    if (isHeaderNoise(row)) continue;

    if (isTotalRow(row)) {
      const display = String(row[4] || "").trim();
      // "Total All Properties" — final grand total. Stop here.
      if (/all properties/i.test(display)) {
        stopProcessing = true;
        break;
      }
      currentGroup.propertyHint = parseTotalDisplayName(display);
      groups.push(currentGroup);
      currentGroup = { propertyHint: null, units: [], vacant: [] };
      continue;
    }

    // Otherwise it's a unit row. col A must look like a unit number — if
    // col A is empty AND col D is empty we have a stray blank.
    const unitNumber = String(row[0] || "").trim();
    if (!unitNumber) continue;

    if (isVacantRow(row)) {
      currentGroup.vacant.push({ unitNumber });
      totalUnits += 1;
      totalVacant += 1;
      continue;
    }

    const yardiTenantId = String(row[3] || "").trim();
    const tenantName = String(row[4] || "").trim();
    const { firstName, lastName } = splitName(tenantName);

    if (!firstName) {
      warnings.push(`Row for unit ${unitNumber}: missing tenant name, skipping`);
      continue;
    }

    const moveIn = toDate(row[9]);
    const leaseExpiration = toDate(row[10]);

    if (!moveIn || !leaseExpiration) {
      warnings.push(
        `Unit ${unitNumber} (${tenantName}): missing move-in or lease expiration, skipping`
      );
      continue;
    }

    currentGroup.units.push({
      unitNumber,
      yardiTenantId,
      tenantName,
      firstName,
      lastName,
      rentAmount: toFloat(row[6]), // Actual Rent (col G)
      depositAmount: toFloat(row[7]), // Resident Deposit (col H)
      startDate: moveIn,
      endDate: leaseExpiration,
    });
    totalUnits += 1;
    totalLeases += 1;
  }

  // If the file ended without a final Total row, flush the last group.
  if (currentGroup.units.length > 0 || currentGroup.vacant.length > 0) {
    groups.push(currentGroup);
  }

  return {
    groups,
    warnings,
    totalUnits,
    totalLeases,
    totalVacant,
  };
}
