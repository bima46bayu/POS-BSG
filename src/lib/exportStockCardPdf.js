// src/lib/exportStockCardPdf.js
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * PDF: Stock Card
 * Kolom: Date | Type | Doc No | Qty (±) | Bal Qty | Unit Cost | Total Cost (±) | Bal Cost
 * - Margin L/R 30pt
 * - Lebar kolom diatur agar muat A4 portrait
 */
export function exportStockCardPdf(payload) {
  const {
    company = "PT. BUANA SELARAS GLOBALINDO",
    productName = "-",
    sku = "-",
    period = {},
    summary,
    openingQty = 0,
    openingCost = 0,
    rows = [],
  } = payload || {};

  const fmtIDR = (n) =>
    Number(n || 0).toLocaleString("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
  const fmtNum = (n) => Number(n || 0).toLocaleString("id-ID");
  const fmtDate = (s) => {
    if (!s) return "-";
    const d = new Date(s);
    return isNaN(d) ? "-" : d.toLocaleDateString("id-ID");
  };

  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true }); // 595 x 842
  const marginX = 30;
  let y = 40;

  // Header
  doc.setFontSize(16);
  doc.text("Stock Card", marginX, y); y += 18;
  doc.setFontSize(12);
  doc.text(String(company), marginX, y); y += 18;

  // Meta
  doc.setFontSize(10);
  doc.text(`Product: ${productName}`, marginX, y); y += 14;
  doc.text(`SKU: ${sku}`, marginX, y); y += 14;
  doc.text(`Period: ${period?.from ?? "—"} s.d. ${period?.to ?? "—"}`, marginX, y); y += 16;

  // Summary ringkas
  autoTable(doc, {
    startY: y,
    styles: { fontSize: 9, cellPadding: 4, overflow: "linebreak" },
    theme: "grid",
    margin: { left: marginX, right: marginX },
    head: [[
      "Stock Beginning","Stock In (GR)","Stock Out","Stock Ending",
      "Cost Beginning","Cost In (GR)","Cost Out","Cost Ending"
    ]],
    body: [[
      fmtNum(summary?.stockBeginning ?? 0),
      fmtNum(summary?.stockIn ?? 0),
      fmtNum(summary?.stockOut ?? 0),
      fmtNum(summary?.stockEnding ?? 0),
      fmtIDR(summary?.costBeginning ?? 0),
      fmtIDR(summary?.costIn ?? 0),
      fmtIDR(summary?.costOut ?? 0),
      fmtIDR(summary?.costEnding ?? 0),
    ]],
    headStyles: { fillColor: [238,238,238], textColor: 0 },
  });
  y = doc.lastAutoTable.finalY + 14;

  // Detail
  const head = [
    "Date","Type","Doc No","Qty (±)","Bal Qty","Unit Cost","Total Cost (±)","Bal Cost"
  ];

  const body = rows.map((r) => {
    const qtySigned  = Number((r._display_qty ?? r._signed_qty) ?? 0);
    const costSigned = Number((r._display_cost ?? r._signed_cost) ?? 0);
    const balQty     = Number(r._unit_balance_after ?? 0);
    const balCost    = Number(r._cost_balance_after ?? 0);
    const unitCost   = Number(r._unit_cost ?? 0);
    const docNo      = (r._doc_no ?? "-") || "-";

    return [
      fmtDate(r._date),
      String(r._ref_type || "-").toUpperCase(),
      String(docNo),
      fmtNum(qtySigned),
      fmtNum(balQty),
      fmtIDR(unitCost),
      fmtIDR(costSigned),
      fmtIDR(balCost),
    ];
  });

  // Lebar kolom (A4 portrait: 595 - 2*30 = 535pt)
  // Total: 62 + 42 + 150 + 45 + 55 + 60 + 60 + 61 = 535
  autoTable(doc, {
    startY: y,
    styles: { fontSize: 8.5, cellPadding: 3, overflow: "linebreak", valign: "middle" },
    theme: "grid",
    margin: { left: marginX, right: marginX },
    tableWidth: 535,
    head: [head],
    body,
    headStyles: { fillColor: [238,238,238], textColor: 0 },
    columnStyles: {
      0: { cellWidth: 62 },  // Date
      1: { cellWidth: 42 },  // Type
      2: { cellWidth: 150 }, // Doc No (wrap)
      3: { cellWidth: 45, halign: "right" }, // Qty
      4: { cellWidth: 55, halign: "right" }, // Bal Qty
      5: { cellWidth: 60, halign: "right" }, // Unit Cost
      6: { cellWidth: 60, halign: "right" }, // Total Cost
      7: { cellWidth: 61, halign: "right" }, // Bal Cost
    },
    didDrawPage: () => {
      const pageH = doc.internal.pageSize.getHeight();
      doc.setFontSize(9);
      doc.text(
        `Criteria: ${period?.from ?? "—"} s.d. ${period?.to ?? "—"} • Opening Qty ${fmtNum(openingQty)} • Opening Cost ${fmtIDR(openingCost)}`,
        marginX, pageH - 20
      );
    },
  });

  const safeSku = (sku || productName || "product").replace(/[^a-z0-9_-]+/gi, "-");
  const fname = `${safeSku}_stock-card_${period?.from || "start"}_${period?.to || "end"}.pdf`;
  doc.save(fname);
}
