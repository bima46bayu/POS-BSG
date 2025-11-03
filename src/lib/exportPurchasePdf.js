// src/lib/exportPurchasePdf.js
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export async function exportPurchasePdf({
  logoUrl = "/images/LogoBSG.png",
  company = {
    name: "PT. BUANA SELARAS GLOBALINDO",
    address:
      "TamanTekno BSD City Sektor XI\nBlok A2 No. 56, Setu, Tangerang Selatan 15314",
    phone: "Tel. +62 21 7567217/270 (hunting)",
    fax: "Fax. +62 21 22765431",
  },
  po = {},
  items = [],
  metaRight = {},
  printedBy = "Purchasing",
  totalsTopSpacing = 30,
  titleTopOffset = 24,
  addressMaxLines = 3,
  headerMaxWidthRatio = 0.5, // batasi max lebar teks header (setengah kertas)
} = {}) {
  const safe = (v, d = "-") => (v == null || v === "" ? d : String(v));
  const fmtIDR = (n) =>
    Number(n || 0).toLocaleString("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    });
  const fmtNum = (n) => Number(n || 0).toLocaleString("id-ID");
  const fmtDate = (s) => {
    if (!s) return "-";
    const d = new Date(s);
    if (isNaN(d)) return safe(s);
    return d.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  async function loadImage(url) {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = url;
      await new Promise((res, rej) => {
        img.onload = () => res(true);
        img.onerror = rej;
      });
      return img;
    } catch {
      return null;
    }
  }

  // ====== data
  const poNo = safe(po.purchase_number || po.po_no, "PO-XXXX");
  const poDate = fmtDate(po.order_date || po.date);
  const supplier = po?.supplier || {};

  const subtotal = Number(
    po?.subtotal ?? items.reduce((s, it) => s + Number(it.line_total || 0), 0)
  );
  const discount = Number(po?.discount_total || 0);
  const vat = Number(po?.tax_total || 0);
  const grandTotal = Number(po?.grand_total || subtotal - discount + vat);

  const rightMeta = {
    no: poNo,
    date: poDate,
    projectRef: metaRight.projectRef || po?.project_ref || "-",
    purreqNo: metaRight.purreqNo || po?.purreq_no || po?.rq_no || "-",
    revision: metaRight.revision || po?.revision || "-",
    currency: "IDR RUPIAH",
  };

  // ====== PDF base
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true }); // 595x842
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 36;
  const contentW = pageW - M * 2; // 523
  const gap = 14;

  // helpers
  function writeWrap(
    text,
    x,
    startY,
    maxW,
    lineH,
    { fontStyle = "normal", fontSize = 9.5, maxLines = null } = {}
  ) {
    if (!text) return startY;
    doc.setFont(undefined, fontStyle);
    doc.setFontSize(fontSize);
    let lines = doc.splitTextToSize(String(text), maxW);
    if (maxLines && lines.length > maxLines) {
      lines = [
        ...lines.slice(0, maxLines - 1),
        lines[maxLines - 1].replace(/\s+$/, "") + " …",
      ];
    }
    let yy = startY;
    for (const ln of lines) {
      doc.text(ln, x, yy);
      yy += lineH;
    }
    return yy;
  }

  function measureWrapHeight(
    text,
    maxW,
    lineH,
    fontSize = 9.5,
    maxLines = null,
    fontStyle = "normal"
  ) {
    if (!text) return 0;
    doc.setFont(undefined, fontStyle);
    doc.setFontSize(fontSize);
    let lines = doc.splitTextToSize(String(text), maxW);
    if (maxLines && lines.length > maxLines) lines = lines.slice(0, maxLines);
    return lines.length * lineH;
  }

  // ====== HEADER: logo menyesuaikan tinggi teks, teks dibatasi setengah kertas
  let y = 26;
  const headerLogo =
    (await loadImage(logoUrl)) ||
    (await loadImage("/image/logo.png")) ||
    (await loadImage("/image/logo.jpg")) ||
    (await loadImage("/image/logo.webp"));

  // ukur tinggi blok teks agar logo proporsional
  const headerTextMaxW = contentW * (headerMaxWidthRatio || 0.5);
  const nameH = measureWrapHeight(safe(company?.name), headerTextMaxW, 12, 10.5, null, "bold");
  const addrH = measureWrapHeight(safe(company?.address), headerTextMaxW, 12.2, 9.5, addressMaxLines);
  const telH  = measureWrapHeight(safe(company?.phone), headerTextMaxW, 12.2, 9.5);
  const faxH  = company?.fax ? measureWrapHeight(company.fax, headerTextMaxW, 12.2, 9.5) : 0;
  const textBlockH = Math.max(28, nameH + addrH + telH + faxH);

  // logo
  let logoW = 0, logoH = 0;
  if (headerLogo) {
    const ratio = headerLogo.width / (headerLogo.height || 1);
    const maxH = 72, minH = 28;
    logoH = Math.max(minH, Math.min(textBlockH, maxH));
    logoW = logoH * ratio;
    const maxW = 80;
    if (logoW > maxW) { logoW = maxW; logoH = logoW / ratio; }
    const logoY = y + (textBlockH - logoH) / 2;
    doc.addImage(headerLogo, "PNG", M, logoY, logoW, logoH);
  }

  // teks header (wrap, max setengah kertas)
  const headerX = M + (logoW ? logoW + 10 : 0);
  const headerTextW = Math.min(headerTextMaxW, pageW - M - headerX);
  let hy = y + 11;
  doc.setTextColor(40);
  hy = writeWrap(safe(company?.name), headerX, hy, headerTextW, 12, {
    fontStyle: "bold",
    fontSize: 10.5,
  });
  hy = writeWrap(safe(company?.address), headerX, hy, headerTextW, 12.2, {
    maxLines: addressMaxLines,
  });
  hy = writeWrap(safe(company?.phone), headerX, hy, headerTextW, 12.2);
  if (company?.fax) hy = writeWrap(company.fax, headerX, hy, headerTextW, 12.2);

  // lanjut
  y = Math.max(y + textBlockH, y + logoH) + 8 + (titleTopOffset || 0);

  // ====== TITLE
  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.setFont(undefined, "bold");
  doc.text("PURCHASE ORDER", pageW / 2, y + 6, { align: "center" });
  doc.setFont(undefined, "normal");
  y += 20;

  // ====== DUA KOLOM (LEFT supplier, RIGHT meta)
  const leftW = (contentW - gap) * 0.55;
  const rightW = (contentW - gap) * 0.45;

  // LEFT — supplier (tanpa “we would like…” — dipindah ke atas tabel)
  const leftLines = [
    "To :",
    safe(supplier.name),
    safe(supplier.address),
    supplier.phone ? `Phone: ${supplier.phone}` : null,
    supplier.email ? `Email: ${supplier.email}` : null,
    supplier.pic_name ? `Attn: ${supplier.pic_name}` : null,
  ].filter(Boolean);

  doc.setFontSize(10);
  const lh = 12.8;
  let sy = y + 2;
  leftLines.forEach((line) => {
    doc.splitTextToSize(line, leftW).forEach((ln) => {
      doc.text(ln, M, sy);
      sy += lh;
    });
  });
  const leftEnd = sy;

  // RIGHT — meta
  const metaRows = [
    ["No.", rightMeta.no],
    ["Date", rightMeta.date],
    ["Project Ref", rightMeta.projectRef],
    ["Purreq No", rightMeta.purreqNo],
    ["Revision", rightMeta.revision],
    ["Currency", rightMeta.currency],
  ];
  autoTable(doc, {
    startY: y,
    theme: "plain",
    margin: { left: M + leftW + gap, right: M },
    tableWidth: rightW,
    styles: { fontSize: 10, cellPadding: { top: 1.6, bottom: 1.3, left: 2, right: 2 } },
    body: metaRows.map(([k, v]) => [
      { content: `${k} :`, styles: { fontStyle: "bold" } },
      { content: String(v) },
    ]),
    columnStyles: {
      0: { cellWidth: Math.floor(rightW * 0.42) },
      1: { cellWidth: Math.ceil(rightW * 0.58) },
    },
  });
  const rightEnd = doc.lastAutoTable?.finalY || y;
  y = Math.max(leftEnd, rightEnd) + 10;

  // ====== KALIMAT PENGANTAR TEPAT DI ATAS TABEL
  doc.setFontSize(10);
  doc.setTextColor(70);
  doc.setFont(undefined, "italic");
  const intro = "We would like to order below item to your company";
  y = writeWrap(intro, M, y, contentW, 12);
  doc.setFont(undefined, "normal");
  doc.setTextColor(0);
  y += 6; // spasi kecil sebelum tabel

  // ====== TABEL ITEMS (redesain)
  // total kolom = 523: 30 + 245 + 50 + 60 + 60 + 78 = 523
  const CW = { no: 30, desc: 245, unit: 50, qty: 60, unitPrice: 60, total: 78 };

  const head = [["No.", "Description", "Unit", "Quantity", "Unit Price", "Total Price"]];
  const body = (Array.isArray(items) ? items : []).map((it, i) => [
    String(i + 1),
    String(it.name ?? it.product_label ?? `#${it.product_id || ""}`),
    String(it.unit || it.uom || "Unit"),
    fmtNum(it.qty_order),
    fmtIDR(it.unit_price),
    fmtIDR(it.line_total),
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    tableWidth: contentW,
    theme: "grid",
    head,
    body: body.length ? body : [["", "—", "", "", "", ""]],
    styles: {
      fontSize: 10,
      cellPadding: { top: 4, bottom: 3.6, left: 5, right: 5 },
      lineWidth: 0.4,
      lineColor: [205, 205, 205],
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      fillColor: [242, 242, 242],
      textColor: 0,
      fontStyle: "bold",
      lineWidth: 0.7,              // header border sedikit lebih tebal
      lineColor: [180, 180, 180],
    },
    alternateRowStyles: { fillColor: [249, 249, 249] }, // striping lembut
    columnStyles: {
      0: { cellWidth: CW.no,   halign: "center" },
      1: { cellWidth: CW.desc },
      2: { cellWidth: CW.unit, halign: "center" },
      3: { cellWidth: CW.qty,  halign: "right"  },
      4: { cellWidth: CW.unitPrice, halign: "right" },
      5: { cellWidth: CW.total,     halign: "right" },
    },
  });

  y = (doc.lastAutoTable?.finalY || y) + totalsTopSpacing;

  // ====== TOTALS (tanpa border, kanan)
  const rightX = M + leftW + gap;
  const lineH = 13.8;
  const totals = [
    ["Sub Total :", fmtIDR(subtotal)],
    ["Discount :", fmtIDR(discount)],
    ["VAT :", fmtIDR(vat)],
    ["Total :", fmtIDR(grandTotal)],
  ];
  doc.setFontSize(10);
  totals.forEach(([label, val], i) => {
    const ty = y + i * lineH;
    doc.text(label, rightX, ty);
    doc.text(val, rightX + rightW - 8, ty, { align: "right" });
  });
  y += totals.length * lineH + 22;

  // ====== TANDA TANGAN
  const sigW = (pageW - M * 2) / 4;
  const sigTitles = ["Prepared by,", "Checked by,", "Approved by,", "Confirmed by,"];
  const sigRoles = ["Purchasing", "GM Operational", "Director", "Vendor"];

  doc.setFontSize(10);
  for (let i = 0; i < 4; i++) doc.text(sigTitles[i], M + i * sigW + 6, y);

  const sigHeight = 58;
  y += sigHeight;
  doc.setLineWidth(0.6);
  for (let i = 0; i < 4; i++) {
    const x = M + i * sigW + 6;
    doc.line(x, y, x + sigW - 20, y);
  }
  y += 12;
  doc.setFontSize(9);
  for (let i = 0; i < 4; i++) doc.text(sigRoles[i], M + i * sigW + 6, y);

  // ====== FOOTER
  doc.setFontSize(8.5);
  doc.setTextColor(90);
  const pageCount = doc.getNumberOfPages();
  doc.text(
    `Page 1 of ${pageCount}    Printed by ${printedBy}`,
    pageW - M,
    pageH - 16,
    { align: "right" }
  );

  doc.save(`${poNo}.pdf`);
}
