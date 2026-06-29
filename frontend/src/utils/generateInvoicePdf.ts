// src/utils/generateInvoicePdf.ts
import { jsPDF } from "jspdf";

// Define an interface for the data the PDF generator expects
interface InvoiceData {
  selectedClient: string; // client person name (e.g., "Sharif Ahmadi")
  clientCompany?: string; // client company name (e.g., "Dream Builders LLC")

  invoiceDate: string;
  invoiceTitle: string; // <- optional display section title (NOT status); if blank, no title shown
  lineItems: Array<{ description: string; quantity: number; price: number }>;

  discountEnabled: boolean;
  discountType: "percent" | "flat";
  discountValue: number;
  footerMessage: string;
  subtotal: number;
  discountAmount: number;
  tax: number; // pass your computed taxAmount here
  total: number;

  companyName?: string;
  companyAddress1?: string;
  companyAddress2?: string; // e.g., "Suite 200" OR "Saint Louis, MO 63119"
  companyEmail?: string;
  companyMobile?: string;

  // Optional company logo as a Data URL (e.g., "data:image/png;base64,...")
  companyLogoDataUrl?: string;
  companyLogoWidthMm?: number;   // optional explicit sizing (mm)
  companyLogoHeightMm?: number;  // optional explicit sizing (mm)

  invoiceNumber?: string;
  dueDate?: string;
  createdBy?: string; // full name preferred (e.g., "Mohammad Sharif")
  clientEmail?: string;
  clientPhone?: string;
  pos?: string;

  // Billing (client) address
  clientAddress1?: string;
  clientAddress2?: string;
  clientCity?: string;
  clientState?: string;
  clientZip?: string;
  clientCountry?: string;

  // Shipping address (if different; otherwise mirror billing)
  shippingAddress1?: string;
  shippingAddress2?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingZip?: string;
  shippingCountry?: string;

  additionalInformation?: string;
  status?: string; // <- STATUS (e.g., "Invoice", "Estimate") shown in header, distinct from invoiceTitle
  termsAndConditions?: string; // overrides default boilerplate if provided
}

export function getDefaultTerms(companyName: string, companyEmail: string): string {
  return `${companyName}

These Terms & Conditions govern your use of our services, including software development, website design, brand development, and IT services. By engaging with our services you agree to comply with these Terms & Conditions.

Services: ${companyName} provides software, websites, brand development, and IT services. The scope of services will be outlined in a separate agreement or project proposal.

1. Payment Terms
- Invoices are issued upon project milestones or as agreed.
- Payment is due within 5 days from the invoice date.
- Late payments may incur a 1.5% monthly late fee.

2. Intellectual Property
All intellectual property rights remain with ${companyName} until full payment is received. Upon full payment, rights transfer to the client as per the agreement.

3. Confidentiality
We will keep all client information confidential and will not disclose details without prior written consent, except as required by law.

4. Liability
${companyName} is not liable for indirect, incidental, or consequential damages from our services. Liability is limited to the amount paid for the service.

5. Termination
Either party may terminate with 30 days written notice. The client agrees to pay for all work completed up to the termination date.

6. Governing Law
These Terms & Conditions are governed by the laws of the applicable jurisdiction. Disputes are subject to the exclusive jurisdiction of local courts.

7. Contact Information
For questions or concerns, contact us at: ${companyEmail}

8. Amendments
${companyName} reserves the right to amend these Terms & Conditions at any time. Clients will be notified of changes.`;
}

/**
 * Generates a professional-looking invoice PDF with 15mm margins, centered Billing Address,
 * navy dark blue text color (RGB 0,0,51), right-aligned bold "Total in Words," thin lines
 * above footers on all pages, borderless table with alternating row shades, and other
 * specified features. Uses form data and opens the PDF in a new tab.
 * @param {InvoiceData} data The invoice data to populate the PDF.
 */
