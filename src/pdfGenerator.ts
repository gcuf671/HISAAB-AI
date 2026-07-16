import { jsPDF } from "jspdf";
import { MonthlyCalculation, Expense, Resident } from "./types";
import { formatCurrency, parseMonthId } from "./utils";

export function generateMonthlyPDF(
  monthId: string,
  calculation: MonthlyCalculation,
  expenses: Expense[],
  residents: Resident[]
) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const { year, month } = parseMonthId(monthId);
  const monthName = new Date(year, month, 1).toLocaleString("en-US", {
    month: "long",
  });
  const billingPeriod = `${monthName} ${year}`;
  const generatedOn = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const pageHeight = 297;
  const pageWidth = 210;
  let y = 15;

  // Helper: Draw page header
  const drawPageHeader = (pageNumber: number) => {
    // Top colored bar
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(0, 0, pageWidth, 8, "F");

    // Title & Brand
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59);
    doc.text("Apartment Expense Splitter", 15, 20);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text("MONTHLY SETTLEMENT & BILLING REPORT", 15, 25);

    // Month details on the right
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text(billingPeriod.toUpperCase(), pageWidth - 15, 20, { align: "right" });

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(`Generated on: ${generatedOn}`, pageWidth - 15, 25, { align: "right" });

    // Thin accent line
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.5);
    doc.line(15, 28, pageWidth - 15, 28);
  };

  // Helper: Draw footer
  const drawFooter = (pageNumber: number) => {
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(
      "Generated via Apartment Expense Splitter. Fair and transparent living.",
      15,
      pageHeight - 10
    );
    doc.text(
      `Page ${pageNumber}`,
      pageWidth - 15,
      pageHeight - 10,
      { align: "right" }
    );
  };

  // Initialize first page
  drawPageHeader(1);
  y = 36;

  // 1. Overview Cards (3 boxes)
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(241, 245, 249); // slate-100
  doc.setLineWidth(0.3);

  // Box dimensions
  const boxW = 56;
  const boxH = 22;
  const boxGap = 6;
  const startX = 15;

  // Card 1: Total Grocery Expenses
  doc.roundedRect(startX, y, boxW, boxH, 2, 2, "FD");
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text("TOTAL GROCERIES", startX + 5, y + 6);
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(formatCurrency(calculation.totalExpenses), startX + 5, y + 14);

  // Card 2: Total Resident-Days
  const x2 = startX + boxW + boxGap;
  doc.roundedRect(x2, y, boxW, boxH, 2, 2, "FD");
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("TOTAL RESIDENT-DAYS", x2 + 5, y + 6);
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(`${calculation.totalDays} days`, x2 + 5, y + 14);

  // Card 3: Cost Per Day
  const x3 = x2 + boxW + boxGap;
  doc.roundedRect(x3, y, boxW, boxH, 2, 2, "FD");
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("RATE PER RESIDENT-DAY", x3 + 5, y + 6);
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(30, 41, 59);
  doc.text(`${formatCurrency(calculation.costPerDay)} / day`, x3 + 5, y + 14);

  y += boxH + 10;

  // 2. Flatmates Settlement Table
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text("Flatmate Cost Distribution & Balances", 15, y);
  y += 5;

  // Table Header
  doc.setFillColor(241, 245, 249); // slate-100
  doc.rect(15, y, pageWidth - 30, 8, "F");
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105); // slate-600

  doc.text("Flatmate Name", 18, y + 5.5);
  doc.text("Days Lived", 70, y + 5.5, { align: "right" });
  doc.text("Amount Paid", 100, y + 5.5, { align: "right" });
  doc.text("Fair Share", 135, y + 5.5, { align: "right" });
  doc.text("Net Balance", 185, y + 5.5, { align: "right" });

  y += 8;

  // Table Rows
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(9);

  calculation.summaries.forEach((summary) => {
    // Row separator
    doc.setDrawColor(241, 245, 249);
    doc.line(15, y, pageWidth - 15, y);

    // Text cells
    doc.setTextColor(15, 23, 42);
    doc.setFont("Helvetica", "bold");
    doc.text(summary.name, 18, y + 6);

    doc.setFont("Helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    doc.text(`${summary.daysLived} days`, 70, y + 6, { align: "right" });
    doc.text(formatCurrency(summary.amountPaid), 100, y + 6, { align: "right" });
    doc.text(formatCurrency(summary.share), 135, y + 6, { align: "right" });

    // Color code balance (Green for Owed / credit, Crimson for Owe / debit)
    if (summary.balance > 0.005) {
      doc.setTextColor(16, 185, 129); // emerald-500
      doc.setFont("Helvetica", "bold");
      doc.text(`+${formatCurrency(summary.balance)} (Owed)`, 185, y + 6, {
        align: "right",
      });
    } else if (summary.balance < -0.005) {
      doc.setTextColor(239, 68, 68); // red-500
      doc.setFont("Helvetica", "bold");
      doc.text(`${formatCurrency(summary.balance)} (Owes)`, 185, y + 6, {
        align: "right",
      });
    } else {
      doc.setTextColor(100, 116, 139); // slate-500
      doc.setFont("Helvetica", "normal");
      doc.text("Settled ($0.00)", 185, y + 6, { align: "right" });
    }

    y += 9;
  });

  // Closing table line
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.line(15, y, pageWidth - 15, y);

  y += 10;

  // 3. Settlement Instructions Section
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text("Settle Up Payments", 15, y);
  y += 5;

  if (calculation.settlements.length === 0) {
    doc.setFillColor(240, 253, 250); // emerald-50
    doc.setDrawColor(204, 251, 241); // emerald-100
    doc.roundedRect(15, y, pageWidth - 30, 15, 2, 2, "FD");

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(13, 148, 136); // emerald-600
    doc.text(
      "No transfers needed. All grocery expenses are split perfectly evenly!",
      20,
      y + 9
    );
    y += 20;
  } else {
    // Draw settlement cards
    calculation.settlements.forEach((settlement) => {
      doc.setFillColor(254, 242, 242); // red-50
      doc.setDrawColor(254, 226, 226); // red-100
      doc.roundedRect(15, y, pageWidth - 30, 11, 1.5, 1.5, "FD");

      // Transaction text
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(185, 28, 28); // red-700
      doc.text(settlement.fromName, 20, y + 7);

      doc.setFont("Helvetica", "normal");
      doc.setTextColor(127, 29, 29); // red-900
      doc.text(" pays ", doc.getTextWidth(settlement.fromName) + 22, y + 7);

      const offset2 = doc.getTextWidth(settlement.fromName) + 22 + doc.getTextWidth(" pays ");
      doc.setFont("Helvetica", "bold");
      doc.setTextColor(21, 128, 61); // green-700
      doc.text(formatCurrency(settlement.amount), offset2, y + 7);

      const offset3 = offset2 + doc.getTextWidth(formatCurrency(settlement.amount)) + 2;
      doc.setFont("Helvetica", "normal");
      doc.setTextColor(127, 29, 29);
      doc.text(" to ", offset3, y + 7);

      const offset4 = offset3 + doc.getTextWidth(" to ") + 1;
      doc.setFont("Helvetica", "bold");
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text(settlement.toName, offset4, y + 7);

      y += 14;
    });
  }

  // 4. Grocery Expenses Ledger Section
  // Check if we need to add a page for the ledger
  const monthlyExpenses = expenses.filter((e) => e.monthId === monthId);

  if (y + 40 > pageHeight - 20) {
    // Add page footer to page 1
    drawFooter(1);
    doc.addPage();
    drawPageHeader(2);
    y = 36;
  }

  doc.setFont("Helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text("Grocery Expenses Ledger", 15, y);
  y += 5;

  if (monthlyExpenses.length === 0) {
    doc.setFont("Helvetica", "italic");
    doc.setFontSize(9.5);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text("No grocery expenses logged for this month.", 15, y + 5);
    y += 15;
  } else {
    // Ledger Header
    doc.setFillColor(248, 250, 252); // slate-50
    doc.rect(15, y, pageWidth - 30, 7, "F");
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139); // slate-500

    doc.text("Date", 18, y + 4.5);
    doc.text("Description", 45, y + 4.5);
    doc.text("Paid By", 125, y + 4.5);
    doc.text("Amount", 185, y + 4.5, { align: "right" });

    y += 7;

    // Ledger Rows
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8.5);

    monthlyExpenses.forEach((expense) => {
      // Check if page overflow
      if (y > pageHeight - 25) {
        drawFooter(doc.getNumberOfPages());
        doc.addPage();
        drawPageHeader(doc.getNumberOfPages());
        y = 36;

        // Redraw Header
        doc.setFillColor(248, 250, 252);
        doc.rect(15, y, pageWidth - 30, 7, "F");
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text("Date", 18, y + 4.5);
        doc.text("Description", 45, y + 4.5);
        doc.text("Paid By", 125, y + 4.5);
        doc.text("Amount", 185, y + 4.5, { align: "right" });
        y += 7;
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(8.5);
      }

      doc.setDrawColor(248, 250, 252);
      doc.line(15, y, pageWidth - 15, y);

      doc.setTextColor(100, 116, 139);
      doc.text(expense.date, 18, y + 5.5);

      doc.setTextColor(15, 23, 42);
      doc.setFont("Helvetica", "medium");
      doc.text(expense.description, 45, y + 5.5);

      // Look up payer name
      const payerName =
        residents.find((r) => r.id === expense.payerId)?.name || "Unknown";
      doc.setTextColor(71, 85, 105);
      doc.setFont("Helvetica", "normal");
      doc.text(payerName, 125, y + 5.5);

      doc.setTextColor(15, 23, 42);
      doc.setFont("Helvetica", "bold");
      doc.text(formatCurrency(expense.amount), 185, y + 5.5, {
        align: "right",
      });

      y += 8;
    });

    // End of list line
    doc.setDrawColor(226, 232, 240);
    doc.line(15, y, pageWidth - 15, y);
  }

  // Draw final footer
  drawFooter(doc.getNumberOfPages());

  // Save the PDF
  doc.save(`Apartment_Groceries_${monthId}.pdf`);
}
