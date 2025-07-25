import { jsPDF } from "jspdf";

// Define an interface for the data the PDF generator expects
interface InvoiceData {
  selectedClient: string;
  invoiceDate: string;
  invoiceTitle: string;
  lineItems: Array<{ description: string; quantity: number; price: number }>;
  discountEnabled: boolean;
  discountType: "percent" | "flat";
  discountValue: number;
  footerMessage: string;
  subtotal: number;
  discountAmount: number;
  tax: number;
  total: number;
  companyName?: string;
  companyAddress1?: string;
  companyAddress2?: string;
  companyEmail?: string;
  companyMobile?: string;
  invoiceNumber?: string;
  dueDate?: string;
  createdBy?: string;
  clientEmail?: string;
  clientPhone?: string;
  pos?: string;
  clientAddress1?: string;
  clientAddress2?: string;
  clientCity?: string;
  clientZip?: string;
  clientCountry?: string;
  shippingAddress1?: string;
  shippingAddress2?: string;
  shippingCity?: string;
  shippingZip?: string;
  shippingCountry?: string;
}

/**
 * Generates a professional-looking invoice PDF with 15mm margins, centered Billing Address,
 * company name as Josla Tech LLC in Saint Louis, MO 63119, random dummy company details,
 * navy dark blue text color (RGB 0,0,51), right-aligned bold "Total in Words," thin lines
 * above footers on all pages, borderless table with alternating row shades, and other
 * specified features. Uses form data and opens the PDF in a new tab.
 * @param {InvoiceData} data The invoice data to populate the PDF.
 */
