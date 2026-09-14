// src/lib/exportGoodsReceiptPdf.js
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { IDR as fmtIDR } from "./fmt";

export async function exportGoodsReceiptPdf({
  logoUrl = "/images/LogoBSG.png",
  company = {
    name: "PT. BUANA SELARAS GLOBALINDO",
    address:
      "TamanTekno BSD City Sektor XI\nBlok A2 No. 56, Setu, Tangerang Selatan 15314",
    phone: "Tel. +62 21 7567217/270 (hunting)",
    fax: "Fax. +62 21 22765431",
  },
  receipt = {},
  purchase = {},
  items = [],
  printedBy = "Warehouse",
  totalsTopSpacing = 30,
  titleTopOffset = 24,
  addressMaxLines = 3,
  headerMaxWidthRatio = 0.5,
} = {}) {
  const safe = (v, d = "-") => (v == null || v === "" ? d : String(v));
  const fmtNum = (n) => Number(n || 0).toLocaleString("id-ID");
  const fmtDate = (s) => {
    if (!s) return "-";
    const raw = String(s);
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
    }
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return safe(s);
    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  };

  const toAbs = (url) => {
    try {
      if (/^https?:\/\//i.test(url)) return url;
      const base = typeof window !== "undefined" ? window.location.origin : "";
      return url.startsWith("/") ? base + url : base + "/" + url;
    } catch {
      return url;
    }
  };

  async function loadImage(url) {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.decoding = "async";
      img.src = toAbs(url);
      await new Promise((res, rej) => {
        img.onload = () => res(true);
        img.onerror = rej;
      });
      return img;
    } catch {
      return null;
    }
  }

  function flattenToPNG(img, bg = "#ffffff") {
    const w = Math.max(1, img.naturalWidth || img.width || 1);
    const h = Math.max(1, img.naturalHeight || img.height || 1);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { colorSpace: "srgb", willReadFrequently: false });
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/png");
  }

  const grNo = safe(receipt.gr_number || receipt.gr_no, "GR-XXXX");
  const grDate = fmtDate(receipt.received_date || receipt.date);
  const poNo = safe(
    purchase.purchase_number || receipt.purchase?.purchase_number || receipt.po_no,
    "-"
  );
  const supplier = purchase?.supplier || receipt.purchase?.supplier || {};
  const status = safe(receipt.status, "posted");

  const mapped = (Array.isArray(items) ? items : []).map((it) => {
    const qty = Number(it.qty_received ?? it.qty ?? 0);
    const price = Number(it.unit_price ?? it.purchase_item?.unit_price ?? 0);
    return {
      name:
        it.name ??
        it.product_label ??
        it.purchase_item?.product?.name ??
        `#${it.product_id || it.purchase_item_id || ""}`,
      unit:
        it.unit ||
        it.uom ||
        it.purchase_item?.product?.unit?.name ||
        it.purchase_item?.product?.unit_name ||
        "Unit",
      qty,
      unit_price: price,
      line_total: Number(it.line_total ?? qty * price),
    };
  });

  const subtotal = mapped.reduce((s, it) => s + Number(it.line_total || 0), 0);

  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 36;
  const contentW = pageW - M * 2;
  const gap = 14;

  function writeWrap(text, x, startY, maxW, lineH, { fontStyle = "normal", fontSize = 9.5, maxLines = null } = {}) {
    if (!text) return startY;
    doc.setFont(undefined, fontStyle);
    doc.setFontSize(fontSize);
    let lines = doc.splitTextToSize(String(text), maxW);
    if (maxLines && lines.length > maxLines) {
      lines = [...lines.slice(0, maxLines - 1), lines[maxLines - 1].replace(/\s+$/, "") + " …"];
    }
    let yy = startY;
    for (const ln of lines) {
      doc.text(ln, x, yy);
      yy += lineH;
    }
    return yy;
  }

  function measureWrapHeight(text, maxW, lineH, fontSize = 9.5, maxLines = null, fontStyle = "normal") {
    if (!text) return 0;
    doc.setFont(undefined, fontStyle);
    doc.setFontSize(fontSize);
    let lines = doc.splitTextToSize(String(text), maxW);
    if (maxLines && lines.length > maxLines) lines = lines.slice(0, maxLines);
    return lines.length * lineH;
  }

  let y = 26;

  let rawLogo =
    (await loadImage(logoUrl)) ||
    (await loadImage("/image/logo.png")) ||
    (await loadImage("/image/logo.jpg")) ||
    (await loadImage("/image/logo.webp"));

  let logoDataUrl = null;
  if (rawLogo) logoDataUrl = flattenToPNG(rawLogo, "#ffffff");

  const headerTextMaxW = contentW * (headerMaxWidthRatio || 0.5);
  const nameH = measureWrapHeight(safe(company?.name), headerTextMaxW, 12, 10.5, null, "bold");
  const addrH = measureWrapHeight(safe(company?.address), headerTextMaxW, 12.2, 9.5, addressMaxLines);
  const telH = measureWrapHeight(safe(company?.phone), headerTextMaxW, 12.2, 9.5);
  const faxH = company?.fax ? measureWrapHeight(company.fax, headerTextMaxW, 12.2, 9.5) : 0;
  const textBlockH = Math.max(28, nameH + addrH + telH + faxH);

  let logoW = 0,
    logoH = 0;
  if (rawLogo && logoDataUrl) {
    const ratio = rawLogo.width / (rawLogo.height || 1);
    const maxH = 72,
      minH = 28;
    logoH = Math.max(minH, Math.min(textBlockH, maxH));
    logoW = logoH * ratio;
    const maxW = 80;
    if (logoW > maxW) {
      logoW = maxW;
      logoH = logoW / ratio;
    }
    const logoY = y + (textBlockH - logoH) / 2;
    doc.setFillColor(255, 255, 255);
    doc.rect(M, logoY, logoW, logoH, "F");
    doc.addImage(logoDataUrl, "PNG", M, logoY, logoW, logoH);
  }

  const headerX = M + (logoW ? logoW + 10 : 0);
  const headerTextW = Math.min(headerTextMaxW, pageW - M - headerX);
  let hy = y + 11;
  doc.setTextColor(40);
  hy = writeWrap(safe(company?.name), headerX, hy, headerTextW, 12, { fontStyle: "bold", fontSize: 10.5 });
  hy = writeWrap(safe(company?.address), headerX, hy, headerTextW, 12.2, { maxLines: addressMaxLines });
  hy = writeWrap(safe(company?.phone), headerX, hy, headerTextW, 12.2);
  if (company?.fax) hy = writeWrap(company.fax, headerX, hy, headerTextW, 12.2);

  y = Math.max(y + textBlockH, y + logoH) + 8 + (titleTopOffset || 0);

  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.setFont(undefined, "bold");
  doc.text("GOODS RECEIPT", pageW / 2, y + 6, { align: "center" });
  doc.setFont(undefined, "normal");
  y += 20;

  const leftW = (contentW - gap) * 0.55;
  const rightW = (contentW - gap) * 0.45;

  const leftLines = [
    "From :",
    safe(supplier.name || supplier.company),
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

  const metaRows = [
    ["No.", grNo],
    ["Date", grDate],
    ["PO No", poNo],
    ["Status", String(status).replace(/_/g, " ")],
    ["Currency", "IDR RUPIAH"],
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

  doc.setFontSize(10);
  doc.setTextColor(70);
  doc.setFont(undefined, "italic");
  y = writeWrap("We hereby confirm receipt of the following items", M, y, contentW, 12);
  doc.setFont(undefined, "normal");
  doc.setTextColor(0);
  y += 6;

  const CW = { no: 30, desc: 245, unit: 50, qty: 60, unitPrice: 60, total: 78 };
  const head = [["No.", "Description", "Unit", "Quantity", "Unit Price", "Total Price"]];
  const body = mapped.map((it, i) => [
    String(i + 1),
    String(it.name),
    String(it.unit),
    fmtNum(it.qty),
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
      lineWidth: 0.7,
      lineColor: [180, 180, 180],
    },
    alternateRowStyles: { fillColor: [249, 249, 249] },
    columnStyles: {
      0: { cellWidth: CW.no, halign: "center" },
      1: { cellWidth: CW.desc },
      2: { cellWidth: CW.unit, halign: "center" },
      3: { cellWidth: CW.qty, halign: "right" },
      4: { cellWidth: CW.unitPrice, halign: "right" },
      5: { cellWidth: CW.total, halign: "right" },
    },
  });

  y = (doc.lastAutoTable?.finalY || y) + totalsTopSpacing;

  const rightX = M + leftW + gap;
  const lineH = 13.8;
  const totals = [["Total :", fmtIDR(subtotal)]];
  doc.setFontSize(10);
  totals.forEach(([label, val], i) => {
    const ty = y + i * lineH;
    doc.text(label, rightX, ty);
    doc.text(val, rightX + rightW - 8, ty, { align: "right" });
  });
  y += totals.length * lineH + 22;

  const sigW = (pageW - M * 2) / 4;
  const sigTitles = ["Received by,", "Checked by,", "Approved by,", "Confirmed by,"];
  const sigRoles = [
    receipt.received_by_name || "Warehouse",
    "Purchasing",
    "GM Operational",
    "Vendor",
  ];

  doc.setFontSize(10);
  for (let i = 0; i < 4; i++) doc.text(sigTitles[i], M + i * sigW + 6, y);

  y += 58;
  doc.setLineWidth(0.6);
  for (let i = 0; i < 4; i++) {
    const x = M + i * sigW + 6;
    doc.line(x, y, x + sigW - 20, y);
  }
  y += 12;
  doc.setFontSize(9);
  for (let i = 0; i < 4; i++) doc.text(sigRoles[i], M + i * sigW + 6, y);

  doc.setFontSize(8.5);
  doc.setTextColor(90);
  const pageCount = doc.getNumberOfPages();
  doc.text(`Page 1 of ${pageCount}    Printed by ${printedBy}`, pageW - M, pageH - 16, {
    align: "right",
  });

  doc.save(`${grNo}.pdf`);
}
