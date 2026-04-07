// Parse a Yardi "Unit Directory" xlsx export.
//
// Yardi structure: hierarchical rows where each property group has a header
// row with just a group code in column A (e.g. "pbrown", "pjordan"), one or
// more unit rows below it, and a "Total {group}" summary row. Unit rows
// follow the schema set by row 3:
//   A=Unit#  B=Address  C=Type  D=Rent  E=Deposit  F=Sqft  G=Bedrooms  H=Baths  I=Notes
//
// Strategy: walk every unit row and group by NORMALIZED street address from
// column B. Each unique address becomes one Property; each row at that
// address becomes one Unit. The Yardi group code is intentionally ignored
// (it doesn't always match a single building — e.g. "pjordan" contains 4
// different street addresses).
//
// Returns:
//   {
//     properties: [{ name, address, city, state, zip, type, units: [{...}] }],
//     warnings:   ["..."],
//     totalUnits: number,
//   }

import * as XLSX from "xlsx";

const DEFAULT_CITY = "Cleveland";
const DEFAULT_STATE = "TN";
const DEFAULT_ZIP = "37311"; // matches the bulk of Yardi rows; only one row uses 37312

// Rows at the top of the sheet that aren't unit rows.
const NON_DATA_LABELS = new Set([
  "Unit Directory",
  "For Selected Properties",
  "Unit",
  "Grand Total",
]);

// Parse a free-form address like "1860 Harle Ave NW Cleveland, TN 37311"
// into structured fields. Tolerates the messy variants in the Yardi export
// (lowercase state, missing comma, missing zip, "Cleveland,TN" no-space).
export function parseAddress(raw) {
  if (!raw || typeof raw !== "string") {
    return { street: "", city: DEFAULT_CITY, state: DEFAULT_STATE, zip: DEFAULT_ZIP, incomplete: true };
  }

  let s = raw.replace(/\s+/g, " ").trim();
  let zip = "";
  let state = "";

  // Pull a 5-digit (optionally +4) zip off the end if present.
  const zipMatch = s.match(/[\s,](\d{5})(?:-\d{4})?$/);
  if (zipMatch) {
    zip = zipMatch[1];
    s = s.slice(0, zipMatch.index).trim();
  }

  // Pull a 2-letter state off the end if present. Only attempt this when we
  // already found a zip — otherwise we'd misread street directionals like
  // "SW" or "NE" as a state on rows that lack a zip entirely.
  if (zip) {
    const stateMatch = s.match(/[\s,]([A-Za-z]{2})$/);
    if (stateMatch) {
      state = stateMatch[1].toUpperCase();
      s = s.slice(0, stateMatch.index).trim();
    }
  }

  // Strip a trailing comma left over from "Cleveland,TN" style.
  s = s.replace(/[,\s]+$/, "");

  // The remainder is "{street} {city}" or "{street}, {city}". Prefer the
  // last comma as the boundary; otherwise assume the very last word is the
  // city (works for the Cleveland-only rows in this Yardi export).
  //
  // BUT: if zip was missing (incomplete address), don't try to slice off a
  // city — the whole remainder is the street and we'll fall back to the
  // default city below. Otherwise we'd chop street directionals like "SW".
  let street, city;
  if (!zip) {
    street = s;
    city = "";
  } else {
    const lastComma = s.lastIndexOf(",");
    if (lastComma >= 0) {
      street = s.slice(0, lastComma).trim();
      city = s.slice(lastComma + 1).trim();
    } else {
      const parts = s.split(" ");
      if (parts.length >= 2) {
        city = parts.pop();
        street = parts.join(" ");
      } else {
        street = s;
        city = "";
      }
    }
  }

  return {
    street: street || "",
    city: titleCase(city) || DEFAULT_CITY,
    state: state || DEFAULT_STATE,
    zip: zip || DEFAULT_ZIP,
    incomplete: !zip || !state,
  };
}

function titleCase(s) {
  if (!s) return s;
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

// Group key — two rows belong to the same property if their street/city
// match after normalization. State + zip are included so different zips
// don't accidentally collapse.
function propertyKey(parsed) {
  return [
    parsed.street.toLowerCase().replace(/[.,]/g, "").replace(/\s+/g, " ").trim(),
    parsed.city.toLowerCase(),
    parsed.state,
    parsed.zip,
  ].join("|");
}

// SheetJS returns numbers as numbers and strings as strings. Coerce to the
// types Prisma needs and tolerate values like "1.000000" or "" gracefully.
function toInt(v) {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}
function toFloat(v) {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}
function toStr(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

export function parseYardiUnitDirectory(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("Workbook contains no sheets");
  }
  const sheet = workbook.Sheets[sheetName];
  // Read as array-of-arrays so we can detect group/header/total rows by
  // shape, not by sheet name. defval keeps empty cells positionally aligned.
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false });

  const warnings = [];
  // Map from propertyKey -> property object
  const propertiesByKey = new Map();

  for (const row of rows) {
    if (!row || row.length === 0) continue;

    const a = toStr(row[0]); // Unit
    const b = toStr(row[1]); // Address
    const c = toStr(row[2]); // Unit Type
    const d = row[3];        // Rent
    const e = row[4];        // Deposit
    const f = row[5];        // Sqft
    const g = row[6];        // Room (bedrooms)
    const h = row[7];        // Baths

    // Skip top-of-sheet labels and the column header row.
    if (NON_DATA_LABELS.has(a)) continue;

    // Skip "Total {group}" subtotal rows and "Grand Total".
    if (a.startsWith("Total ")) continue;

    // Skip property-group header rows. These have ONLY column A populated
    // (the group code like "pbrown", "pjordan"). A unit row always has at
    // minimum an address in column B.
    if (!b) continue;

    const parsed = parseAddress(b);
    if (parsed.incomplete) {
      warnings.push(
        `Address "${b}" is incomplete; defaulted city/state/zip to ${DEFAULT_CITY}, ${DEFAULT_STATE} ${DEFAULT_ZIP}`
      );
    }

    const key = propertyKey(parsed);
    let prop = propertiesByKey.get(key);
    if (!prop) {
      prop = {
        name: parsed.street, // human-friendly name = street address
        address: parsed.street,
        city: parsed.city,
        state: parsed.state,
        zip: parsed.zip,
        // Type is reconciled later once we know how many units this prop has.
        // Stash the raw Yardi type in case we want it for diagnostics.
        _yardiType: c,
        units: [],
      };
      propertiesByKey.set(key, prop);
    }

    prop.units.push({
      unitNumber: a || "1",
      bedrooms: toInt(g),
      bathrooms: toFloat(h),
      sqft: toInt(f),
      rentAmount: toFloat(d),
      depositAmount: toFloat(e), // not on Unit model, surfaced for the preview UI only
    });
  }

  // Reconcile property type now that all units are grouped.
  for (const prop of propertiesByKey.values()) {
    prop.type = prop.units.length > 1 ? "Multi-Unit Building" : "Single-Family Home";
    delete prop._yardiType;
  }

  const properties = [...propertiesByKey.values()];
  const totalUnits = properties.reduce((sum, p) => sum + p.units.length, 0);

  return { properties, warnings, totalUnits };
}
