// src/utils/generateStatementPdf.ts
import { jsPDF } from "jspdf";

export interface StatementInvoiceRow {
  invoice_no: string;
  invoice_date: string;
  due_date?: string;
  status: string; // "INVOICE" | "DRAFT" | "VOID" (raw DB value)
  total: number;
  amount_paid: number;
  balance: number;
}

export interface StatementData {
  // Company (sender) info
  companyName: string;
  companyEmail: string;
  companyAddress: string;
  companyLogoDataUrl?: string;

  // Client (recipient) info
  clientName: string;
  clientCompany?: string;
  clientEmail?: string;
  clientAddress?: string;

  // Statement metadata
  statementDate: string; // ISO date string e.g. "2026-06-28"
  currency?: string;     // e.g. "USD" — default "USD"

  // Invoice rows
  invoices: StatementInvoiceRow[];
}

/** Map raw DB status values to human-readable labels. */
function formatStatus(raw: string): string {
  const s = raw.toUpperCase();
  if (s === "INVOICE") return "Issued";
  if (s === "DRAFT") return "Draft";
  if (s === "VOID") return "Void";
  return raw;
}

/** Format a number as a currency string: "$1,234.56" */
function formatMoney(amount: number, currencySymbol: string): string {
  return `${currencySymbol}${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Return the conventional symbol for a currency code. Defaults to "$". */
function currencySymbol(code: string): string {
  const map: Record<string, string> = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    CAD: "CA$",
    AUD: "A$",
    INR: "₹",
    JPY: "¥",
    CNY: "¥",
    AED: "AED ",
    NPR: "Rs.",
  };
  return map[code.toUpperCase()] ?? "$";
}

/**
 * Generates a Statement of Account PDF (A4 portrait, 15 mm margins, navy text)
 * and opens it in a new browser tab.
 */
export function generateStatementPdf(data: StatementData): void {
  const currency = data.currency || "USD";
  const symbol = currencySymbol(currency);

  const doc = new jsPDF({
    orientation: "p",
    unit: "mm",
    format: "a4",
  });

  const marginX = 15;
  const marginY = 15;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let currentY = marginY;

  // Navy dark-blue text — same as generateInvoicePdf.ts
  doc.setTextColor(0, 0, 51);

  // ── Thin horizontal rule helper ──────────────────────────────────────────────
  const drawRule = (y: number) => {
    doc.setLineWidth(0.1);
    doc.setDrawColor(200, 200, 200);
    doc.line(marginX, y, pageWidth - marginX, y);
    doc.setDrawColor(0, 0, 0);
  };

  // ── Footer helper ────────────────────────────────────────────────────────────
  const addFooter = () => {
    const footerY = pageHeight - 10;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    drawRule(footerY - 2);
    doc.text(
      `Generated on ${data.statementDate} by JoslaSync`,
      pageWidth / 2,
      footerY,
      { align: "center" }
    );
    doc.setTextColor(0, 0, 51);
  };

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 1 — HEADER
  // ════════════════════════════════════════════════════════════════════════════

  // ── Optional company logo (top-left) ────────────────────────────────────────
  if (data.companyLogoDataUrl) {
    const logoW = 28;
    const logoH = 12;
    try {
      doc.addImage(data.companyLogoDataUrl, "PNG", marginX, currentY, logoW, logoH);
      currentY += logoH + 4;
    } catch {
      // Silently continue if image fails to load
    }
  }

  // ── Company name & contact (top-left) ───────────────────────────────────────
  const headerTopY = currentY; // remember for right-column alignment

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(data.companyName, marginX, currentY);
  currentY += 5;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);

  // Address may contain newlines — split and render each line
  const addrLines = data.companyAddress.split(/\r?\n/).filter(Boolean);
  addrLines.forEach((line) => {
    doc.text(line, marginX, currentY);
    currentY += 4;
  });
  doc.text(data.companyEmail, marginX, currentY);
  currentY += 4;

  doc.setTextColor(0, 0, 51);

  // ── "STATEMENT OF ACCOUNT" + date (top-right, anchored to same headerTopY) ──
  const rightX = pageWidth - marginX;
  let rightY = headerTopY;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 51);
  doc.text("STATEMENT OF ACCOUNT", rightX, rightY, { align: "right" });
  rightY += 7;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`Date: ${data.statementDate}`, rightX, rightY, { align: "right" });

  doc.setTextColor(0, 0, 51);

  // ── First horizontal rule ────────────────────────────────────────────────────
  currentY = Math.max(currentY, rightY + 7) + 2;
  drawRule(currentY);
  currentY += 6;

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 2 — BILL TO
  // ════════════════════════════════════════════════════════════════════════════

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 100, 100);
  doc.text("Bill To:", marginX, currentY);
  currentY += 5;

  doc.setTextColor(0, 0, 51);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(data.clientName, marginX, currentY);
  currentY += 5;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  if (data.clientCompany) {
    doc.text(data.clientCompany, marginX, currentY);
    currentY += 4;
  }
  if (data.clientEmail) {
    doc.text(data.clientEmail, marginX, currentY);
    currentY += 4;
  }
  if (data.clientAddress) {
    const clientAddrLines = data.clientAddress.split(/\r?\n/).filter(Boolean);
    clientAddrLines.forEach((line) => {
      doc.text(line, marginX, currentY);
      currentY += 4;
    });
  }

  currentY += 4;
  drawRule(currentY);
  currentY += 6;

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 3 — INVOICE TABLE
  // ════════════════════════════════════════════════════════════════════════════

  // Column widths (mm) — total must equal pageWidth - 2*marginX = 180 mm
  // Invoice # | Date | Due Date | Status | Inv Total | Amt Paid | Balance Due
  const colWidths = [30, 26, 26, 18, 28, 28, 24]; // 180 mm total
  const colHeaders = [
    "Invoice #",
    "Date",
    "Due Date",
    "Status",
    "Invoice Total",
    "Amount Paid",
    "Balance Due",
  ];
  const tableStartX = marginX;
  const tableWidth = pageWidth - 2 * marginX;
  const rowHeight = 7;
  const cellPad = 2.5;

  // Column x-offsets
  const colX: number[] = [];
  let _cx = tableStartX;
  colWidths.forEach((w) => { colX.push(_cx); _cx += w; });

  // Alignment per column: 0=Invoice#, 1=Date, 2=Due Date, 3=Status → left
  //                       4=InvTotal, 5=AmtPaid, 6=Balance → right
  const colAlign = ["left", "left", "left", "left", "right", "right", "right"] as const;

  const drawTableHeader = () => {
    // Slate header background — rgb(51, 65, 85)
    doc.setFillColor(51, 65, 85);
    doc.rect(tableStartX, currentY, tableWidth, rowHeight, "F");

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);

    colHeaders.forEach((header, i) => {
      const align = colAlign[i];
      const x =
        align === "right"
          ? colX[i] + colWidths[i] - cellPad
          : colX[i] + cellPad;
      doc.text(header, x, currentY + rowHeight / 2, { align, baseline: "middle" });
    });

    currentY += rowHeight;
    doc.setTextColor(0, 0, 51);
  };

  drawTableHeader();

  // ── Data rows ────────────────────────────────────────────────────────────────
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");

  data.invoices.forEach((inv, idx) => {
    // Page break guard (leave room for summary box ~40 mm)
    if (currentY + rowHeight + 45 > pageHeight - marginY) {
      addFooter();
      doc.addPage();
      currentY = marginY;
      drawTableHeader();
    }

    // Alternating row colour: white / very light gray rgb(249,250,251)
    if (idx % 2 === 0) {
      doc.setFillColor(255, 255, 255);
    } else {
      doc.setFillColor(249, 250, 251);
    }
    doc.rect(tableStartX, currentY, tableWidth, rowHeight, "F");

    const midY = currentY + rowHeight / 2;
    const cells = [
      inv.invoice_no,
      inv.invoice_date,
      inv.due_date || "—",
      formatStatus(inv.status),
      formatMoney(inv.total, symbol),
      formatMoney(inv.amount_paid, symbol),
      formatMoney(inv.balance, symbol),
    ];

    cells.forEach((text, i) => {
      const align = colAlign[i];
      const x =
        align === "right"
          ? colX[i] + colWidths[i] - cellPad
          : colX[i] + cellPad;
      doc.text(text, x, midY, { align, baseline: "middle" });
    });

    currentY += rowHeight;
  });

  // Thin line after last data row
  drawRule(currentY);
  currentY += 8;

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 4 — SUMMARY BOX (right-aligned)
  // ════════════════════════════════════════════════════════════════════════════

  const totalInvoiced = data.invoices.reduce((s, r) => s + r.total, 0);
  const totalCollected = data.invoices.reduce((s, r) => s + r.amount_paid, 0);
  const outstanding = data.invoices.reduce((s, r) => s + r.balance, 0);

  // Ensure there's enough room for the summary block (~30 mm)
  if (currentY + 32 > pageHeight - marginY) {
    addFooter();
    doc.addPage();
    currentY = marginY;
  }

  const summaryLabelX = pageWidth - marginX - 65;
  const summaryValueX = pageWidth - marginX;
  const summaryLineH = 7;

  // Total Invoiced
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 51);
  doc.text("Total Invoiced:", summaryLabelX, currentY);
  doc.setFont("helvetica", "bold");
  doc.text(formatMoney(totalInvoiced, symbol), summaryValueX, currentY, { align: "right" });
  currentY += summaryLineH;

  // Total Collected
  doc.setFont("helvetica", "normal");
  doc.text("Total Collected:", summaryLabelX, currentY);
  doc.setFont("helvetica", "bold");
  doc.text(formatMoney(totalCollected, symbol), summaryValueX, currentY, { align: "right" });
  currentY += summaryLineH;

  // Divider above outstanding
  drawRule(currentY - 1);
  currentY += 3;

  // Outstanding Balance — larger font, blue if >0, green if 0
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");

  if (outstanding > 0) {
    doc.setTextColor(30, 64, 175); // blue
  } else {
    doc.setTextColor(21, 128, 61); // green
  }

  doc.text("Outstanding Balance:", summaryLabelX, currentY);
  doc.text(formatMoney(outstanding, symbol), summaryValueX, currentY, { align: "right" });
  doc.setTextColor(0, 0, 51);

  currentY += 4;

  // ════════════════════════════════════════════════════════════════════════════
  // FOOTER
  // ════════════════════════════════════════════════════════════════════════════

  addFooter();

  // Open in new browser tab
  window.open(doc.output("bloburl"), "_blank");
}
