import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { N } from "./fmt";

/* ============================================================
   Theme
   ============================================================ */
const COLOR = {
  navy: [15, 23, 42],
  ink: [30, 41, 59],
  primary: [37, 99, 235],
  slate: [100, 116, 139],
  muted: [148, 163, 184],
  border: [226, 232, 240],
  soft: [248, 250, 252],
  softBlue: [239, 246, 255],
  white: [255, 255, 255],
  green: [5, 150, 105],
  amber: [217, 119, 6],
};

const MARGIN = 40;
const TABLE_TOP_MARGIN = 64;

/* ============================================================
   Formatters
   ============================================================ */
const IDR = (n) =>
  Number(n || 0).toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });

const fmtNum = (n) => Number(n || 0).toLocaleString("id-ID");

const fmtPct = (n) => `${Number(n || 0).toFixed(1)}%`;

const fmtDate = (d) => {
  if (!d) return "-";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const fmtDateTime = (d) => {
  if (!d) return "-";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const fmtTime = (d) => {
  if (!d) return "-";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const paymentMethodLabel = (method) => {
  const raw = String(method || "").trim();
  if (!raw) return "Cash";
  if (raw.toUpperCase() === "QRIS") return "QRIS";
  const key = raw.toLowerCase();
  if (key === "ewallet") return "E-Wallet";
  if (key === "transfer") return "Bank Transfer";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
};

/* ============================================================
   Low level drawing helpers
   ============================================================ */
const contentWidth = (doc) => doc.internal.pageSize.getWidth() - MARGIN * 2;

function setText(doc, color, size, style = "normal") {
  doc.setTextColor(color[0], color[1], color[2]);
  doc.setFontSize(size);
  doc.setFont("helvetica", style);
}

function fill(doc, color) {
  doc.setFillColor(color[0], color[1], color[2]);
}

function stroke(doc, color, width = 0.5) {
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.setLineWidth(width);
}

/** Slim header for continuation pages so no page looks orphaned. */
function ensureRunningHeader(doc, ctx) {
  const page = doc.getCurrentPageInfo().pageNumber;
  if (ctx.headeredPages.has(page)) return;
  ctx.headeredPages.add(page);

  const pageW = doc.internal.pageSize.getWidth();
  setText(doc, COLOR.navy, 9, "bold");
  doc.text("LAPORAN PENJUALAN", MARGIN, 30);
  setText(doc, COLOR.muted, 8, "normal");
  doc.text(ctx.reportPeriod, pageW - MARGIN, 30, { align: "right" });
  stroke(doc, COLOR.border, 0.7);
  doc.line(MARGIN, 38, pageW - MARGIN, 38);
}

function startPage(doc, ctx) {
  doc.addPage();
  ctx.headeredPages.add(doc.getCurrentPageInfo().pageNumber);
  return MARGIN;
}

function ensureSpace(doc, ctx, y, needed = 110) {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + needed > pageH - 46) {
    doc.addPage();
    const page = doc.getCurrentPageInfo().pageNumber;
    ctx.headeredPages.add(page);
    ensureRunningHeaderForced(doc, ctx);
    return 52;
  }
  return y;
}

function ensureRunningHeaderForced(doc, ctx) {
  const pageW = doc.internal.pageSize.getWidth();
  setText(doc, COLOR.navy, 9, "bold");
  doc.text("LAPORAN PENJUALAN", MARGIN, 30);
  setText(doc, COLOR.muted, 8, "normal");
  doc.text(ctx.reportPeriod, pageW - MARGIN, 30, { align: "right" });
  stroke(doc, COLOR.border, 0.7);
  doc.line(MARGIN, 38, pageW - MARGIN, 38);
}

function sectionHeading(doc, text, y, subtitle) {
  const w = contentWidth(doc);
  fill(doc, COLOR.primary);
  doc.roundedRect(MARGIN, y - 1, 3.5, 13, 1.5, 1.5, "F");

  setText(doc, COLOR.navy, 11.5, "bold");
  doc.text(String(text).toUpperCase(), MARGIN + 11, y + 9.5);

  if (subtitle) {
    setText(doc, COLOR.muted, 8.5, "normal");
    doc.text(subtitle, MARGIN + w, y + 9.5, { align: "right" });
  }

  stroke(doc, COLOR.border, 0.7);
  doc.line(MARGIN, y + 17, MARGIN + w, y + 17);
  return y + 28;
}

function paragraph(doc, text, y, opts = {}) {
  const w = contentWidth(doc);
  setText(doc, opts.color || COLOR.ink, opts.size || 9.5, opts.style || "normal");
  const lines = doc.splitTextToSize(String(text), w);
  const lh = opts.lineHeight || 13.5;
  lines.forEach((line, i) => doc.text(line, MARGIN, y + i * lh));
  return y + lines.length * lh;
}

/** KPI card grid. */
function drawKpiCards(doc, y, cards, perRow = 3) {
  const w = contentWidth(doc);
  const gap = 10;
  const cardW = (w - gap * (perRow - 1)) / perRow;
  const cardH = 58;
  let row = 0;

  cards.forEach((card, i) => {
    const col = i % perRow;
    row = Math.floor(i / perRow);
    const x = MARGIN + col * (cardW + gap);
    const top = y + row * (cardH + gap);

    fill(doc, COLOR.soft);
    stroke(doc, COLOR.border, 0.6);
    doc.roundedRect(x, top, cardW, cardH, 7, 7, "FD");

    fill(doc, card.accent || COLOR.primary);
    doc.roundedRect(x, top + 8, 3, cardH - 16, 1.5, 1.5, "F");

    setText(doc, COLOR.slate, 7.4, "bold");
    doc.text(String(card.label).toUpperCase(), x + 12, top + 18);

    setText(doc, COLOR.navy, card.valueSize || 13.5, "bold");
    doc.text(String(card.value), x + 12, top + 37);

    if (card.hint) {
      setText(doc, COLOR.muted, 7.4, "normal");
      doc.text(String(card.hint), x + 12, top + 49);
    }
  });

  return y + (row + 1) * (cardH + gap);
}

function tableOptions(doc, ctx, extra = {}) {
  return {
    margin: { left: MARGIN, right: MARGIN, top: TABLE_TOP_MARGIN },
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: { top: 5, right: 6, bottom: 5, left: 6 },
      lineColor: COLOR.border,
      lineWidth: 0.5,
      textColor: COLOR.ink,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      fillColor: COLOR.navy,
      textColor: COLOR.white,
      fontStyle: "bold",
      fontSize: 8.5,
      cellPadding: { top: 6, right: 6, bottom: 6, left: 6 },
    },
    footStyles: {
      fillColor: COLOR.softBlue,
      textColor: COLOR.navy,
      fontStyle: "bold",
      fontSize: 8.5,
    },
    alternateRowStyles: { fillColor: COLOR.soft },
    didDrawPage: () => ensureRunningHeader(doc, ctx),
    ...extra,
  };
}

/* ============================================================
   Data aggregation
   ============================================================ */
function resolveStoreInfo(sale) {
  const store =
    sale?.store_location ??
    sale?.storeLocation ??
    sale?.cashier?.store_location ??
    sale?.cashier?.storeLocation;
  const rawId = store?.id ?? sale?.store_location_id ?? null;
  const name = store?.name || (rawId != null ? `Cabang ${rawId}` : "Tanpa Cabang");
  return {
    id: rawId != null ? String(rawId) : `unknown_${name}`,
    name,
  };
}

function saleItemsQty(sale) {
  const items = Array.isArray(sale?.items) ? sale.items : [];
  return items.reduce((sum, it) => sum + N(it?.qty ?? it?.quantity ?? 1), 0);
}

/** Line-level item discount (same rules as dashboard aggregate). */
function getItemDiscount(it) {
  if (N(it?.discount_nominal) > 0) return N(it.discount_nominal);

  const qty = N(it?.qty ?? it?.quantity ?? 1);
  const unit = N(it?.unit_price ?? it?.price ?? 0);
  const net = N(it?.net_unit_price ?? unit);

  if (unit > net) return (unit - net) * qty;

  const subtotal = N(it?.subtotal ?? it?.line_total ?? qty * unit);
  const normal = qty * unit;
  if (normal > subtotal) return normal - subtotal;

  return 0;
}

function txItemDiscounts(tx) {
  const items = Array.isArray(tx?.items) ? tx.items : [];
  return items.reduce((sum, it) => sum + getItemDiscount(it), 0);
}

/** Header (global) + item discounts for one sale. */
function txTotalDiscount(tx) {
  return N(tx?.discount) + txItemDiscounts(tx);
}

function txTotal(tx) {
  if (
    tx?.final_total === null ||
    tx?.final_total === 0 ||
    tx?.final_total === undefined
  ) {
    return N(tx?.total);
  }
  return N(tx?.final_total);
}

function txItemsRevenue(tx) {
  const items = Array.isArray(tx?.items) ? tx.items : [];
  return items.reduce((sum, item) => {
    const qty = N(item?.qty ?? item?.quantity ?? 1);
    return (
      sum +
      N(
        item?.line_total ??
          item?.subtotal ??
          item?.total ??
          N(item?.price ?? item?.unit_price) * qty
      )
    );
  }, 0);
}

/** Gross item total before discounts (unit price × qty). */
function txItemsGross(tx) {
  const items = Array.isArray(tx?.items) ? tx.items : [];
  return items.reduce((sum, item) => {
    const qty = N(item?.qty ?? item?.quantity ?? 1);
    const unit = N(item?.unit_price ?? item?.price ?? 0);
    return sum + unit * qty;
  }, 0);
}

/** Prefer stored backend total; fall back to snapshot sum or total - items. */
function txAdditionalCharge(tx) {
  if (tx?.additional_charge_total != null && tx.additional_charge_total !== "") {
    return Math.max(0, N(tx.additional_charge_total));
  }

  const snapshot = Array.isArray(tx?.additional_charges_snapshot)
    ? tx.additional_charges_snapshot
    : [];
  if (snapshot.length > 0) {
    return Math.max(
      0,
      snapshot.reduce((sum, c) => sum + N(c?.amount), 0)
    );
  }

  if (tx?.grand_total != null && tx.grand_total !== "") {
    return Math.max(0, txTotal(tx) - N(tx.grand_total));
  }

  const legacy =
    N(tx?.service_charge) + N(tx?.tax) + N(tx?.pb1) + N(tx?.pb1_amount);
  if (legacy > 0) return legacy;

  // total = (items - discount) + additional → additional = total - items + discount
  return Math.max(0, txTotal(tx) - txItemsRevenue(tx) + N(tx?.discount));
}

function txPaymentLabels(tx) {
  const payments = Array.isArray(tx?.payments) ? tx.payments : [];
  if (payments.length > 0) {
    return [...new Set(payments.map((p) => paymentMethodLabel(p?.method)))];
  }
  return [paymentMethodLabel(tx?.payment_method || tx?.method)];
}

const isCashMethod = (method) => {
  const key = String(method || "").trim().toLowerCase();
  return key === "" || key === "cash" || key === "tunai";
};

/**
 * Amount per payment method, net of change.
 *
 * Payment rows store what the customer handed over, not what they owed, so the
 * change given back has to come off the mix (cash first) to keep it equal to
 * revenue.
 */
function txPaymentMix(tx) {
  const payments = Array.isArray(tx?.payments) ? tx.payments : [];
  if (payments.length === 0) {
    return { [txPaymentLabels(tx)[0] || "Cash"]: txTotal(tx) };
  }

  const mix = {};
  const buckets = [];
  for (const p of payments) {
    const method = paymentMethodLabel(p?.method);
    if (mix[method] == null) {
      mix[method] = 0;
      buckets.push({ method, cash: isCashMethod(p?.method) });
    }
    mix[method] += N(p?.amount);
  }

  let change = N(tx?.change);
  if (change <= 0) return mix;

  buckets.sort((a, b) => Number(b.cash) - Number(a.cash));
  for (const bucket of buckets) {
    if (change <= 0) break;
    const take = Math.min(change, mix[bucket.method]);
    mix[bucket.method] -= take;
    change -= take;
  }

  return mix;
}

function summarize(sales) {
  let revenue = 0;
  let tx = 0;
  let discounts = 0;
  let itemsQty = 0;
  let itemsRevenue = 0;
  let itemsGross = 0;
  let additionalCharge = 0;
  const payMix = {};

  for (const sale of sales) {
    const total = N(sale?.final_total ?? sale?.total);
    revenue += total;
    tx += 1;
    discounts += txTotalDiscount(sale);
    itemsQty += saleItemsQty(sale);
    itemsRevenue += txItemsRevenue(sale);
    itemsGross += txItemsGross(sale);
    additionalCharge += txAdditionalCharge(sale);

    for (const [method, amount] of Object.entries(txPaymentMix(sale))) {
      payMix[method] = (payMix[method] || 0) + amount;
    }
  }

  return {
    revenue,
    tx,
    discounts,
    itemsQty,
    itemsRevenue,
    itemsGross,
    additionalCharge,
    aov: tx ? revenue / tx : 0,
    paymentMix: Object.entries(payMix)
      .map(([method, amount]) => ({ method, amount }))
      .sort((a, b) => b.amount - a.amount),
  };
}

function buildDailyBreakdown(sales) {
  const byDay = new Map();

  for (const sale of sales) {
    const key = new Date(sale?.created_at || sale?.createdAt || Date.now())
      .toISOString()
      .slice(0, 10);

    if (!byDay.has(key)) {
      byDay.set(key, {
        date: key,
        tx: 0,
        revenue: 0,
        discounts: 0,
        itemsQty: 0,
        products: {},
        methods: {},
      });
    }

    const row = byDay.get(key);
    row.tx += 1;
    row.revenue += N(sale?.total);
    row.discounts += txTotalDiscount(sale);

    const items = Array.isArray(sale?.items) ? sale.items : [];
    for (const it of items) {
      const name =
        it?.product?.name || it?.name || `Produk #${it?.product_id ?? "?"}`;
      const qty = N(it?.qty ?? it?.quantity ?? 1);
      const lineTotal = N(it?.line_total ?? it?.subtotal ?? N(it?.price) * qty);
      row.itemsQty += qty;
      row.products[name] ||= { name, qty: 0, revenue: 0 };
      row.products[name].qty += qty;
      row.products[name].revenue += lineTotal;
    }

    for (const [method, amount] of Object.entries(txPaymentMix(sale))) {
      row.methods[method] = (row.methods[method] || 0) + amount;
    }
  }

  return Array.from(byDay.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((row) => ({
      ...row,
      products: Object.values(row.products).sort((a, b) => b.qty - a.qty),
      methods: Object.entries(row.methods)
        .map(([method, amount]) => ({ method, amount }))
        .sort((a, b) => b.amount - a.amount),
    }));
}

function groupByStore(sales, options) {
  const grouped = new Map();
  for (const sale of sales) {
    const store = resolveStoreInfo(sale);
    const label = options.storeLabelById?.get(String(store.id)) || store.name;
    if (!grouped.has(store.id)) {
      grouped.set(store.id, { id: store.id, name: label, sales: [] });
    }
    grouped.get(store.id).sales.push(sale);
  }
  return Array.from(grouped.values()).sort((a, b) =>
    String(a.name).localeCompare(String(b.name), "id")
  );
}

function buildProductTotals(sales) {
  const byProduct = new Map();

  for (const sale of sales) {
    const items = Array.isArray(sale?.items) ? sale.items : [];
    for (const it of items) {
      const name =
        it?.product?.name || it?.name || `Produk #${it?.product_id ?? "?"}`;
      const qty = N(it?.qty ?? it?.quantity ?? 1);
      const lineTotal = N(it?.line_total ?? it?.subtotal ?? N(it?.price) * qty);
      if (!byProduct.has(name)) {
        byProduct.set(name, { name, qty: 0, revenue: 0 });
      }
      const row = byProduct.get(name);
      row.qty += qty;
      row.revenue += lineTotal;
    }
  }

  return Array.from(byProduct.values()).sort(
    (a, b) => b.qty - a.qty || b.revenue - a.revenue
  );
}

/* ============================================================
   Page blocks
   ============================================================ */
function drawCover(doc, ctx, y, meta) {
  const w = contentWidth(doc);
  const bandH = 96;

  fill(doc, COLOR.navy);
  doc.roundedRect(MARGIN, y, w, bandH, 12, 12, "F");

  fill(doc, COLOR.primary);
  doc.roundedRect(MARGIN + 22, y + 60, 46, 3.5, 2, 2, "F");

  setText(doc, COLOR.white, 21, "bold");
  doc.text("LAPORAN PENJUALAN", MARGIN + 22, y + 40);

  setText(doc, COLOR.muted, 9.5, "normal");
  doc.text("Sales Performance Report", MARGIN + 22, y + 55);

  setText(doc, COLOR.white, 10.5, "bold");
  doc.text("Dashboard POS", MARGIN + w - 22, y + 38, { align: "right" });
  setText(doc, COLOR.muted, 8.5, "normal");
  doc.text(`Dicetak ${meta.printedAt}`, MARGIN + w - 22, y + 53, {
    align: "right",
  });
  doc.text(`Halaman laporan otomatis`, MARGIN + w - 22, y + 66, {
    align: "right",
  });

  y += bandH + 14;

  // Meta strip
  const cells = [
    { label: "Periode Laporan", value: meta.period },
    { label: "Cakupan Cabang", value: meta.scope },
    { label: "Total Transaksi", value: meta.txCount },
  ];
  const stripH = 46;
  const cellW = w / cells.length;

  fill(doc, COLOR.soft);
  stroke(doc, COLOR.border, 0.6);
  doc.roundedRect(MARGIN, y, w, stripH, 7, 7, "FD");

  cells.forEach((cell, i) => {
    const x = MARGIN + i * cellW;
    if (i > 0) {
      stroke(doc, COLOR.border, 0.6);
      doc.line(x, y + 8, x, y + stripH - 8);
    }
    setText(doc, COLOR.slate, 7.4, "bold");
    doc.text(cell.label.toUpperCase(), x + 14, y + 18);
    setText(doc, COLOR.navy, 10, "bold");
    const value = doc.splitTextToSize(String(cell.value), cellW - 26)[0];
    doc.text(value, x + 14, y + 33);
  });

  return y + stripH + 22;
}

function drawBranchBanner(doc, name, y) {
  const w = contentWidth(doc);
  const h = 42;

  fill(doc, COLOR.navy);
  doc.roundedRect(MARGIN, y, w, h, 9, 9, "F");
  fill(doc, COLOR.primary);
  doc.roundedRect(MARGIN, y + 9, 4, h - 18, 2, 2, "F");

  setText(doc, COLOR.muted, 7.4, "bold");
  doc.text("CABANG", MARGIN + 16, y + 16);
  setText(doc, COLOR.white, 14, "bold");
  const label = doc.splitTextToSize(String(name || "-"), w - 40)[0];
  doc.text(label, MARGIN + 16, y + 32);

  return y + h + 18;
}

function drawDayBanner(doc, day, y) {
  const w = contentWidth(doc);
  const h = 28;

  fill(doc, COLOR.softBlue);
  stroke(doc, COLOR.border, 0.6);
  doc.roundedRect(MARGIN, y, w, h, 6, 6, "FD");

  setText(doc, COLOR.navy, 10, "bold");
  doc.text(fmtDate(day.date), MARGIN + 12, y + 18);

  setText(doc, COLOR.ink, 9, "normal");
  doc.text(
    `${fmtNum(day.tx)} transaksi  •  ${fmtNum(day.itemsQty)} item  •  ${IDR(day.revenue)}`,
    MARGIN + w - 12,
    y + 18,
    { align: "right" }
  );

  return y + h + 10;
}

function drawDailyDetail(doc, ctx, y, sales) {
  const daily = buildDailyBreakdown(sales);

  if (daily.length === 0) {
    autoTable(
      doc,
      tableOptions(doc, ctx, {
        startY: y,
        head: [["Tanggal", "Transaksi", "Item", "Pendapatan"]],
        body: [["-", "0", "0", IDR(0)]],
      })
    );
    return doc.lastAutoTable.finalY + 18;
  }

  for (const day of daily) {
    y = ensureSpace(doc, ctx, y, 150);
    y = drawDayBanner(doc, day, y);

    setText(doc, COLOR.slate, 8.6, "bold");
    doc.text("1. ITEM TERJUAL", MARGIN, y);
    autoTable(
      doc,
      tableOptions(doc, ctx, {
        startY: y + 6,
        head: [["#", "Produk", "Qty", "Pendapatan"]],
        body: day.products.length
          ? day.products.map((row, idx) => [
              idx + 1,
              row.name,
              fmtNum(row.qty),
              IDR(row.revenue),
            ])
          : [["-", "Tidak ada item", "0", IDR(0)]],
        foot: day.products.length
          ? [[
              "",
              "Total item",
              fmtNum(day.itemsQty),
              IDR(day.products.reduce((s, r) => s + r.revenue, 0)),
            ]]
          : undefined,
        columnStyles: {
          0: { halign: "center", cellWidth: 26 },
          2: { halign: "right", cellWidth: 54 },
          3: { halign: "right", cellWidth: 96 },
        },
      })
    );
    y = doc.lastAutoTable.finalY + 12;

    y = ensureSpace(doc, ctx, y, 90);
    setText(doc, COLOR.slate, 8.6, "bold");
    doc.text("2. METODE PEMBAYARAN", MARGIN, y);
    autoTable(
      doc,
      tableOptions(doc, ctx, {
        startY: y + 6,
        head: [["Metode", "Nominal", "Porsi"]],
        body: day.methods.length
          ? day.methods.map((row) => {
              const totalMethods = day.methods.reduce((s, r) => s + r.amount, 0);
              return [
                row.method,
                IDR(row.amount),
                fmtPct(totalMethods ? (row.amount / totalMethods) * 100 : 0),
              ];
            })
          : [["-", IDR(0), fmtPct(0)]],
        foot: day.methods.length
          ? [[
              "Total",
              IDR(day.methods.reduce((s, r) => s + r.amount, 0)),
              fmtPct(100),
            ]]
          : undefined,
        columnStyles: {
          1: { halign: "right", cellWidth: 110 },
          2: { halign: "right", cellWidth: 62 },
        },
      })
    );
    y = doc.lastAutoTable.finalY + 20;
  }

  return y;
}

function drawSummaryTables(doc, ctx, y, summary) {
  autoTable(
    doc,
    tableOptions(doc, ctx, {
      startY: y,
      head: [["Indikator", "Nilai"]],
      body: [
        ["Total Pendapatan", IDR(summary.revenue)],
        ["Total Transaksi", fmtNum(summary.tx)],
        ["Total Item Terjual", fmtNum(summary.itemsQty)],
        ["Rata-rata per Transaksi", IDR(summary.aov)],
        ["Total Diskon", IDR(summary.discounts)],
      ],
      columnStyles: {
        1: { halign: "right", cellWidth: 160, fontStyle: "bold" },
      },
    })
  );
  y = doc.lastAutoTable.finalY + 14;

  y = ensureSpace(doc, ctx, y, 100);
  setText(doc, COLOR.slate, 8.6, "bold");
  doc.text("METODE PEMBAYARAN", MARGIN, y);
  autoTable(
    doc,
    tableOptions(doc, ctx, {
      startY: y + 6,
      head: [["Metode", "Nominal", "Porsi"]],
      body: summary.paymentMix.length
        ? summary.paymentMix.map((row) => {
            const total = summary.paymentMix.reduce((s, r) => s + r.amount, 0);
            return [
              row.method,
              IDR(row.amount),
              fmtPct(total ? (row.amount / total) * 100 : 0),
            ];
          })
        : [["-", IDR(0), fmtPct(0)]],
      foot: summary.paymentMix.length
        ? [[
            "Total",
            IDR(summary.paymentMix.reduce((s, r) => s + r.amount, 0)),
            fmtPct(100),
          ]]
        : undefined,
      columnStyles: {
        1: { halign: "right", cellWidth: 130 },
        2: { halign: "right", cellWidth: 70 },
      },
    })
  );

  return doc.lastAutoTable.finalY + 18;
}

function drawGrandTotalBox(doc, y, totals) {
  const w = contentWidth(doc);
  const h = 92;

  fill(doc, COLOR.navy);
  doc.roundedRect(MARGIN, y, w, h, 11, 11, "F");
  fill(doc, COLOR.primary);
  doc.roundedRect(MARGIN + 22, y + 58, 54, 3.5, 2, 2, "F");

  setText(doc, COLOR.muted, 7.8, "bold");
  doc.text("TOTAL PENDAPATAN KESELURUHAN", MARGIN + 22, y + 26);

  setText(doc, COLOR.white, 23, "bold");
  doc.text(IDR(totals.revenue), MARGIN + 22, y + 50);

  setText(doc, COLOR.muted, 8.2, "normal");
  doc.text(
    `dari ${fmtNum(totals.tx)} transaksi pada periode laporan`,
    MARGIN + 22,
    y + 76
  );

  const rightX = MARGIN + w - 22;
  const rows = [
    ["Total Item Terjual", fmtNum(totals.itemsQty)],
    ["Rata-rata / Transaksi", IDR(totals.aov)],
    ["Total Diskon", IDR(totals.discounts)],
  ];
  rows.forEach(([label, value], i) => {
    const top = y + 30 + i * 20;
    setText(doc, COLOR.muted, 7.8, "normal");
    doc.text(label, rightX - 110, top, { align: "right" });
    setText(doc, COLOR.white, 9.6, "bold");
    doc.text(value, rightX, top, { align: "right" });
  });

  return y + h + 20;
}

function drawConclusion(doc, ctx, totals, branchRows, productRows) {
  let y = startPage(doc, ctx);
  ensureRunningHeaderForced(doc, ctx);
  y = 52;

  y = sectionHeading(doc, "Kesimpulan Laporan Penjualan", y, ctx.reportPeriod);
  y = drawGrandTotalBox(doc, y, totals);

  const topBranch = branchRows[0];
  const topMethod = totals.paymentMix[0];
  const narrative = [
    `Pada periode ${ctx.reportPeriod}, tercatat ${fmtNum(totals.tx)} transaksi penjualan`,
    branchRows.length > 1 ? ` dari ${fmtNum(branchRows.length)} cabang` : "",
    ` dengan total pendapatan sebesar ${IDR(totals.revenue)}.`,
    ` Rata-rata nilai transaksi adalah ${IDR(totals.aov)} dengan total item terjual sebanyak ${fmtNum(totals.itemsQty)} unit`,
    totals.discounts > 0
      ? ` dan total diskon yang diberikan sebesar ${IDR(totals.discounts)}.`
      : " tanpa pemberian diskon.",
    topBranch
      ? ` Kontribusi tertinggi berasal dari ${topBranch.name} sebesar ${IDR(topBranch.revenue)} (${fmtPct(topBranch.share)} dari total pendapatan).`
      : "",
    topMethod
      ? ` Metode pembayaran dominan adalah ${topMethod.method} dengan nilai ${IDR(topMethod.amount)}.`
      : "",
    productRows.length
      ? ` Item yang terjual mencakup ${fmtNum(productRows.length)} jenis produk, dengan produk terlaris ${productRows[0].name} sebanyak ${fmtNum(productRows[0].qty)} unit.`
      : "",
  ].join("");

  y = paragraph(doc, narrative, y) + 16;

  y = ensureSpace(doc, ctx, y, 130);
  y = sectionHeading(doc, "Rekapitulasi per Cabang", y);
  autoTable(
    doc,
    tableOptions(doc, ctx, {
      startY: y,
      head: [[
        "#",
        "Cabang",
        "Transaksi",
        "Item",
        "Pendapatan",
        "Add. Charge",
        "Kontribusi",
      ]],
      body: branchRows.length
        ? branchRows.map((row, idx) => [
            idx + 1,
            row.name,
            fmtNum(row.tx),
            fmtNum(row.itemsQty),
            IDR(row.revenue),
            IDR(row.additionalCharge),
            fmtPct(row.share),
          ])
        : [["-", "Tidak ada data", "0", "0", IDR(0), IDR(0), fmtPct(0)]],
      foot: [[
        "",
        "TOTAL KESELURUHAN",
        fmtNum(totals.tx),
        fmtNum(totals.itemsQty),
        IDR(totals.revenue),
        IDR(totals.additionalCharge),
        fmtPct(branchRows.length ? 100 : 0),
      ]],
      columnStyles: {
        0: { halign: "center", cellWidth: 22 },
        2: { halign: "right", cellWidth: 54 },
        3: { halign: "right", cellWidth: 42 },
        4: { halign: "right", cellWidth: 88 },
        5: { halign: "right", cellWidth: 78 },
        6: { halign: "right", cellWidth: 58 },
      },
    })
  );
  y = doc.lastAutoTable.finalY + 18;

  y = ensureSpace(doc, ctx, y, 130);
  y = sectionHeading(
    doc,
    "Rekapitulasi Item Terjual",
    y,
    `${fmtNum(productRows.length)} jenis produk • ${fmtNum(totals.itemsQty)} unit`
  );
  autoTable(
    doc,
    tableOptions(doc, ctx, {
      startY: y,
      head: [["#", "Produk", "Qty Terjual", "Pendapatan", "Add. Charge"]],
      body: productRows.length
        ? productRows.map((row, idx) => [
            idx + 1,
            row.name,
            fmtNum(row.qty),
            IDR(row.revenue),
            "-",
          ])
        : [["-", "Tidak ada item terjual", "0", IDR(0), IDR(0)]],
      foot: [[
        "",
        "TOTAL ITEM TERJUAL",
        fmtNum(totals.itemsQty),
        IDR(productRows.reduce((s, r) => s + r.revenue, 0)),
        IDR(totals.additionalCharge),
      ]],
      columnStyles: {
        0: { halign: "center", cellWidth: 24 },
        2: { halign: "right", cellWidth: 72 },
        3: { halign: "right", cellWidth: 100 },
        4: { halign: "right", cellWidth: 90 },
      },
    })
  );
  y = doc.lastAutoTable.finalY + 10;

  const itemsRevenue = productRows.reduce((s, r) => s + r.revenue, 0);
  const itemsGross = N(totals.itemsGross) || itemsRevenue + N(totals.discounts);
  const additionalCharge = N(totals.additionalCharge);
  autoTable(
    doc,
    tableOptions(doc, ctx, {
      startY: y,
      head: [["Komponen", "Nominal"]],
      body: [
        ["Harga Produk", IDR(itemsGross)],
        ["Diskon", IDR(totals.discounts)],
        ["Additional Charge", IDR(additionalCharge)],
      ],
      foot: [["TOTAL PENJUALAN", IDR(totals.revenue)]],
      columnStyles: {
        1: { halign: "right", cellWidth: 140, fontStyle: "bold" },
      },
    })
  );
  y = doc.lastAutoTable.finalY + 18;

  y = ensureSpace(doc, ctx, y, 120);
  y = sectionHeading(doc, "Rekapitulasi Metode Pembayaran", y);
  autoTable(
    doc,
    tableOptions(doc, ctx, {
      startY: y,
      head: [["Metode Pembayaran", "Nominal", "Porsi"]],
      body: totals.paymentMix.length
        ? totals.paymentMix.map((row) => {
            const sum = totals.paymentMix.reduce((s, r) => s + r.amount, 0);
            return [
              row.method,
              IDR(row.amount),
              fmtPct(sum ? (row.amount / sum) * 100 : 0),
            ];
          })
        : [["-", IDR(0), fmtPct(0)]],
      foot: [[
        "TOTAL PEMBAYARAN",
        IDR(totals.paymentMix.reduce((s, r) => s + r.amount, 0)),
        fmtPct(totals.paymentMix.length ? 100 : 0),
      ]],
      columnStyles: {
        1: { halign: "right", cellWidth: 140 },
        2: { halign: "right", cellWidth: 70 },
      },
    })
  );
  y = doc.lastAutoTable.finalY + 22;

  // Closing statement
  y = ensureSpace(doc, ctx, y, 88);
  const w = contentWidth(doc);
  fill(doc, COLOR.softBlue);
  stroke(doc, COLOR.primary, 0.8);
  doc.roundedRect(MARGIN, y, w, 70, 8, 8, "FD");
  setText(doc, COLOR.slate, 7.8, "bold");
  doc.text("KESIMPULAN AKHIR", MARGIN + 14, y + 18);
  setText(doc, COLOR.navy, 12, "bold");
  doc.text(
    `Total penjualan periode ini: ${IDR(totals.revenue)}`,
    MARGIN + 14,
    y + 38
  );
  setText(doc, COLOR.ink, 10, "bold");
  doc.text(
    `Total item terjual: ${fmtNum(totals.itemsQty)} unit dari ${fmtNum(
      productRows.length
    )} jenis produk`,
    MARGIN + 14,
    y + 56
  );
}

function paintFooters(doc, ctx) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const total = doc.internal.getNumberOfPages();

  for (let i = 1; i <= total; i += 1) {
    doc.setPage(i);
    stroke(doc, COLOR.border, 0.6);
    doc.line(MARGIN, pageH - 32, pageW - MARGIN, pageH - 32);

    setText(doc, COLOR.muted, 7.8, "normal");
    doc.text(`Laporan Penjualan  •  ${ctx.reportPeriod}`, MARGIN, pageH - 20);
    doc.text(`Halaman ${i} dari ${total}`, pageW - MARGIN, pageH - 20, {
      align: "right",
    });
  }
}

/* ============================================================
   Entry point
   ============================================================ */
export function exportToPDF(data, filters, aggRange, options = {}) {
  const sales = (Array.isArray(data) ? data : []).filter(
    (s) => String(s?.status || "").toLowerCase() !== "void"
  );

  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const reportPeriod = `${fmtDate(filters?.from)} - ${fmtDate(filters?.to)}`;
  const ctx = { reportPeriod, headeredPages: new Set([1]) };

  const scopeLabel =
    options.selectedStoreLabel ||
    (filters?.storeId ? `Cabang ${filters.storeId}` : "Semua cabang");

  const totals = summarize(sales);
  const groups = groupByStore(sales, options);
  const branchRows = groups
    .map((group) => {
      const s = summarize(group.sales);
      return {
        name: group.name,
        tx: s.tx,
        revenue: s.revenue,
        itemsQty: s.itemsQty,
        additionalCharge: s.additionalCharge,
        share: totals.revenue ? (s.revenue / totals.revenue) * 100 : 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  /* ---------- Page 1: cover + executive summary ---------- */
  let y = MARGIN;
  y = drawCover(doc, ctx, y, {
    period: reportPeriod,
    scope: scopeLabel,
    txCount: fmtNum(totals.tx),
    printedAt: fmtDateTime(new Date()),
  });

  y = sectionHeading(doc, "Ringkasan Eksekutif", y, scopeLabel);
  y = drawKpiCards(doc, y, [
    {
      label: "Total Pendapatan",
      value: IDR(totals.revenue),
      hint: "Termasuk service charge & pajak",
      accent: COLOR.primary,
    },
    {
      label: "Total Transaksi",
      value: fmtNum(totals.tx),
      hint: "Transaksi selesai",
      accent: COLOR.green,
    },
    {
      label: "Rata-rata / Transaksi",
      value: IDR(totals.aov),
      hint: "Average order value",
      accent: COLOR.primary,
    },
    {
      label: "Total Item Terjual",
      value: fmtNum(totals.itemsQty),
      hint: "Kuantitas seluruh produk",
      accent: COLOR.green,
    },
    {
      label: "Total Diskon",
      value: IDR(totals.discounts),
      hint: "Potongan yang diberikan",
      accent: COLOR.amber,
    },
    {
      label: "Jumlah Cabang",
      value: fmtNum(groups.length),
      hint: "Cabang dengan transaksi",
      accent: COLOR.primary,
    },
  ]);

  y = ensureSpace(doc, ctx, y, 140);
  y = sectionHeading(doc, "Ringkasan Metode Pembayaran", y);
  autoTable(
    doc,
    tableOptions(doc, ctx, {
      startY: y,
      head: [["Metode Pembayaran", "Nominal", "Porsi"]],
      body: totals.paymentMix.length
        ? totals.paymentMix.map((row) => {
            const sum = totals.paymentMix.reduce((s, r) => s + r.amount, 0);
            return [
              row.method,
              IDR(row.amount),
              fmtPct(sum ? (row.amount / sum) * 100 : 0),
            ];
          })
        : [["-", IDR(0), fmtPct(0)]],
      foot: [[
        "Total",
        IDR(totals.paymentMix.reduce((s, r) => s + r.amount, 0)),
        fmtPct(totals.paymentMix.length ? 100 : 0),
      ]],
      columnStyles: {
        1: { halign: "right", cellWidth: 140 },
        2: { halign: "right", cellWidth: 70 },
      },
    })
  );

  /* ---------- Per branch pages ---------- */
  for (const group of groups) {
    const summary = summarize(group.sales);
    y = startPage(doc, ctx);
    y = drawBranchBanner(doc, group.name, y);

    y = drawKpiCards(
      doc,
      y,
      [
        {
          label: "Pendapatan Cabang",
          value: IDR(summary.revenue),
          accent: COLOR.primary,
        },
        {
          label: "Transaksi",
          value: fmtNum(summary.tx),
          accent: COLOR.green,
        },
        {
          label: "Item Terjual",
          value: fmtNum(summary.itemsQty),
          accent: COLOR.primary,
        },
      ],
      3
    );

    y = sectionHeading(doc, "Rincian Harian", y, group.name);
    y = drawDailyDetail(doc, ctx, y, group.sales);

    y = ensureSpace(doc, ctx, y, 200);
    y = sectionHeading(doc, "Akumulasi Cabang", y, group.name);
    drawSummaryTables(doc, ctx, y, summary);
  }

  /* ---------- Conclusion ---------- */
  drawConclusion(doc, ctx, totals, branchRows, buildProductTotals(sales));

  paintFooters(doc, ctx);

  const from = filters?.from || "start";
  const to = filters?.to || "end";
  doc.save(`laporan-penjualan_${from}_${to}.pdf`);
}

function buildTransactionDailyBreakdown(sales) {
  const byDay = new Map();

  for (const sale of sales) {
    const key = new Date(sale?.created_at || sale?.createdAt || Date.now())
      .toISOString()
      .slice(0, 10);

    if (!byDay.has(key)) {
      byDay.set(key, {
        date: key,
        tx: 0,
        revenue: 0,
        itemsQty: 0,
        itemsGross: 0,
        discounts: 0,
        additionalCharge: 0,
        methods: {},
        transactions: [],
      });
    }

    const row = byDay.get(key);
    const total = txTotal(sale);
    const additionalCharge = txAdditionalCharge(sale);
    const productPrice = txItemsGross(sale);
    const discount = txTotalDiscount(sale);
    row.tx += 1;
    row.revenue += total;
    row.itemsQty += saleItemsQty(sale);
    row.itemsGross += productPrice;
    row.discounts += discount;
    row.additionalCharge += additionalCharge;

    const labels = txPaymentLabels(sale);
    for (const [method, amount] of Object.entries(txPaymentMix(sale))) {
      row.methods[method] = (row.methods[method] || 0) + amount;
    }

    row.transactions.push({
      code: sale?.code || sale?.number || "-",
      time: fmtTime(sale?.created_at || sale?.createdAt),
      itemsQty: saleItemsQty(sale),
      itemsDetail: (Array.isArray(sale?.items) ? sale.items : []).length
        ? (sale.items || [])
            .map((item, idx) => {
              const productName =
                item?.product?.name ||
                item?.product_name ||
                item?.name ||
                `Produk #${item?.product_id ?? idx + 1}`;
              const qty = N(item?.qty ?? item?.quantity ?? 1);
              const sku = item?.product?.sku || item?.product_sku;
              return `${productName}${sku ? ` (${sku})` : ""} x${fmtNum(qty)}`;
            })
            .join("\n")
        : "-",
      productPrice,
      discount,
      additionalCharge,
      methods: labels.join(" | "),
      total,
    });
  }

  return Array.from(byDay.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((row) => ({
      ...row,
      methods: Object.entries(row.methods)
        .map(([method, amount]) => ({ method, amount }))
        .sort((a, b) => b.amount - a.amount),
      transactions: row.transactions.sort((a, b) =>
        String(a.time).localeCompare(String(b.time))
      ),
    }));
}

function drawTransactionDailyDetail(doc, ctx, y, sales) {
  const daily = buildTransactionDailyBreakdown(sales);

  if (daily.length === 0) {
    autoTable(
      doc,
      tableOptions(doc, ctx, {
        startY: y,
        head: [["Tanggal", "Transaksi", "Item", "Pendapatan"]],
        body: [["-", "0", "0", IDR(0)]],
      })
    );
    return doc.lastAutoTable.finalY + 18;
  }

  for (const day of daily) {
    y = ensureSpace(doc, ctx, y, 180);
    y = drawDayBanner(doc, day, y);

    setText(doc, COLOR.slate, 8.6, "bold");
    doc.text("1. BREAKDOWN TRANSAKSI", MARGIN, y);
    autoTable(
      doc,
      tableOptions(doc, ctx, {
        startY: y + 6,
        styles: {
          font: "helvetica",
          fontSize: 7.8,
          cellPadding: { top: 4, right: 4, bottom: 4, left: 4 },
          lineColor: COLOR.border,
          lineWidth: 0.5,
          textColor: COLOR.ink,
          overflow: "linebreak",
          valign: "middle",
        },
        headStyles: {
          fillColor: COLOR.navy,
          textColor: COLOR.white,
          fontStyle: "bold",
          fontSize: 7.6,
          cellPadding: { top: 5, right: 4, bottom: 5, left: 4 },
        },
        head: [[
          "Kode",
          "Item Sold",
          "Metode",
          "Harga Produk",
          "Diskon",
          "Add. Charge",
          "Total",
        ]],
        body: day.transactions.map((row) => [
          row.code,
          row.itemsDetail,
          row.methods,
          IDR(row.productPrice),
          row.discount > 0 ? IDR(row.discount) : "-",
          IDR(row.additionalCharge),
          IDR(row.total),
        ]),
        foot: [[
          "TOTAL",
          `${fmtNum(day.itemsQty)} item / ${fmtNum(day.tx)} trx`,
          "",
          IDR(day.itemsGross),
          IDR(day.discounts),
          IDR(day.additionalCharge),
          IDR(day.revenue),
        ]],
        columnStyles: {
          0: { cellWidth: 90 },
          1: { cellWidth: 145 },
          2: { cellWidth: 48, halign: "center" },
          3: { halign: "right", cellWidth: 68 },
          4: { halign: "right", cellWidth: 58 },
          5: { halign: "right", cellWidth: 58 },
          6: { halign: "right", cellWidth: 68 },
        },
      })
    );
    y = doc.lastAutoTable.finalY + 12;

    y = ensureSpace(doc, ctx, y, 90);
    setText(doc, COLOR.slate, 8.6, "bold");
    doc.text("2. METODE PEMBAYARAN", MARGIN, y);
    autoTable(
      doc,
      tableOptions(doc, ctx, {
        startY: y + 6,
        head: [["Metode", "Nominal", "Porsi"]],
        body: day.methods.length
          ? day.methods.map((row) => {
              const total = day.methods.reduce((sum, it) => sum + it.amount, 0);
              return [
                row.method,
                IDR(row.amount),
                fmtPct(total ? (row.amount / total) * 100 : 0),
              ];
            })
          : [["-", IDR(0), fmtPct(0)]],
        foot: day.methods.length
          ? [[
              "Total",
              IDR(day.methods.reduce((sum, it) => sum + it.amount, 0)),
              fmtPct(100),
            ]]
          : undefined,
        columnStyles: {
          1: { halign: "right", cellWidth: 110 },
          2: { halign: "right", cellWidth: 62 },
        },
      })
    );
    y = doc.lastAutoTable.finalY + 20;
  }

  return y;
}

export function exportTransactionHistoryPDF(data, filters = {}, options = {}) {
  const sales = (Array.isArray(data) ? data : []).filter(
    (s) => String(s?.status || "").toLowerCase() !== "void"
  );
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const reportPeriod = `${fmtDate(filters?.from)} - ${fmtDate(filters?.to)}`;
  const ctx = { reportPeriod, headeredPages: new Set([1]) };
  const scopeLabel =
    options.selectedStoreLabel ||
    (filters?.storeId ? `Cabang ${filters.storeId}` : "Semua cabang");
  const totals = summarize(sales);
  const groups = groupByStore(sales, options);
  const branchRows = groups
    .map((group) => {
      const summary = summarize(group.sales);
      return {
        name: group.name,
        tx: summary.tx,
        itemsQty: summary.itemsQty,
        revenue: summary.revenue,
        additionalCharge: summary.additionalCharge,
        share: totals.revenue ? (summary.revenue / totals.revenue) * 100 : 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  let y = MARGIN;
  y = drawCover(doc, ctx, y, {
    period: reportPeriod,
    scope: scopeLabel,
    txCount: fmtNum(totals.tx),
    printedAt: fmtDateTime(new Date()),
  });

  y = sectionHeading(doc, "Ringkasan History Transaksi", y, scopeLabel);
  y = drawKpiCards(doc, y, [
    {
      label: "Total Pendapatan",
      value: IDR(totals.revenue),
      hint: "Akumulasi transaksi selesai",
      accent: COLOR.primary,
    },
    {
      label: "Total Transaksi",
      value: fmtNum(totals.tx),
      hint: "Jumlah transaksi tercatat",
      accent: COLOR.green,
    },
    {
      label: "Total Item Terjual",
      value: fmtNum(totals.itemsQty),
      hint: "Akumulasi qty item",
      accent: COLOR.primary,
    },
    {
      label: "Rata-rata / Transaksi",
      value: IDR(totals.aov),
      hint: "Average order value",
      accent: COLOR.green,
    },
    {
      label: "Total Diskon",
      value: IDR(totals.discounts),
      hint: "Potongan transaksi",
      accent: COLOR.amber,
    },
    {
      label: "Jumlah Cabang",
      value: fmtNum(groups.length),
      hint: "Cabang dengan transaksi",
      accent: COLOR.primary,
    },
  ]);

  y = ensureSpace(doc, ctx, y, 130);
  y = sectionHeading(doc, "Ringkasan Metode Pembayaran", y);
  autoTable(
    doc,
    tableOptions(doc, ctx, {
      startY: y,
      head: [["Metode Pembayaran", "Nominal", "Porsi"]],
      body: totals.paymentMix.length
        ? totals.paymentMix.map((row) => {
            const sum = totals.paymentMix.reduce((s, r) => s + r.amount, 0);
            return [
              row.method,
              IDR(row.amount),
              fmtPct(sum ? (row.amount / sum) * 100 : 0),
            ];
          })
        : [["-", IDR(0), fmtPct(0)]],
      foot: [[
        "Total",
        IDR(totals.paymentMix.reduce((s, r) => s + r.amount, 0)),
        fmtPct(totals.paymentMix.length ? 100 : 0),
      ]],
      columnStyles: {
        1: { halign: "right", cellWidth: 140 },
        2: { halign: "right", cellWidth: 70 },
      },
    })
  );

  for (const group of groups) {
    const summary = summarize(group.sales);
    y = startPage(doc, ctx);
    y = drawBranchBanner(doc, group.name, y);
    y = drawKpiCards(
      doc,
      y,
      [
        {
          label: "Pendapatan Cabang",
          value: IDR(summary.revenue),
          accent: COLOR.primary,
        },
        {
          label: "Transaksi",
          value: fmtNum(summary.tx),
          accent: COLOR.green,
        },
        {
          label: "Item Terjual",
          value: fmtNum(summary.itemsQty),
          accent: COLOR.primary,
        },
      ],
      3
    );

    y = sectionHeading(doc, "Breakdown Harian Transaksi", y, group.name);
    y = drawTransactionDailyDetail(doc, ctx, y, group.sales);

    y = ensureSpace(doc, ctx, y, 200);
    y = sectionHeading(doc, "Akumulasi Cabang", y, group.name);
    drawSummaryTables(doc, ctx, y, summary);
  }

  drawConclusion(doc, ctx, totals, branchRows, buildProductTotals(sales));
  paintFooters(doc, ctx);

  const from = filters?.from || "start";
  const to = filters?.to || "end";
  doc.save(`history-transactions_${from}_${to}.pdf`);
}


////// Wayoloh wayoloh ////



///// Patch is ended here pwease /////