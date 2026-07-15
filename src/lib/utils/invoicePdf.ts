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
      doc.addImage(logoDataUrl, "PNG", x, y - h / 2, w, h);
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(TEXT_MAIN);
      doc.text("ZIRIUM AI", x, y);
    }
  };

  // --- Page 1 ---------------------------------------------------------------
  
  // Header Bar
  doc.setFillColor(CYAN);
  doc.rect(0, 0, pageWidth, 16, "F");

  // Top Section: Logo & INVOICE title
  let y = 60;
  renderLogo(margin, y - 8, 110, 36);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(CYAN);
  doc.text("INVOICE", pageWidth - margin, y, { align: "right" });

  y += 24;

  const created = invoice.createdAt?.toDate() ?? new Date();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(TEXT_MUTED);
  doc.text(`Invoice No: ${invoice.number}`, pageWidth - margin, y, { align: "right" });
  y += 14;
  doc.text(
    `Date: ${created.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    })}`,
    pageWidth - margin,
    y,
    { align: "right" }
  );

  y += 20;
  // Cyan rule
  doc.setDrawColor(CYAN);
  doc.setLineWidth(1.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 24;

  // Bill To & From
  const splitY = y;
  
  // Bill To (Left)
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(CYAN);
  doc.text("Bill To:", margin, y);
  y += 14;
  
  doc.setFont("helvetica", "bold");
  doc.setTextColor(TEXT_MAIN);
  doc.text(invoice.clientName || "—", margin, y);
  y += 14;
  
  doc.setFont("helvetica", "normal");
  doc.setTextColor(TEXT_MUTED);
  if (invoice.clientCompany) {
    doc.text(invoice.clientCompany, margin, y);
    y += 14;
  }
  if (invoice.clientAddress) {
    const lines = doc.splitTextToSize(invoice.clientAddress, (pageWidth / 2) - margin - 20);
    doc.text(lines, margin, y);
    y += lines.length * 14;
  }

  // From (Right)
  let rightY = splitY;
  const rightX = pageWidth / 2 + 20;
  
  doc.setFont("helvetica", "bold");
  doc.setTextColor(CYAN);
  doc.text("From:", rightX, rightY);
  rightY += 14;

  doc.setFont("helvetica", "bold");
  doc.setTextColor(TEXT_MAIN);
  doc.text("ZIRIUM AI SMC PVT LTD", rightX, rightY);
  rightY += 14;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(TEXT_MUTED);
  doc.text("Office E-29, 3rd Floor, GS Towers,", rightX, rightY);
  rightY += 14;
  doc.text("Ring Road, Adjacent Hayatabad Toll Plaza,", rightX, rightY);
  rightY += 14;
  doc.text("Peshawar, Pakistan — 25000", rightX, rightY);
  rightY += 14;
  doc.text("NTN: I979681-4", rightX, rightY);
  
  y = Math.max(y, rightY) + 24;

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
    styles: { font: "helvetica", fontSize: 10, cellPadding: 8, textColor: TEXT_MAIN },
    headStyles: { fillColor: CYAN, textColor: "#ffffff", fontStyle: "bold" },
    columnStyles: {
      1: { cellWidth: 70, halign: "center" },
      2: { cellWidth: 100, halign: "right" },
    },
  });

  const afterTableY = (doc as any).lastAutoTable.finalY + 24;

  // Amount Due
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(CYAN);
  doc.text(`Amount Due: ${money(total, invoice.currency)}`, pageWidth - margin, afterTableY, { align: "right" });

  y = afterTableY + 24;
  doc.setDrawColor(CYAN);
  doc.setLineWidth(1.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 24;

  // Payment Details
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(CYAN);
  doc.text("Payment Details:", margin, y);
  y += 18;

  const renderPaymentRow = (label: string, value: string, rowY: number) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(CYAN);
    doc.text(label, margin, rowY);
    doc.setTextColor(TEXT_MAIN);
    doc.text(value, margin + 80, rowY);
  };

  if (invoice.paymentMethod === "wise") {
    renderPaymentRow("Account Title:", "Muhammad Ehsan", y); y += 14;
    renderPaymentRow("Account Type:", "Deposit", y); y += 14;
    renderPaymentRow("Routing:", "084009519", y); y += 14;
    renderPaymentRow("Account #:", "725862270691556", y); y += 14;
    renderPaymentRow("Address:", "Wise US Inc, 108 W 13th St, Wilmington, DE, 19801, United States", y); y += 14;
    renderPaymentRow("Swift/BIC:", "TRWIUS35XXX", y); y += 14;
  } else {
    renderPaymentRow("Account Title:", "ZIRIUM AI SMC PVT LTD", y); y += 14;
    renderPaymentRow("Account #:", "367138578", y); y += 14;
    renderPaymentRow("IBAN:", "PK18UNIL0109000367138578", y); y += 14;
    renderPaymentRow("Swift Code:", "UNILPKKA", y); y += 14;
    renderPaymentRow("Bank Name:", "UBL (United Bank Limited)", y); y += 14;
  }

  y += 16;

  // Notes Box
  if (invoice.notes) {
    doc.setDrawColor(CYAN);
    doc.setLineWidth(1);
    const lines = doc.splitTextToSize(`Note: ${invoice.notes}`, pageWidth - margin * 2 - 20);
    const boxHeight = lines.length * 14 + 16;
    
    // Check if it fits, else add page
    if (y + boxHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }

    // Draw border only (no fill)
    doc.rect(margin, y, pageWidth - margin * 2, boxHeight, "S");
    
    doc.setFontSize(10);
    doc.setTextColor(TEXT_MAIN);
    doc.text(lines, margin + 10, y + 16);
  }

  // --- Page 2: Standard Company Footer / Information ------------------------
  doc.addPage();
  
  let page2Y = margin;
  doc.setDrawColor(CYAN);
  doc.setLineWidth(1.5);
  doc.line(margin, page2Y, pageWidth - margin, page2Y);
  page2Y += 40;
  
  // Left side: Logo & Slogan
  renderLogo(margin, page2Y + 8, 80, 26);
  
  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  doc.setTextColor(TEXT_MUTED);
  doc.text("From Element To Intelligence", margin, page2Y + 36);

  // Right side: Address
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(TEXT_MUTED);
  
  const addrRightX = pageWidth - margin;
  doc.text("Office E-29, 3rd Floor, GS Towers, Ring Road,", addrRightX, page2Y, { align: "right" });
  doc.text("Adjacent Hayatabad Toll Plaza,", addrRightX, page2Y + 14, { align: "right" });
  doc.text("Peshawar, Pakistan – 25000", addrRightX, page2Y + 28, { align: "right" });

  doc.save(`${invoice.number}.pdf`);
}
