// DOCX lease renderer.
// Reads a user-uploaded .docx template, fills in placeholders with lease
// data via docxtemplater, and converts the result to HTML for in-app preview
// via mammoth. The user's template is the source of truth — we only
// substitute placeholder tags, never alter wording, layout, or styling.

import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import mammoth from "mammoth";

// The exact set of placeholders the user can put in their .docx template.
// Tags use docxtemplater's default {tag} syntax.
export const PLACEHOLDERS = [
  { tag: "tenantFullName", description: "Tenant's full name" },
  { tag: "tenantFirstName", description: "Tenant's first name" },
  { tag: "tenantLastName", description: "Tenant's last name" },
  { tag: "tenantEmail", description: "Tenant's email address" },
  { tag: "tenantPhone", description: "Tenant's phone number" },
  { tag: "propertyName", description: "Property name" },
  { tag: "propertyAddress", description: "Property street address" },
  { tag: "propertyCity", description: "Property city" },
  { tag: "propertyState", description: "Property state" },
  { tag: "propertyZip", description: "Property ZIP code" },
  { tag: "propertyFullAddress", description: "Property street, city, state ZIP" },
  { tag: "unitNumber", description: "Unit number" },
  { tag: "bedrooms", description: "Number of bedrooms" },
  { tag: "bathrooms", description: "Number of bathrooms" },
  { tag: "startDate", description: "Lease start date (e.g. April 6, 2026)" },
  { tag: "endDate", description: "Lease end date (e.g. April 5, 2027)" },
  { tag: "rentAmount", description: "Monthly rent (e.g. $1,500.00)" },
  { tag: "depositAmount", description: "Security deposit (e.g. $1,500.00)" },
  { tag: "generatedDate", description: "Date the document was generated" },
];

function formatDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrency(n) {
  if (n === null || n === undefined) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(n));
}

// Build the data object passed to docxtemplater. Lease must be loaded with
// tenant + unit (with property) included.
export function buildLeaseData(lease) {
  const tenant = lease.tenant || {};
  const unit = lease.unit || {};
  const property = unit.property || {};

  const tenantFullName = `${tenant.firstName || ""} ${tenant.lastName || ""}`.trim();
  const cityStateZip = [
    [property.city, property.state].filter(Boolean).join(", "),
    property.zip,
  ]
    .filter(Boolean)
    .join(" ");
  const propertyFullAddress = [property.address, cityStateZip]
    .filter(Boolean)
    .join(", ");

  return {
    tenantFullName,
    tenantFirstName: tenant.firstName || "",
    tenantLastName: tenant.lastName || "",
    tenantEmail: tenant.email || "",
    tenantPhone: tenant.phone || "",
    propertyName: property.name || "",
    propertyAddress: property.address || "",
    propertyCity: property.city || "",
    propertyState: property.state || "",
    propertyZip: property.zip || "",
    propertyFullAddress,
    unitNumber: unit.unitNumber || "",
    bedrooms: unit.bedrooms ?? "",
    bathrooms: unit.bathrooms ?? "",
    startDate: formatDate(lease.startDate),
    endDate: formatDate(lease.endDate),
    rentAmount: formatCurrency(lease.rentAmount),
    depositAmount: formatCurrency(lease.depositAmount),
    generatedDate: formatDate(new Date()),
  };
}

// Render the template buffer with the given data and return the filled
// .docx as a Buffer. Throws on template syntax errors or missing tags
// (when paranoid mode is enabled — here we use nullGetter to keep going).
export function renderLeaseDocx(templateBuffer, data) {
  const zip = new PizZip(templateBuffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    // Replace unknown tags with empty string instead of throwing.
    nullGetter() {
      return "";
    },
  });
  doc.render(data);
  return doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
}

// Convert a filled .docx Buffer to an HTML string for in-app preview.
// mammoth produces minimal styling — that's intentional; the source of
// truth for the actual lease is the .docx itself.
export async function docxToHtml(docxBuffer) {
  const result = await mammoth.convertToHtml({ buffer: docxBuffer });
  // Wrap in a minimal styled document so the iframe preview is readable.
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Lease Preview</title>
<style>
  body { font-family: Georgia, "Times New Roman", serif; color: #1f2937; max-width: 760px; margin: 0 auto; padding: 48px; line-height: 1.6; font-size: 14px; }
  h1, h2, h3 { color: #111827; }
  p { margin: 8px 0; }
  table { border-collapse: collapse; margin: 12px 0; }
  td, th { border: 1px solid #d1d5db; padding: 6px 10px; }
</style>
</head>
<body>
${result.value}
</body>
</html>`;
}
