import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatAmount, invoiceTotal, type Invoice } from "@/lib/data/finance";

const CYAN = "#00AECD";
const TEXT_MAIN = "#1f2937";
const TEXT_MUTED = "#6b7280";

function money(amount: number, currency: string): string {
  if (amount === 0) return "—";
  return `${currency} ${formatAmount(amount)}`;
}

function qtyOrDash(qty: number): string {
  if (qty === 0) return "—";
  return String(qty);
}

// Helper to fetch image as data URL for jsPDF and get dimensions
async function getImageDataAndSize(imageUrl: string): Promise<{ dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.drawImage(img, 0, 0);
      resolve({ dataUrl: canvas.toDataURL("image/png"), width: img.width, height: img.height });
    };
    img.onerror = reject;
    img.src = imageUrl;
  });
}

export async function downloadInvoicePdf(invoice: Invoice): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;

  // Wait for logo to load
  let logoDataUrl = "";
  let logoW = 0;
  let logoH = 0;
  try {
    const res = await getImageDataAndSize("/logo.png");
    logoDataUrl = res.dataUrl;
    logoW = res.width;
    logoH = res.height;
  } catch (e) {
    console.error("Failed to load logo", e);
  }

  const renderLogo = (x: number, y: number, maxW: number, maxH: number) => {
    if (logoDataUrl) {
      const ratio = Math.min(maxW / logoW, maxH / logoH);
      const w = logoW * ratio;
      const h = logoH * ratio;
      // y is treated as top edge
      doc.addImage(logoDataUrl, "PNG", x, y, w, h);
      return h;
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(TEXT_MAIN);
      doc.text("ZIRIUM AI", x, y + 16);
      return 22;
    }
  };

  // --- Page 1 ---------------------------------------------------------------
  
  // Header Bar
  doc.setFillColor(CYAN);
  doc.rect(0, 0, pageWidth, 16, "F");

  // Top Section: Logo & INVOICE title
  let y = 48;
  const logoH1 = renderLogo(margin, y, 180, 56);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(TEXT_MAIN);
  doc.text("INVOICE", pageWidth - margin, y + 24, { align: "right" });

  y = y + Math.max(logoH1, 24) + 16;

  const created = invoice.createdAt?.toDate() ?? new Date();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(TEXT_MUTED);
  doc.text(`Invoice No: ${invoice.number}`, pageWidth - margin, y, { align: "right" });
  y += 16;
  doc.text(
    `Invoice Date: ${created.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    })}`,
    pageWidth - margin,
    y,
    { align: "right" }
  );

  y += 24;
  // Cyan rule
  doc.setDrawColor(CYAN);
  doc.setLineWidth(1.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 30;

  // Bill To & From
  const splitY = y;
  
  // Bill To (Left)
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(CYAN);
  doc.text("Bill To:", margin, y);
  y += 18;
  
  doc.setFont("helvetica", "bold");
  doc.setTextColor(TEXT_MAIN);
  doc.text(invoice.clientName || "—", margin, y);
  y += 16;
  
  doc.setFont("helvetica", "normal");
  doc.setTextColor(TEXT_MUTED);
  if (invoice.clientCompany) {
    doc.text(invoice.clientCompany, margin, y);
    y += 16;
  }
  if (invoice.clientAddress) {
    const lines = doc.splitTextToSize(invoice.clientAddress, (pageWidth / 2) - margin - 20);
    doc.text(lines, margin, y);
    y += lines.length * 16;
  }

  // From (Right)
  let rightY = splitY;
  const rightX = pageWidth / 2 + 20;
  
  doc.setFont("helvetica", "bold");
  doc.setTextColor(CYAN);
  doc.text("From:", rightX, rightY);
  rightY += 18;

  doc.setFont("helvetica", "bold");
  doc.setTextColor(TEXT_MAIN);
  doc.text("ZIRIUM AI SMC PVT LTD", rightX, rightY);
  rightY += 16;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(TEXT_MUTED);
  doc.text("Office E-29, 3rd Floor, GS Towers,", rightX, rightY);
  rightY += 16;
  doc.text("Ring Road, Adjacent Hayatabad Toll Plaza,", rightX, rightY);
  rightY += 16;
  doc.text("Peshawar, Pakistan — 25000", rightX, rightY);
  rightY += 16;
  doc.text("NTN: I979681-4", rightX, rightY);
  
  y = Math.max(y, rightY) + 36;

  // Items Table
  const total = invoiceTotal(invoice);
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Description", "Quantity", "Amount"]],
    body: invoice.items.map((it) => {
      const desc = it.category ? `${it.category}\n${it.description}` : it.description;
      return [
        desc || "—",
        qtyOrDash(it.qty),
        money(it.qty * it.unitPrice, invoice.currency),
      ];
    }),
    styles: { font: "helvetica", fontSize: 10, cellPadding: 10, textColor: TEXT_MAIN },
    headStyles: { fillColor: CYAN, textColor: "#ffffff", fontStyle: "bold" },
    columnStyles: {
      0: { halign: "left" },
      1: { cellWidth: 70, halign: "center" },
      2: { cellWidth: 120, halign: "right" },
    },
    didParseCell: (data) => {
      // Force header alignments
      if (data.section === "head") {
        if (data.column.index === 0) data.cell.styles.halign = "left";
        if (data.column.index === 1) data.cell.styles.halign = "center";
        if (data.column.index === 2) data.cell.styles.halign = "right";
      }
    }
  });

  const afterTableY = (doc as any).lastAutoTable.finalY + 36;

  // Amount Due
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  
  const amtDueStr = "Amount Due: ";
  const currStr = `${invoice.currency} `;
  const valStr = formatAmount(total);
  
  const wAmtDue = doc.getTextWidth(amtDueStr);
  const wCurr = doc.getTextWidth(currStr);
  const wVal = doc.getTextWidth(valStr);
  
  const totalW = wAmtDue + wCurr + wVal;
  let startX = pageWidth - margin - totalW;
  
  doc.setTextColor(TEXT_MAIN);
  doc.text(amtDueStr, startX, afterTableY);
  startX += wAmtDue;
  
  doc.setTextColor(CYAN);
  doc.text(currStr, startX, afterTableY);
  startX += wCurr;
  
  doc.setTextColor(TEXT_MAIN);
  doc.text(valStr, startX, afterTableY);

  y = afterTableY + 32;
  doc.setDrawColor(CYAN);
  doc.setLineWidth(1.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 48; // Extra breathing room before payment details

  // Payment Details
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(CYAN);
  doc.text("Payment Details:", margin, y);
  y += 22;

  const renderPaymentRow = (label: string, value: string, rowY: number) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(CYAN);
    doc.text(label, margin, rowY);
    doc.setTextColor(TEXT_MAIN);
    doc.text(value, margin + 85, rowY);
  };

  if (invoice.paymentMethod === "wise") {
    renderPaymentRow("Account Title:", "Muhammad Ehsan", y); y += 18;
    renderPaymentRow("Account Type:", "Deposit", y); y += 18;
    renderPaymentRow("Routing:", "084009519", y); y += 18;
    renderPaymentRow("Account #:", "725862270691556", y); y += 18;
    renderPaymentRow("Address:", "Wise US Inc, 108 W 13th St, Wilmington, DE, 19801", y); y += 18;
    renderPaymentRow("Swift/BIC:", "TRWIUS35XXX", y); y += 18;
  } else {
    renderPaymentRow("Account Title:", "ZIRIUM AI SMC PVT LTD", y); y += 18;
    renderPaymentRow("Account #:", "367138578", y); y += 18;
    renderPaymentRow("IBAN:", "PK18UNIL0109000367138578", y); y += 18;
    renderPaymentRow("Swift Code:", "UNILPKKA", y); y += 18;
    renderPaymentRow("Bank Name:", "UBL (United Bank Limited)", y); y += 18;
  }

  y += 24;

  // Notes Box
  if (invoice.notes) {
    doc.setDrawColor(CYAN);
    doc.setLineWidth(1.2);
    
    doc.setFont("times", "bold");
    doc.setFontSize(11);
    const titleStr = "Notes: ";
    const titleW = doc.getTextWidth(titleStr);
    
    doc.setFont("times", "italic");
    const lines = doc.splitTextToSize(invoice.notes, pageWidth - margin * 2 - 24 - titleW);
    const boxHeight = Math.max(34, lines.length * 16 + 20);
    
    // Check if it fits, else add page
    if (y + boxHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }

    // Draw border only (no fill)
    doc.rect(margin, y, pageWidth - margin * 2, boxHeight, "S");
    
    doc.setFont("times", "bold");
    doc.setTextColor(TEXT_MAIN);
    doc.text(titleStr, margin + 12, y + 22);
    
    doc.setFont("times", "italic");
    doc.setTextColor(TEXT_MUTED);
    doc.text(lines, margin + 12 + titleW, y + 22);
  }

  // --- Page 2: Standard Company Footer / Information ------------------------
  doc.addPage();
  
  let page2Y = margin;
  doc.setDrawColor(CYAN);
  doc.setLineWidth(1.5);
  doc.line(margin, page2Y, pageWidth - margin, page2Y);
  page2Y += 40;
  
  // Left side: Logo & Slogan
  const logoH2 = renderLogo(margin, page2Y, 120, 40);
  
  doc.setFont("helvetica", "italic");
  doc.setFontSize(11);
  doc.setTextColor(TEXT_MUTED);
  // Slogan directly beneath logo
  doc.text("From Element To Intelligence", margin, page2Y + logoH2 + 16);

  // Right side: Address
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(TEXT_MUTED);
  
  const addrRightX = pageWidth - margin;
  // Perfectly aligned with the top of the logo
  doc.text("Office E-29, 3rd Floor, GS Towers, Ring Road,", addrRightX, page2Y + 12, { align: "right" });
  doc.text("Adjacent Hayatabad Toll Plaza,", addrRightX, page2Y + 28, { align: "right" });
  doc.text("Peshawar, Pakistan – 25000", addrRightX, page2Y + 44, { align: "right" });

  doc.save(`${invoice.number}.pdf`);
}