export const generateInvoicePdf = (data: InvoiceData) => {
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

  // --- Company Details (Top Left) ---
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(data.companyName || "Josla Tech LLC", marginX, currentY);
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
  doc.text(`Email: ${data.companyEmail || "info@joslatech.com"}`, marginX, currentY);
  currentY += 4;
  doc.text(`Phone: ${data.companyMobile || "314-555-7890"}`, marginX, currentY);
  currentY += 8;

  // --- Invoice/Estimate Header (Top Right) ---
  const headerRightX = pageWidth - marginX;
  let headerRightY = marginY + 5;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(data.invoiceTitle || "INVOICE", headerRightX, headerRightY, { align: "right" });
  headerRightY += 8;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Number: ${data.invoiceNumber || "INV-2025-9876"}`, headerRightX, headerRightY, { align: "right" });
  headerRightY += 5;
  doc.text(`Date: ${data.invoiceDate || "24-07-2025"}`, headerRightX, headerRightY, { align: "right" });
  headerRightY += 5;
  doc.text(`Due Date: ${data.dueDate || "24-08-2025"}`, headerRightX, headerRightY, { align: "right" });
  headerRightY += 5;
  doc.text(`Created by: ${data.createdBy || "Emma Carter"}`, headerRightX, headerRightY, { align: "right" });
  headerRightY += 5;
  doc.text(`POS: ${data.pos || "MISSOURI"}`, headerRightX, headerRightY, { align: "right" });

  // --- Thin Underline below header ---
  doc.setLineWidth(0.1);
  doc.setDrawColor(200, 200, 200);
  doc.line(marginX, Math.max(currentY, headerRightY + 5), pageWidth - marginX, Math.max(currentY, headerRightY + 5));
  doc.setDrawColor(0, 0, 0);
  currentY = Math.max(currentY, headerRightY + 5) + 8;

  // --- Customer, Billing, Shipping Details (Three Columns) ---
  const customerX = marginX; // 15mm
  const billingX = pageWidth / 2; // ~105mm (center of page)
  const shippingX = pageWidth - marginX; // ~195mm

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Customer", customerX, currentY);
  doc.text("Billing Address", billingX, currentY, { align: "center" });
  doc.text("Shipping Address", shippingX, currentY, { align: "right" });
  currentY += 5;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const clientName = data.selectedClient || "John Doe";
  doc.text(clientName, customerX, currentY);
  doc.text(data.clientAddress1 || "37100 Fremont Blvd suite k", billingX, currentY, { align: "center" });
  doc.text(data.shippingAddress1 || "37100 Fremont Blvd suite k", shippingX, currentY, { align: "right" });
  currentY += 4;
  doc.text(clientName, customerX, currentY);
  doc.text(data.clientAddress2 || "Fremont", billingX, currentY, { align: "center" });
  doc.text(data.shippingAddress2 || "Fremont", shippingX, currentY, { align: "right" });
  currentY += 4;
  doc.text(data.clientPhone || "5109750292", customerX, currentY);
  doc.text(data.clientZip || "94536", billingX, currentY, { align: "center" });
  doc.text(data.shippingZip || "94536", shippingX, currentY, { align: "right" });
  currentY += 4;
  doc.text(data.clientEmail || "rajkrishna@momoandkebab.com", customerX, currentY);
  doc.text(data.clientCountry || "UNITED STATES", billingX, currentY, { align: "center" });
  doc.text(data.shippingCountry || "UNITED STATES", shippingX, currentY, { align: "right" });
  currentY += 10;

  // --- Invoice Title ---
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("General Services Rendered", marginX, currentY);
  currentY += 3;
  doc.setLineWidth(0.1);
  doc.setDrawColor(200, 200, 200);
  doc.line(marginX, currentY, pageWidth - marginX, currentY);
  doc.setDrawColor(0, 0, 0);
  currentY += 4;

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
    descriptionLines.forEach(line => {
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

  // --- Totals and Bank Details Section ---
  const totalsBlockWidth = colWidths[4];
  const totalsBlockX = tableStartX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3];
  const totalsValueX = totalsBlockX + totalsBlockWidth - cellPadding;
  const bankDetailsX = marginX;
  const totalsSpacing = 8;

  // Check for page break
  if (currentY + 50 > pageHeight - marginY) {
    doc.addPage();
    currentY = marginY;
  }

  // Bank Details (Left)
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Bank Name: FIRST BANK OF MISSOURI", bankDetailsX, currentY);
  currentY += totalsSpacing;
  doc.text("Account Name: JOSLA TECH LLC", bankDetailsX, currentY);
  currentY += totalsSpacing;
  doc.text("Account Number: 9876543210", bankDetailsX, currentY);
  currentY += totalsSpacing;
  doc.text("Routing Number: 081000123", bankDetailsX, currentY);

  // Totals (Right, aligned with Total column)
  let totalsY = currentY - (3 * totalsSpacing);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Taxable", totalsBlockX - 20, totalsY);
  doc.setFont("helvetica", "bold");
  doc.text(`USD ${data.subtotal.toFixed(2)}`, totalsValueX, totalsY, { align: "right" });
  totalsY += totalsSpacing;
  doc.setFont("helvetica", "normal");
  doc.text("Discount", totalsBlockX - 20, totalsY);
  doc.setFont("helvetica", "bold");
  doc.text(`USD ${data.discountAmount.toFixed(2)}`, totalsValueX, totalsY, { align: "right" });
  totalsY += totalsSpacing;
  doc.setFont("helvetica", "normal");
  doc.text("Other Charges", totalsBlockX - 20, totalsY);
  doc.setFont("helvetica", "bold");
  doc.text("USD 0.00", totalsValueX, totalsY, { align: "right" });
  totalsY += totalsSpacing;
  doc.setFont("helvetica", "normal");
  doc.text("Total", totalsBlockX - 20, totalsY);
  doc.setFont("helvetica", "bold");
  doc.text(`USD ${data.total.toFixed(2)}`, totalsValueX, totalsY, { align: "right" });
  doc.setFont("helvetica", "normal");

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
  const termsContent = `
Josla Tech LLC

These Terms & Conditions govern your use of our services, including software development, website design, brand development, and IT services. By engaging with our services you agree to comply with these Terms & Conditions.

Services: Josla Tech LLC provides software, websites, brand development, and IT services. The scope of services will be outlined in a separate agreement or project proposal.

1. Payment Terms
- Invoices are issued upon project milestones or as agreed.
- Payment is due within 5 days from the invoice date.
- Late payments may incur a 1.5% monthly late fee.

2. Intellectual Property
All intellectual property rights remain with Josla Tech LLC until full payment is received. Upon full payment, rights transfer to the client as per the agreement.

3. Confidentiality
We will keep all client information confidential and will not disclose details without prior written consent, except as required by law.

4. Liability
Josla Tech LLC is not liable for indirect, incidental, or consequential damages from our services. Liability is limited to the amount paid for the service.

5. Termination
Either party may terminate with 30 days written notice. The client agrees to pay for all work completed up to the termination date.

6. Governing Law
These Terms & Conditions are governed by the laws of Missouri, USA. Disputes are subject to the exclusive jurisdiction of Missouri courts.

7. Contact Information
For questions or concerns, contact us at: info@joslatech.com

8. Amendments
Josla Tech LLC reserves the right to amend these Terms & Conditions at any time. Clients will be notified of changes.
  `;
  const splitText = doc.splitTextToSize(termsContent, pageWidth - 2 * marginX);
  doc.text(splitText, marginX, currentY);

  currentY += splitText.length * 4 + 10;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("For JOSLA TECH LLC", pageWidth - marginX, currentY, { align: "right" });
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

  // Open the PDF in a new tab
  window.open(doc.output("bloburl"), "_blank");
};