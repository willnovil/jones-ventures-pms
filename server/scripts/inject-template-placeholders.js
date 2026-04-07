// One-off script: inject docxtemplater placeholders into the user's existing
// blank lease template by surgically editing document.xml inside the docx zip.
//
// Word splits text across multiple <w:t> runs whenever formatting changes,
// so each replacement uses an "anchor" element (the first <w:t> of the target
// span) plus a list of trailing <w:t> elements to clear. We find each by exact
// content match, scoped to positions AFTER the prior replacement so a generic
// fragment like "1" or " " doesn't match somewhere unintended.
//
// Run:  node scripts/inject-template-placeholders.js <orgId>
// Defaults to the org id seeded in dev.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import PizZip from "pizzip";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ORG_ID = process.argv[2] || "99a47142-af66-43cb-86fa-19a2a7402512";
const TEMPLATE_PATH = path.join(
  __dirname,
  "..",
  "storage",
  ORG_ID,
  "templates",
  "lease-template.docx"
);

// Each step: find the FIRST occurrence (after the running cursor) of the anchor
// w:t element, replace its content with `placeholder`, then for each entry in
// `clearNext` find the FIRST occurrence after the anchor and clear it.
const STEPS = [
  {
    label: "Tenant name (opening paragraph)",
    anchor: "Flor Hernandez and Abel Hernandez",
    placeholder: "{tenantFullName}",
    clearNext: [],
  },
  {
    label: "Property address",
    anchor: "1601 Jordan Ave ",
    placeholder: "{propertyFullAddress}",
    clearNext: [" ", ", ", "Cleveland, ", "TN 3731", "1"],
  },
  {
    label: "Lease start date",
    anchor: "October 3",
    placeholder: "{startDate}",
    clearNext: [",", " 2025"],
  },
  {
    label: "Lease end date",
    anchor: "October 31",
    placeholder: "{endDate}",
    clearNext: [", ", " ", "202", "6"],
  },
  {
    label: "Monthly rent (rental amount paragraph)",
    anchor: "900",
    placeholder: "{rentAmount}",
    // The "$" before "900" must also be cleared since {rentAmount} already
    // includes it. The "$" lives in a w:t before "900", but we anchor on
    // "900" so we need to walk BACKWARD for the $ — handled separately below
    // via a one-off replacement of `>$</w:t></w:r>...<w:t>900` -> the cleared form.
    clearNext: [".00"],
  },
  {
    label: "Security deposit",
    anchor: "900.00",
    placeholder: "{depositAmount}",
    clearNext: [],
  },
  // Strip the bank account reference (the original landlord's Bank of
  // Cleveland account number was hardcoded in clause 3). Trim the trailing
  // " at " from the preceding run, then erase the bank name, the
  // " having account number " connector, and the account number itself.
  // Must come BEFORE the execution date step because it appears earlier in
  // the document and the cursor only walks forward.
  {
    label: "Strip bank reference (clause 3)",
    anchor: "which Owner shall deposit in a separate account used solely for this purpose at ",
    placeholder: "which Owner shall deposit in a separate account used solely for this purpose",
    clearNext: ["Bank of Cleveland", " having account number ", "20010184"],
  },
  {
    label: "Execution date (09/15/2025)",
    anchor: "09/1",
    placeholder: "{generatedDate}",
    clearNext: ["5", "/2025"],
  },
  {
    label: "Tenant name (signature line 1)",
    anchor: "Flor Hernandez",
    placeholder: "{tenantFullName}",
    clearNext: [],
  },
  // Note: signature line 2 ("Abel Hernandez") is intentionally left alone —
  // the system only models one tenant per lease. Will can blank it manually
  // in Word if he wants to.
];

