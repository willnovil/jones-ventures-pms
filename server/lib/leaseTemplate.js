// Plain JS template engine for lease documents.
// Takes a lease record with included unit (+ property) and tenant.
// Returns a complete HTML document string.

function escape(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(d) {
  if (!d) return "____________";
  return new Date(d).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrency(n) {
  if (n === null || n === undefined) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(n));
}

export function renderLeaseHtml(lease) {
  const tenant = lease.tenant || {};
  const unit = lease.unit || {};
  const property = unit.property || {};

  const tenantName = `${tenant.firstName || ""} ${tenant.lastName || ""}`.trim() || "____________";
  const unitNumber = unit.unitNumber || "____";
  const propertyName = property.name || "____________";
  const propertyAddress = [
    property.address,
    [property.city, property.state, property.zip].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join(", ") || "____________";

  const start = formatDate(lease.startDate);
  const end = formatDate(lease.endDate);
  const rent = formatCurrency(lease.rentAmount);
  const deposit = formatCurrency(lease.depositAmount);

  const generatedAt = formatDate(new Date());

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Residential Lease Agreement</title>
<style>
  body { font-family: Georgia, "Times New Roman", serif; color: #1f2937; max-width: 760px; margin: 0 auto; padding: 48px; line-height: 1.6; }
  h1 { text-align: center; font-size: 22px; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 4px; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #4b5563; margin-top: 28px; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
  .meta { text-align: center; color: #6b7280; font-size: 12px; margin-bottom: 24px; }
  p { margin: 8px 0; font-size: 13.5px; }
  .term { font-weight: 600; }
  .signature-block { margin-top: 48px; display: flex; justify-content: space-between; gap: 32px; }
  .signature { flex: 1; }
  .signature .line { border-bottom: 1px solid #1f2937; height: 32px; }
  .signature .label { font-size: 11px; color: #6b7280; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.05em; }
</style>
</head>
<body>
  <h1>Residential Lease Agreement</h1>
  <p class="meta">Generated ${escape(generatedAt)}</p>

  <p>This Residential Lease Agreement (this &quot;Agreement&quot;) is entered into between
    <span class="term">${escape(propertyName)}</span> (&quot;Landlord&quot;) and
    <span class="term">${escape(tenantName)}</span> (&quot;Tenant&quot;).</p>

  <h2>1. Premises</h2>
  <p>Landlord leases to Tenant the residential premises located at
    <span class="term">${escape(propertyAddress)}, Unit ${escape(unitNumber)}</span>
    (the &quot;Premises&quot;).</p>

  <h2>2. Term</h2>
  <p>The term of this Agreement begins on <span class="term">${escape(start)}</span>
    and ends on <span class="term">${escape(end)}</span>, unless terminated earlier in accordance with this Agreement.</p>

  <h2>3. Rent</h2>
  <p>Tenant agrees to pay rent in the amount of <span class="term">${escape(rent)}</span> per month,
    payable in advance on the first day of each calendar month.</p>

  <h2>4. Security Deposit</h2>
  <p>Tenant has paid or shall pay a security deposit in the amount of
    <span class="term">${escape(deposit)}</span>, to be held by Landlord and returned in accordance with applicable law upon termination of this Agreement.</p>

  <h2>5. Use of Premises</h2>
  <p>Tenant shall use the Premises solely as a private residence and shall not engage in any unlawful activity on the Premises.</p>

  <h2>6. Maintenance</h2>
  <p>Tenant shall keep the Premises in clean and sanitary condition and shall promptly notify Landlord of any needed repairs.</p>

  <h2>7. Default</h2>
  <p>If Tenant fails to pay rent when due or otherwise breaches this Agreement, Landlord may pursue any and all remedies available under applicable law.</p>

  <h2>8. Governing Law</h2>
  <p>This Agreement shall be governed by the laws of the state in which the Premises are located.</p>

  <div class="signature-block">
    <div class="signature">
      <div class="line"></div>
      <div class="label">Landlord</div>
    </div>
    <div class="signature">
      <div class="line"></div>
      <div class="label">Tenant &mdash; ${escape(tenantName)}</div>
    </div>
  </div>
</body>
</html>`;
}
