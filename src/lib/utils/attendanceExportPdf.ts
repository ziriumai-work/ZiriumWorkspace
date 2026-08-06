import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// Helper to load image as base64 data URL
async function getImageDataUrl(url: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width || 500;
      canvas.height = img.height || 500;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve("");
    img.src = url;
  });
}

function drawWatermark(doc: jsPDF, logoDataUrl: string) {
  if (!logoDataUrl) return;
  try {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const size = 300; // 300 pt
    const x = (pageWidth - size) / 2;
    const y = (pageHeight - size) / 2;
    doc.saveGraphicsState();
    doc.setGState(new (doc.GState as any)({ opacity: 0.07 }));
    doc.addImage(logoDataUrl, "PNG", x, y, size, size);
    doc.restoreGraphicsState();
  } catch (e) {
    console.error("Watermark error:", e);
  }
}

function drawSummaryCard(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  val: string,
  rgbColor: [number, number, number]
) {
  // Background card with rounded border
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(x, y, w, h, 8, 8, "FD");

  // Label
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(label.toUpperCase(), x + 12, y + 16);

  // Value
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(rgbColor[0], rgbColor[1], rgbColor[2]);
  doc.text(val, x + 12, y + 36);
}

export async function downloadAttendancePdf(
  exportData: {
    overall: {
      totalPresent: number;
      totalLate: number;
      totalAbsent: number;
      totalLeave: number;
      totalHoursWorked: string;
      totalDeductionDays: string;
    };
    monthReports: {
      monthStr: string;
      label: string;
      empRecords: {
        emp: any;
        summary: any;
        totalODHMinutes: number;
        rows: {
          date: string;
          dayName: string;
          status: string;
          checkIn: string;
          checkOut: string;
          hoursWorked: string;
          flags: string;
        }[];
      }[];
    }[];
  },
  selectedName: string,
  selectedMonths: string[],
  fileName: string
): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const usableWidth = pageWidth - margin * 2;

  const logoDataUrl = await getImageDataUrl("/logo.png");

  const watermarkedPages = new Set<number>();
  const ensurePageWatermark = () => {
    const pageNum = (doc.internal as any).getCurrentPageInfo().pageNumber;
    if (!watermarkedPages.has(pageNum)) {
      watermarkedPages.add(pageNum);
      drawWatermark(doc, logoDataUrl);
    }
  };
  ensurePageWatermark();

  // Title Block
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42);
  doc.text("ZiriumAI Attendance & Workspace Report", margin, 50);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Selected Employee(s): ${selectedName}   •   Period: ${selectedMonths.sort().join(", ")}`, margin, 68);
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin, 83);

  // Overall Integral Summary Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(51, 65, 85);
  doc.text("OVERALL INTEGRAL SUMMARY", margin, 112);

  // Draw 6 Summary Cards (2 rows of 3)
  const cardW = 162;
  const cardH = 48;
  const gapX = (usableWidth - cardW * 3) / 2;
  const gapY = 12;
  const cardsTopY = 122;

  drawSummaryCard(doc, margin, cardsTopY, cardW, cardH, "Present Days", `${exportData.overall.totalPresent}d`, [22, 163, 74]);
  drawSummaryCard(doc, margin + cardW + gapX, cardsTopY, cardW, cardH, "Late Days", `${exportData.overall.totalLate}d`, [217, 119, 6]);
  drawSummaryCard(doc, margin + (cardW + gapX) * 2, cardsTopY, cardW, cardH, "Absent Days", `${exportData.overall.totalAbsent}d`, [220, 38, 38]);

  const row2Y = cardsTopY + cardH + gapY;
  drawSummaryCard(doc, margin, row2Y, cardW, cardH, "Leaves Used", `${exportData.overall.totalLeave}d`, [147, 51, 234]);
  drawSummaryCard(doc, margin + cardW + gapX, row2Y, cardW, cardH, "Hours Worked", `${exportData.overall.totalHoursWorked}h`, [15, 23, 42]);
  drawSummaryCard(doc, margin + (cardW + gapX) * 2, row2Y, cardW, cardH, "Salary Deduction", `${exportData.overall.totalDeductionDays}d`, [220, 38, 38]);

  let currentY = row2Y + cardH + 28;

  // Render each Month Sheet Table
  for (const report of exportData.monthReports) {
    for (const empData of report.empRecords) {
      const isIntern = empData.emp.accessLevel === "intern";
      const empHeaderTitle = `EMPLOYEE: ${empData.emp.name} — ${isIntern ? "Intern" : "Employee"} (${empData.emp.department || "General"})   •   ${report.label.toUpperCase()}`;
      const odhHrs = Math.floor(Math.abs(empData.totalODHMinutes || 0) / 60);
      const odhMins = Math.abs(empData.totalODHMinutes || 0) % 60;
      const odhStr = `${odhHrs}h ${odhMins}m`;
      const empSubTitle = `Month Summary: Present: ${empData.summary.totalPresent}d | Late: ${empData.summary.totalLate}d | Absent: ${empData.summary.totalAbsent}d | ODH Shortfall: ${odhStr} | Salary Deduction: ${empData.summary.deductionDays}d`;

      // Check page space for header
      if (currentY > pageHeight - 120) {
        doc.addPage();
        ensurePageWatermark();
        currentY = margin;
      }

      // Draw employee banner
      doc.setFillColor(15, 23, 42);
      doc.roundedRect(margin, currentY, usableWidth, 24, 4, 4, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.text(empHeaderTitle, margin + 10, currentY + 15);

      // Draw sub banner
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, currentY + 24, usableWidth, 20, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);
      doc.text(empSubTitle, margin + 10, currentY + 38);

      const tableData = empData.rows.map((r) => [
        r.date,
        r.dayName,
        r.status,
        r.checkIn,
        r.checkOut,
        r.hoursWorked,
        r.flags === "None" ? "—" : r.flags,
      ]);

      autoTable(doc, {
        startY: currentY + 46,
        margin: { left: margin, right: margin },
        head: [["Date", "Day", "Status", "Check In", "Check Out", "Hours Worked", "Flags & Audit Trail"]],
        body: tableData,
        theme: "grid",
        styles: {
          font: "helvetica",
          fontSize: 8,
          cellPadding: 4,
          textColor: [31, 41, 55],
          lineColor: [226, 232, 240],
          lineWidth: 0.5,
          fillColor: false,
        },
        alternateRowStyles: {
          fillColor: false,
        },
        headStyles: {
          fillColor: [248, 250, 252],
          textColor: [71, 85, 105],
          fontStyle: "bold",
        },
        columnStyles: {
          0: { cellWidth: 62, fontStyle: "bold" },
          1: { cellWidth: 32 },
          2: { cellWidth: 64, fontStyle: "bold" },
          3: { cellWidth: 54 },
          4: { cellWidth: 54 },
          5: { cellWidth: 54, fontStyle: "bold" },
          6: { cellWidth: "auto" },
        },
        willDrawPage: () => {
          ensurePageWatermark();
        },
        didDrawPage: () => {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text(
            "© ZiriumAI — Workspace & Attendance System — Official Audit Report",
            pageWidth / 2,
            pageHeight - 20,
            { align: "center" }
          );
        },
      });

      currentY = (doc as any).lastAutoTable.finalY + 24;
    }
  }

  doc.save(fileName);
}
