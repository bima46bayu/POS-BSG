import React from 'react';

const OrderItem = ({ item, onUpdateQuantity, onUpdateDiscount, onRemove }) => {
  const unitPrice = Number(item.price || 0);
  const qty = Number(item.quantity || 0);

  // default: persen (ganti ke 'rp' kalau mau nominal)
  const discountType = item.discount_type || '%';
  const rawDiscountValue = item.discount_value;

  // tampil: kosongkan ketika 0/null
  const discountValueDisplay =
    rawDiscountValue == null || Number(rawDiscountValue) === 0
      ? ''
      : String(rawDiscountValue);

  // hitung diskon/nominal per unit
  const discountValueNum = Number(rawDiscountValue || 0);
  const discountNominal =
    discountType === '%'
      ? Math.min(unitPrice, (unitPrice * discountValueNum) / 100)
      : Math.min(unitPrice, discountValueNum);

  const netUnitPrice = Math.max(0, unitPrice - discountNominal);
  const lineTotal = netUnitPrice * qty;

  const formatCurrency = (amount) =>
    `Rp${Number(amount || 0).toLocaleString('id-ID')}`;

  const handleDiscountValueChange = (e) => {
    const valStr = e.target.value; // '' saat kosong
    const valNum = valStr === '' ? 0 : Number(valStr);
    if (Number.isNaN(valNum)) return;
    onUpdateDiscount?.(item.id, { discount_type: discountType, discount_value: valNum });
  };

  const handleDiscountTypeChange = (e) => {
    const type = e.target.value;
    onUpdateDiscount?.(item.id, { discount_type: type, discount_value: discountValueNum });
  };

  // Tambahkan helper komponen kecil di atas export:
  function ProductThumb({ src, alt }) {
    const [err, setErr] = React.useState(false);
    if (!src || err) {
      return (
        <div className="w-12 h-12 rounded bg-gray-200 text-gray-500 text-[10px] font-bold
                        flex items-center justify-center border border-gray-300">
          N/A
        </div>
      );
    }
    return (
      <img
        src={src}
        alt={alt || "product"}
        loading="lazy"
        onError={() => setErr(true)}
        className="w-12 h-12 rounded object-cover border border-gray-300 bg-white"
      />
    );
  }

  return (
    <div className="flex items-start justify-between py-3 border-b">
      {/* LEFT: logo + info + (diskon & hapus di satu baris) */}
      <div className="flex items-start space-x-3 flex-1">
        <div className="shrink-0">
          <ProductThumb src={item.image || item.thumbnail_url || item.photo_url} alt={item.name} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-gray-800 font-medium truncate">{item.name}</div>
          <div className="text-xs text-gray-500">Harga: {formatCurrency(unitPrice)}</div>

          {/* Diskon/u + Hapus (SEBARIS) */}
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            {/* <label className="text-xs text-gray-500">Diskon</label> */}
            <select
              value={discountType}
              onChange={handleDiscountTypeChange}
              className="rounded border border-gray-300 text-sm px-1 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="rp">Rp</option>
              <option value="%">%</option>
            </select>
            <input
              type="number"
              min={0}
              max={discountType === '%' ? 100 : undefined}
              step={discountType === '%' ? 1 : 100}
              value={discountValueDisplay}
              onChange={handleDiscountValueChange}
              className="w-24 rounded border border-gray-300 px-2 py-1 text-sm text-gray-700 text-right focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder={discountType === '%' ? 'Discount' : 'Discount'}
            />

            {/* dorong tombol ke kanan baris ini
            <div className="grow" />
            {onRemove && (
              <button
                onClick={() => onRemove(item.id)}
                className="text-xs text-red-600 hover:underline"
              >
                Hapus
              </button>
            )} */}
          </div>
        </div>
      </div>

      {/* RIGHT: qty controls + price summary */}
      <div className="ml-3 flex flex-col items-end gap-2 shrink-0">
        {/* Qty controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onUpdateQuantity(item.id, -1)}
            className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-300"
          >
            –
          </button>
          <span className="text-sm font-medium w-6 text-center">{qty}</span>
          <button
            onClick={() => onUpdateQuantity(item.id, 1)}
            className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white hover:bg-blue-600"
          >
            +
          </button>
        </div>

        {/* Price summary */}
        <div className="text-right">
          <div className="text-sm font-medium text-gray-800">
            {formatCurrency(lineTotal)}
          </div>
          <div className="text-[11px] text-gray-500">
            ({qty} × {formatCurrency(discountNominal > 0 ? netUnitPrice : unitPrice)})
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderItem;