// Helper: find the first <w:t [optional attrs]>EXACT_CONTENT</w:t> at-or-after
// `from`. Returns { start, end, fullMatch, contentStart, contentEnd } or null.
function findWtElement(xml, content, from = 0) {
  // Match <w:t> or <w:t xml:space="preserve">, with the exact content.
  // We escape regex specials in `content`.
  const escaped = content.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`<w:t(?:\\s[^>]*)?>(${escaped})</w:t>`, "g");
  re.lastIndex = from;
  const m = re.exec(xml);
  if (!m) return null;
  return {
    start: m.index,
    end: m.index + m[0].length,
    fullMatch: m[0],
    contentStart: m.index + m[0].indexOf(">", 4) + 1,
    contentEnd: m.index + m[0].lastIndexOf("</w:t>"),
  };
}

// Replace the content of a w:t element with new text. Preserves any
// attributes (e.g. xml:space="preserve") that were on the original.
function replaceWtContent(xml, hit, newText) {
  return xml.substring(0, hit.contentStart) + newText + xml.substring(hit.contentEnd);
}

async function main() {
  const buf = await fs.readFile(TEMPLATE_PATH);
  const zip = new PizZip(buf);
  let xml = zip.file("word/document.xml").asText();

  let cursor = 0;

  for (const step of STEPS) {
    const anchorHit = findWtElement(xml, step.anchor, cursor);
    if (!anchorHit) {
      console.warn(`SKIP ${step.label}: anchor "${step.anchor}" not found after cursor ${cursor}`);
      continue;
    }
    // Replace anchor content with the placeholder
    xml = replaceWtContent(xml, anchorHit, step.placeholder);
    // Recompute end position because the content length changed
    const lengthDelta = step.placeholder.length - step.anchor.length;
    let runningCursor = anchorHit.end + lengthDelta;

    // Clear each follow-on fragment (first occurrence after the anchor)
    for (const frag of step.clearNext) {
      const fragHit = findWtElement(xml, frag, runningCursor);
      if (!fragHit) {
        console.warn(
          `  WARN ${step.label}: clearNext fragment "${frag}" not found after position ${runningCursor}`
        );
        continue;
      }
      xml = replaceWtContent(xml, fragHit, "");
      runningCursor = fragHit.end - frag.length;
    }
    cursor = runningCursor;
    console.log(`OK   ${step.label}`);
  }

  // Special case: kill the standalone "$" w:t elements that precede {rentAmount}
  // and {depositAmount}. They live in their own runs. We anchor on the
  // "{rentAmount}" / "{depositAmount}" we just inserted and walk backward to
  // find the immediately preceding <w:t>$</w:t>.
  for (const tag of ["{rentAmount}", "{depositAmount}"]) {
    const tagIdx = xml.indexOf(tag);
    if (tagIdx === -1) continue;
    // Search the 800 bytes before the tag for the LAST occurrence of <w:t>$</w:t>
    const window = xml.substring(Math.max(0, tagIdx - 800), tagIdx);
    const lastDollar = window.lastIndexOf("<w:t>$</w:t>");
    if (lastDollar === -1) continue;
    const absoluteIdx = Math.max(0, tagIdx - 800) + lastDollar;
    xml =
      xml.substring(0, absoluteIdx) +
      "<w:t></w:t>" +
      xml.substring(absoluteIdx + "<w:t>$</w:t>".length);
    console.log(`OK   cleared leading $ before ${tag}`);
  }

  // Verify all expected placeholders are now present
  const expected = [
    "{tenantFullName}",
    "{propertyFullAddress}",
    "{startDate}",
    "{endDate}",
    "{rentAmount}",
    "{depositAmount}",
    "{generatedDate}",
  ];
  console.log("\nVerification:");
  for (const tag of expected) {
    const count = (xml.match(new RegExp(tag.replace(/[{}]/g, "\\$&"), "g")) || []).length;
    console.log(`  ${tag.padEnd(25)} ${count} occurrence(s)`);
  }

  // Write back into the zip and save
  zip.file("word/document.xml", xml);
  const out = zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
  await fs.writeFile(TEMPLATE_PATH, out);
  console.log(`\nSaved: ${TEMPLATE_PATH} (${out.length} bytes)`);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