export const generateInvoicePdf = (data: InvoiceData, opts?: { returnDoc?: boolean }) => {
  const doc = new jsPDF({
    orientation: "p",
    unit: "mm",
    format: "a4",
  });

  // Define page margins and constants
  const marginX = 15;
  const marginY = 15;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let currentY = marginY;

  // Set navy dark blue text color (almost black)
  doc.setTextColor(0, 0, 51);

  // Function to add footer to the current page
  const addFooter = (message: string) => {
    const footerY = pageHeight - 10;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setLineWidth(0.1);
    doc.setDrawColor(200, 200, 200);
    doc.line(marginX, footerY - 2, pageWidth - marginX, footerY - 2); // Line above footer
    doc.setDrawColor(0, 0, 0);
    doc.text(message, pageWidth / 2, footerY, { align: "center" });
  };

  // --- Optional Company Logo (Top Left, above company details) ---
  if (data.companyLogoDataUrl) {
    const logoW = Math.max(10, Math.min(40, data.companyLogoWidthMm || 28));  // mm
    const logoH = Math.max(6, Math.min(20, data.companyLogoHeightMm || 12));  // mm
    try {
      doc.addImage(data.companyLogoDataUrl, "PNG", marginX, currentY, logoW, logoH);
      currentY += logoH + 4; // spacing after logo, before company text
    } catch {
      // If image fails, continue silently
    }
  }

  // --- Company Details (Top Left) ---
  const companyName = data.companyName || "Josla Tech LLC";
  const companyEmail = data.companyEmail || "info@joslatech.com";
  const companyMobile = data.companyMobile || "314-555-7890";

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(companyName, marginX, currentY);
  currentY += 5;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(data.companyAddress1 || "1234 Olive Street", marginX, currentY);
  currentY += 4;
  doc.text(data.companyAddress2 || "Suite 200", marginX, currentY);
  currentY += 4;
  doc.text("Saint Louis, MO 63119", marginX, currentY);
  currentY += 4;
  doc.text("UNITED STATES", marginX, currentY);
  currentY += 4;
  doc.text(`Email: ${companyEmail}`, marginX, currentY);
  currentY += 4;
  doc.text(`Phone: ${companyMobile}`, marginX, currentY);
  currentY += 8;

  // --- Status Header (Top Right) ---
  const headerRightX = pageWidth - marginX;
  let headerRightY = marginY + 5;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`${(data.status || "INVOICE").toUpperCase()}`, headerRightX, headerRightY, { align: "right" });
  headerRightY += 8;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Number: ${data.invoiceNumber || "INV-2025-9876"}`, headerRightX, headerRightY, { align: "right" });
  headerRightY += 5;
  doc.text(`Date: ${data.invoiceDate || "2025-07-24"}`, headerRightX, headerRightY, { align: "right" });
  headerRightY += 5;
  doc.text(`Due Date: ${data.dueDate || "2025-08-24"}`, headerRightX, headerRightY, { align: "right" });
  headerRightY += 5;
  doc.text(`Created by: ${data.createdBy || "Authorized User"}`, headerRightX, headerRightY, { align: "right" });
  headerRightY += 5;
  doc.text(`POS: ${data.pos || "MISSOURI"}`, headerRightX, headerRightY, { align: "right" });

  // --- Thin Underline below header ---
  doc.setLineWidth(0.1);
  doc.setDrawColor(200, 200, 200);
  const underlineY = Math.max(currentY, headerRightY + 5);
  doc.line(marginX, underlineY, pageWidth - marginX, underlineY);
  doc.setDrawColor(0, 0, 0);
  currentY = underlineY + 6;

  // (Removed the old "Centered Invoice Title" entirely to keep title separate from status)

  // --- Customer, Billing, Shipping Details (Three Columns) ---
  const customerX = marginX;             // left aligned
  const billingX = pageWidth / 2;        // centered column
  const shippingX = pageWidth - marginX; // right aligned

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Customer", customerX, currentY);
  doc.text("Billing Address", billingX, currentY, { align: "center" });
  doc.text("Shipping Address", shippingX, currentY, { align: "right" });
  currentY += 5;

  // Build address lines with fixed 4-row layout:
  // 1) address1 + address2
  // 2) City
  // 3) State + Zip
  // 4) Country
  const cName = data.selectedClient || "John Doe";
  const cCompany = data.clientCompany || "";

  const b1 = data.clientAddress1 || "37100 Fremont Blvd suite k";
  const b2 = data.clientAddress2 || "";
  const bCity = data.clientCity || "Fremont";
  const bState = data.clientState || "CA";
  const bZip = data.clientZip || "94536";
  const bCountry = data.clientCountry || "UNITED STATES";

  const s1 = data.shippingAddress1 || b1;
  const s2 = data.shippingAddress2 || b2;
  const sCity = data.shippingCity || bCity;
  const sState = data.shippingState || bState;
  const sZip = data.shippingZip || bZip;
  const sCountry = data.shippingCountry || bCountry;

  const billLine1 = [b1, b2].filter(Boolean).join(" ");
  const shipLine1 = [s1, s2].filter(Boolean).join(" ");
  const billLine2 = bCity;
  const shipLine2 = sCity;
  const billLine3 = [bState, bZip].filter(Boolean).join(" ");
  const shipLine3 = [sState, sZip].filter(Boolean).join(" ");
  const billLine4 = bCountry;
  const shipLine4 = sCountry;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");

  // Row 1: Customer Name / (Addr1 + Addr2) / (Addr1 + Addr2)
  doc.text(cName, customerX, currentY);
  doc.text(billLine1, billingX, currentY, { align: "center" });
  doc.text(shipLine1, shippingX, currentY, { align: "right" });
  currentY += 4;

  // Row 2: Company (optional) / City / City
  if (cCompany) doc.text(cCompany, customerX, currentY);
  doc.text(billLine2, billingX, currentY, { align: "center" });
  doc.text(shipLine2, shippingX, currentY, { align: "right" });
  currentY += 4;

  // Row 3: Phone / (State + Zip) / (State + Zip)
  doc.text(data.clientPhone || "3142158155", customerX, currentY);
  doc.text(billLine3, billingX, currentY, { align: "center" });
  doc.text(shipLine3, shippingX, currentY, { align: "right" });
  currentY += 4;

  // Row 4: Email / Country / Country
  doc.text(data.clientEmail || "client@example.com", customerX, currentY);
  doc.text(billLine4, billingX, currentY, { align: "center" });
  doc.text(shipLine4, shippingX, currentY, { align: "right" });
  currentY += 10;

  // --- Optional Invoice Title (separate from STATUS). If blank, show NOTHING. ---
  const sectionTitle = (data.invoiceTitle || "").trim();
  if (sectionTitle.length > 0) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(sectionTitle, marginX, currentY);
    currentY += 3;

    doc.setLineWidth(0.1);
    doc.setDrawColor(200, 200, 200);
    doc.line(marginX, currentY, pageWidth - marginX, currentY);
    doc.setDrawColor(0, 0, 0);
    currentY += 4;
  }

  // --- Line Items Table (No Borders, Alternating Shades) ---
  const tableStartX = marginX;
  const tableWidth = pageWidth - 2 * marginX;
  const colWidths = [10, 110, 20, 15, 25]; // Total 180mm
  const colHeaders = ["Sno.", "Description", "Rate", "Qty", "Total"];
  const cellPadding = 3;
  const textLineHeight = 4;
  const baseRowHeight = 8;

  const drawTableHeader = () => {
    doc.setFillColor(240, 240, 240);
    doc.rect(tableStartX, currentY, tableWidth, baseRowHeight, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    let headerX = tableStartX;
    colHeaders.forEach((header, i) => {
      const align = i === 0 || i === 1 ? "left" : i === 3 ? "center" : "right";
      const xOffset = i === 0 || i === 1 ? cellPadding : i === 3 ? colWidths[i] / 2 : colWidths[i] - cellPadding;
      doc.text(header, headerX + xOffset, currentY + baseRowHeight / 2, { align, baseline: "middle" });
      headerX += colWidths[i];
    });
    currentY += baseRowHeight;
  };

  drawTableHeader();

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  data.lineItems.forEach((item, index) => {
    if (!item.description?.trim()) return; // Skip empty descriptions
    const descriptionLines = doc.splitTextToSize(item.description, colWidths[1] - 2 * cellPadding);
    const requiredRowHeight = Math.max(baseRowHeight, descriptionLines.length * textLineHeight + 2 * cellPadding);

    // Check for page break
    if (currentY + requiredRowHeight + 50 > pageHeight - marginY) {
      doc.addPage();
      currentY = marginY;
      drawTableHeader();
    }

    // Draw alternating row background
    if (index % 2 === 0) {
      doc.setFillColor(245, 245, 245); // Light gray for even rows
    } else {
      doc.setFillColor(250, 250, 250); // Lighter gray for odd rows
    }
    doc.rect(tableStartX, currentY, tableWidth, requiredRowHeight, "F");

    const rowStartY = currentY + cellPadding + textLineHeight / 2;
    let cellX = tableStartX;
    const rowTotal = (item.quantity * item.price).toFixed(2);

    // Adjust font size for large numbers
    const priceText = item.price.toFixed(2);
    const totalText = `$${rowTotal}`;
    const maxTextWidth = colWidths[2] - 2 * cellPadding;
    let fontSize = 8;
    if (doc.getTextWidth(priceText) > maxTextWidth || doc.getTextWidth(totalText) > maxTextWidth) {
      fontSize = 7;
      doc.setFontSize(fontSize);
    }

    // Draw cell contents
    doc.text((index + 1).toString(), cellX + cellPadding, rowStartY);
    cellX += colWidths[0];

    let descY = rowStartY;
    descriptionLines.forEach((line) => {
      doc.text(line, cellX + cellPadding, descY);
      descY += textLineHeight;
    });
    cellX += colWidths[1];

    doc.text(priceText, cellX + colWidths[2] - cellPadding, rowStartY, { align: "right" });
    cellX += colWidths[2];
    doc.text(item.quantity.toString(), cellX + colWidths[3] / 2, rowStartY, { align: "center" });
    cellX += colWidths[3];
    doc.text(totalText, cellX + colWidths[4] - cellPadding, rowStartY, { align: "right" });

    doc.setFontSize(8); // Reset font size
    currentY += requiredRowHeight;
  });

  // --- Thin Line After Table ---
  doc.setLineWidth(0.1);
  doc.setDrawColor(200, 200, 200);
  doc.line(marginX, currentY, pageWidth - marginX, currentY);
  doc.setDrawColor(0, 0, 0);
  currentY += 6;

  // Check for page break before totals
  if (currentY + 50 > pageHeight - marginY) {
    doc.addPage();
    currentY = marginY;
  }

  // --- Totals (Right-aligned) ---
  const labelX = pageWidth - marginX - 70;
  const valueX = pageWidth - marginX;
  const totalsLineHeight = 6;
  currentY += 6;

  doc.setFontSize(9);

  // Subtotal
  doc.setFont("helvetica", "normal");
  doc.text("Subtotal:", labelX, currentY);
  doc.setFont("helvetica", "bold");
  doc.text(`$${data.subtotal.toFixed(2)}`, valueX, currentY, { align: "right" });
  currentY += totalsLineHeight;

  // Discount (if enabled)
  if (data.discountEnabled && data.discountAmount > 0) {
    const discountLabel =
      data.discountType === "percent"
        ? `Discount (${data.discountValue}%):`
        : `Discount (Flat $${data.discountValue}):`;

    doc.setFont("helvetica", "normal");
    doc.text(discountLabel, labelX, currentY);
    doc.setFont("helvetica", "bold");
    doc.text(`-$${data.discountAmount.toFixed(2)}`, valueX, currentY, { align: "right" });
    currentY += totalsLineHeight;
  }

  // Tax (if applied)
  if (data.tax > 0) {
    const taxBase = Math.max(0, data.subtotal - data.discountAmount);
    const taxRatePct = taxBase > 0 ? ((data.tax / taxBase) * 100).toFixed(2) : "0.00";
    doc.setFont("helvetica", "normal");
    doc.text(`Tax (${taxRatePct}%):`, labelX, currentY);
    doc.setFont("helvetica", "bold");
    doc.text(`$${data.tax.toFixed(2)}`, valueX, currentY, { align: "right" });
    currentY += totalsLineHeight;
  }

  // Total
  doc.setFont("helvetica", "normal");
  doc.text("Total:", labelX, currentY);
  doc.setFont("helvetica", "bold");
  doc.text(`$${data.total.toFixed(2)}`, valueX, currentY, { align: "right" });
  currentY += totalsLineHeight;

  // Total in Words with Horizontal Lines
  currentY += 8;
  doc.setLineWidth(0.1);
  doc.setDrawColor(200, 200, 200);
  doc.line(marginX, currentY, pageWidth - marginX, currentY);
  currentY += 4;
  const totalInWords = "United States Dollar " + convertNumberToWords(data.total) + " Only";
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(`Total in Words: ${totalInWords}`, pageWidth - marginX, currentY, { align: "right" });
  currentY += 4;
  doc.setLineWidth(0.1);
  doc.setDrawColor(200, 200, 200);
  doc.line(marginX, currentY, pageWidth - marginX, currentY);
  doc.setDrawColor(0, 0, 0);
  doc.setFont("helvetica", "normal");

  // --- ADDITIONAL INFORMATION BLOCK (DYNAMIC AS TABLE) ---
  if (data.additionalInformation?.trim()) {
    const infoItems = data.additionalInformation
      .split(/\n|\r/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (infoItems.length > 0) {
      currentY += 10;
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("Additional Description Table:", marginX, currentY);
      currentY += 6;

      const col1Width = 10; // S.No
      const col2Width = pageWidth - 2 * marginX - col1Width;

      // Draw table header
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setFillColor(240, 240, 240);
      doc.rect(marginX, currentY, col1Width, 6, "F");
      doc.rect(marginX + col1Width, currentY, col2Width, 6, "F");
      doc.text("#", marginX + col1Width / 2, currentY + 4, { align: "center" });
      doc.text("Description", marginX + col1Width + 2, currentY + 4);
      currentY += 6;

      // Draw table rows
      doc.setFont("helvetica", "normal");
      infoItems.forEach((item, index) => {
        const descLines = doc.splitTextToSize(item, col2Width - 4);
        const rowHeight = descLines.length * 4 + 2;

        // Page break if needed
        if (currentY + rowHeight > pageHeight - marginY - 20) {
          doc.addPage();
          currentY = marginY;
        }

        doc.setFillColor(index % 2 === 0 ? 255 : 245);
        doc.rect(marginX, currentY, col1Width, rowHeight, "F");
        doc.rect(marginX + col1Width, currentY, col2Width, rowHeight, "F");

        doc.text((index + 1).toString(), marginX + col1Width / 2, currentY + 5, { align: "center" });

        let lineY = currentY + 5;
        descLines.forEach((line) => {
          doc.text(line, marginX + col1Width + 2, lineY);
          lineY += 4;
        });

        currentY += rowHeight;
      });
    }
  }

  // Add footer to the first page
  addFooter(data.footerMessage || "Terms & Conditions on following page.");

  // --- Page 2: Terms & Conditions ---
  doc.addPage();
  currentY = marginY;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Terms & Conditions", marginX, currentY);
  currentY += 3;

  doc.setLineWidth(0.1);
  doc.setDrawColor(200, 200, 200);
  doc.line(marginX, currentY, pageWidth - marginX, currentY);
  doc.setDrawColor(0, 0, 0);
  currentY += 7;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  const termsCompany = companyName;
  const termsEmail = companyEmail;

  const termsContent: string = data.termsAndConditions?.trim()
    ? data.termsAndConditions.trim()
    : getDefaultTerms(termsCompany, termsEmail);
  const splitText = doc.splitTextToSize(termsContent, pageWidth - 2 * marginX);
  doc.text(splitText, marginX, currentY);

  currentY += splitText.length * 4 + 10;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`For ${termsCompany.toUpperCase()}`, pageWidth - marginX, currentY, { align: "right" });
  currentY += 5;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Authorized Signatory", pageWidth - marginX, currentY, { align: "right" });

  // Add footer to the second page
  addFooter("Thank you for your business.");

  // --- Helper functions ---
  function convertLessThanOneThousand(n: number): string {
    const units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
    const teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
    const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

    let s = "";
    if (Math.floor(n / 100) !== 0) {
      s += units[Math.floor(n / 100)] + " Hundred ";
      n %= 100;
    }
    if (n >= 10 && n <= 19) {
      s += teens[n - 10];
    } else {
      if (Math.floor(n / 10) !== 0) {
        s += tens[Math.floor(n / 10)] + " ";
      }
      n %= 10;
      if (n >= 1 && n <= 9) {
        s += units[n];
      }
    }
    return s.trim();
  }

  function convertNumberToWords(num: number): string {
    if (num === 0) return "Zero";

    const integerPart = Math.floor(num);
    const decimalPart = Math.round((num - integerPart) * 100);

    let words = "";
    let i = 0;
    let tempInteger = integerPart;

    const scales = ["", "Thousand", "Million", "Billion", "Trillion"];
    do {
      const n = tempInteger % 1000;
      if (n !== 0) {
        const s = convertLessThanOneThousand(n);
        words = s + " " + scales[i] + " " + words;
      }
      tempInteger = Math.floor(tempInteger / 1000);
      i++;
    } while (tempInteger > 0);
    words = words.trim();

    if (decimalPart > 0) {
      words += " and " + convertLessThanOneThousand(decimalPart) + " Cents";
    }

    return words.trim();
  }

  if (opts?.returnDoc) return doc;
  window.open(doc.output("bloburl"), "_blank");
};
