// src/pages/POSPage.jsx
import React, { useCallback, useMemo, useEffect } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import SearchBar from "../components/pos/SearchBar";
import ProductGrid from "../components/pos/ProductGrid";
import OrderDetails from "../components/pos/OrderDetails";
import MobileOrderSheet from "../components/pos/MobileOrderSheet";
import SaleSubmitter from "../components/pos/SaleSubmitter";
import { ShoppingCart, ChevronUp } from "lucide-react";
import toast from "react-hot-toast";

import { getProducts, getProductBySKU } from "../api/products";
import { getCategories, getSubCategories } from "../api/categories";
import { getMe } from "../api/users";
import { listStoreLocations } from "../api/storeLocations";
import { toAbsoluteUrl } from "../api/client";
import { listDiscounts } from "../api/discounts";
import { listAdditionalCharges } from "../api/additionalCharges";

const PER_PAGE = 30;
const TAX_RATE = 0;

/* ===== Debounce util ===== */
function useDebouncedValue(value, delay = 300) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

/* ===== Normalizer produk (pakai inventory_type) ===== */
const normalize = (p) => {
  // backend: products.inventory_type (stock | non_stock | service | bundle | dll)
  const inventoryTypeRaw =
    p.inventory_type ??
    p.inventoryType ??
    p.type ??
    "stock"; // default: stock

  const inventoryType = String(inventoryTypeRaw || "stock").toLowerCase();

  // Hanya inventory_type = "stock" yang benar-benar pakai stok fisik
  const isStockTracked = inventoryType === "stock";

  return {
    id: p.id ?? p.product_id ?? p.sku,
    name: p.name ?? p.product_name ?? p.nama ?? "Tanpa Nama",
    price: Number(p.price ?? p.unit_price ?? p.sale_price ?? 0),
    image: toAbsoluteUrl(
      p.image_url || p.image || p.thumbnail_url || p.photo_url || null
    ),
    stock: p.stock ?? p.qty ?? p.quantity ?? 0,
    sku: p.sku ?? p.barcode ?? null,
    category_id: p.category_id,
    sub_category_id: p.sub_category_id,
    inventoryType,     // ⬅️ simpan tipe
    isStockTracked,    // ⬅️ dipakai di FE
  };
};

export default function POSPage() {
  /* ===== UI states ===== */
  const [q, setQ] = React.useState("");
  const debouncedQ = useDebouncedValue(q, 300);

  const [filters, setFilters] = React.useState({
    category_id: undefined,
    sub_category_id: undefined,
    stock_status: "any",
  });
  const [pickedCategory, setPickedCategory] = React.useState(undefined);

  const [cartItems, setCartItems] = React.useState([]);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  // ===== Discount master (NEW) =====
  const [itemDiscounts, setItemDiscounts] = React.useState([]);
  const [globalDiscounts, setGlobalDiscounts] = React.useState([]);

  /* ===== /api/me (role & store) ===== */
  const meQ = useQuery({
    queryKey: ["me"],
    queryFn: ({ signal }) => getMe(signal),
    retry: 1,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const role = (meQ.data?.role || "").toLowerCase();
  const isAdmin = role === "admin";
  const myStoreIdFromMe = meQ.isSuccess
    ? meQ.data?.store_location?.id ?? meQ.data?.store_location_id ?? null
    : null;

  /* ===== stores (untuk admin) ===== */
  const storesQ = useQuery({
    queryKey: ["stores", { per_page: 200 }],
    queryFn: ({ signal }) => listStoreLocations({ per_page: 200 }, signal),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: isAdmin || meQ.isError,
  });
  const stores = storesQ.data?.items ?? [];

  /* ===== selected store ===== */
  const [selectedStoreId, setSelectedStoreId] = React.useState(undefined);

  // default dari /api/me
  useEffect(() => {
    if (meQ.isSuccess && selectedStoreId === undefined) {
      if (isAdmin) {
        setSelectedStoreId(
          myStoreIdFromMe != null ? String(myStoreIdFromMe) : "ALL"
        );
      } else {
        setSelectedStoreId(
          myStoreIdFromMe != null ? String(myStoreIdFromMe) : ""
        );
      }
    }
  }, [meQ.isSuccess, isAdmin, myStoreIdFromMe, selectedStoreId]);

  // fallback jika /api/me error → admin-like dengan ALL
  useEffect(() => {
    if (meQ.isError && selectedStoreId === undefined) {
      setSelectedStoreId("ALL");
    }
  }, [meQ.isError, selectedStoreId]);

  /* ===== FETCH DISCOUNT MASTER (NEW) ===== */
  useEffect(() => {
    if (!selectedStoreId) return;

    const storeId =
      selectedStoreId !== "ALL" ? Number(selectedStoreId) : undefined;

    listDiscounts({
      scope: "ITEM",
      active: 1,
      store_location_id: storeId,
    }).then((res) => setItemDiscounts(res.items || []));

    listDiscounts({
      scope: "GLOBAL",
      active: 1,
      store_location_id: storeId,
    }).then((res) => setGlobalDiscounts(res.items || []));
  }, [selectedStoreId]);

  /* ===== Categories ===== */
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
    staleTime: 30 * 60 * 1000,
  });

  const { data: subCategories = [] } = useQuery({
    queryKey: ["subCategories", pickedCategory || null],
    queryFn: () => getSubCategories(pickedCategory),
    enabled: !!pickedCategory,
    staleTime: 30 * 60 * 1000,
  });

  const mainScrollRef = React.useRef(null);

  /* ===== Products (infinite) ===== */
  const productsQuery = useInfiniteQuery({
    queryKey: [
      "products",
      { q: debouncedQ, ...filters, scope: selectedStoreId ?? "NONE" },
    ],
    queryFn: async ({ pageParam = 1, signal }) => {
      const isAll = selectedStoreId === "ALL";
      const params = {
        search: debouncedQ || undefined,
        page: pageParam,
        per_page: PER_PAGE,
        category_id: filters.category_id,
        sub_category_id: filters.sub_category_id,
        in_stock: filters.stock_status === "available" ? 1 : undefined,
        out_of_stock: filters.stock_status === "out" ? 1 : undefined,
        store_id: !isAll && selectedStoreId ? Number(selectedStoreId) : undefined,
        only_store: !isAll && selectedStoreId ? 1 : undefined,
      };
      return getProducts(params, signal);
    },
    enabled: selectedStoreId !== undefined && (isAdmin || !!selectedStoreId),
    getNextPageParam: (lastPage) => {
      const m = lastPage?.meta;
      return m && m.current_page < m.last_page ? m.current_page + 1 : undefined;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    keepPreviousData: true,
  });

  const flatProducts = useMemo(() => {
    const pages = productsQuery.data?.pages || [];
    const merged = pages.flatMap((p) => (p.items || []).map(normalize));
    const map = new Map(merged.map((x) => [x.id, x]));
    return Array.from(map.values());
  }, [productsQuery.data]);

  /* ===== Filter stok di FE (aware non-stock) =====
     available: semua non-stock + stock qty>0
     out      : hanya produk stock qty<=0
  */
  const filteredProducts = useMemo(() => {
    let arr = flatProducts;

    if (filters.stock_status === "available") {
      arr = arr.filter((p) => {
        if (!p.isStockTracked) return true; // non-stock/service selalu available
        return Number(p.stock ?? 0) > 0;
      });
    } else if (filters.stock_status === "out") {
      arr = arr.filter(
        (p) => p.isStockTracked && Number(p.stock ?? 0) <= 0
      );
    }

    return arr;
  }, [flatProducts, filters.stock_status]);

  const hasMore = !!productsQuery.hasNextPage;
  const loading =
    (productsQuery.isFetching && !productsQuery.isFetchingNextPage) ||
    meQ.isLoading ||
    (isAdmin && storesQ.isLoading && selectedStoreId === undefined);
  const loadingMore = productsQuery.isFetchingNextPage;
  const err =
    productsQuery.isError
      ? "Gagal memuat produk"
      : storesQ.isError && isAdmin
      ? "Gagal memuat daftar cabang"
      : meQ.isError
      ? "Gagal memuat data user"
      : "";

  /* ===== Cart handlers ===== */
  const handleAddToCart = useCallback((product) => {
    setCartItems((prev) => {
      const exist = prev.find((i) => i.id === product.id);
      return exist
        ? prev.map((i) =>
            i.id === product.id
              ? { ...i, quantity: i.quantity + 1 }
              : i
          )
        : [
            ...prev,
            {
              ...product,
              quantity: 1,
              discount_type: "%",
              discount_value: 0,
            },
          ];
    });
  }, []);

  const handleUpdateQuantity = useCallback((id, change) => {
    setCartItems((prev) =>
      prev
        .map((item) =>
          item.id !== id
            ? item
            : item.quantity + change > 0
            ? { ...item, quantity: item.quantity + change }
            : null
        )
        .filter(Boolean)
    );
  }, []);

  const handleUpdateDiscount = useCallback(
    (id, payload) => {
      setCartItems((prev) =>
        prev.map((it) =>
          it.id === id ? { ...it, ...payload } : it
        )
      );
    },
    []
  );

  const handleRemoveItem = useCallback((id) => {
    setCartItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  /* ===== Search / Filter / Category pick / Scan ===== */
  const handleSearch = useCallback((text) => setQ(text), []);
  const handleFilterChange = useCallback((f) => setFilters(f), []);
  const handlePickCategory = useCallback(
    (catId) => setPickedCategory(catId || undefined),
    []
  );

  const handleScan = useCallback(
    async (code) => {
      try {
        const cleanCode = code.trim().toUpperCase();
        const isAll = selectedStoreId === "ALL";

        const p = await getProductBySKU(
          cleanCode,
          isAll ? {} : { store_id: Number(selectedStoreId), only_store: 1 }
        );

        if (!p) return toast.error(`Kode ${cleanCode} tidak ditemukan`);
        if (p.sku?.toUpperCase() !== cleanCode) {
          console.warn(`SKU mismatch: expected ${cleanCode}, got ${p.sku}`);
          return toast.error(`Produk tidak ditemukan`);
        }
        // pakai normalize supaya inventoryType & isStockTracked ikut
        handleAddToCart(normalize(p));
        toast.success(`${p.name} ditambahkan ke cart`);
      } catch (e) {
        console.error(e);
        toast.error("Scanner error. Coba lagi.");
      }
    },
    [handleAddToCart, selectedStoreId]
  );

  /* ===== Totals ===== */
  const subtotalItems = useMemo(() => {
    return cartItems.reduce((s, i) => {
      const price = Number(i.price || 0);
      const qty = Number(i.quantity || 0);
      const type = i.discount_type || "%";
      const val = Number(i.discount_value || 0);

      const discNominal = Math.min(
        price,
        type === "%" ? (price * val) / 100 : val
      );

      const netUnit = Math.max(0, price - discNominal);
      return s + netUnit * qty;
    }, 0);
  }, [cartItems]);
  const tax = useMemo(
    () => Math.round(subtotalItems * TAX_RATE),
    [subtotalItems]
  );
  const total = subtotalItems + tax;

  // ===== Additional Charges (PB1 / Service) =====
  const [additionalCharges, setAdditionalCharges] = React.useState([]);

  useEffect(() => {
    if (!selectedStoreId) return;

    const storeId =
      selectedStoreId !== "ALL" ? Number(selectedStoreId) : undefined;

    // ITEM DISCOUNT
    listDiscounts({
      scope: "ITEM",
      active: 1,
      store_location_id: storeId,
    }).then((res) => setItemDiscounts(res.items || []));

    // GLOBAL DISCOUNT
    listDiscounts({
      scope: "GLOBAL",
      active: 1,
      store_location_id: storeId,
    }).then((res) => setGlobalDiscounts(res.items || []));

    // 🔥 ADDITIONAL CHARGE (PB1 & SERVICE)
    listAdditionalCharges().then((res) =>
      setAdditionalCharges(res.data || [])
    );
  }, [selectedStoreId]);

  /* ===== Infinite scroll trigger ===== */
  useEffect(() => {
    const el = mainScrollRef.current;
    if (!el) return;

    function onScroll() {
      if (!hasMore || productsQuery.isFetchingNextPage) return;

      const { scrollTop, scrollHeight, clientHeight } = el;

      if (scrollTop + clientHeight >= scrollHeight - 200) {
        productsQuery.fetchNextPage();
      }
    }

    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [hasMore, productsQuery.isFetchingNextPage]);

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-50">
      {/* Main Content */}
      <main className="order-1 flex-1 flex flex-col relative bg-gray-50">

        {/* ===== SearchBar (Sticky Header) ===== */}
        <div className="sticky top-0 z-30 bg-gray-50">
          <div className="max-w-6xl mx-auto px-3 sm:px-5 md:px-6 py-2 sm:py-3">
            <SearchBar
              onSearch={handleSearch}
              onScan={handleScan}
              onFilterChange={handleFilterChange}
              categories={categories}
              subCategories={subCategories}
              onPickCategory={setPickedCategory}
              showStoreSelector={isAdmin}
              storeOptions={[
                { value: "ALL", label: "Semua" },
                ...stores.map((s) => ({
                  value: String(s.id),
                  label: s.name,
                })),
              ]}
              selectedStoreId={selectedStoreId || "ALL"}
              onChangeStore={(val) => setSelectedStoreId(val || "ALL")}
              storeDisabled={storesQ.isLoading}
            />
          </div>
        </div>

        {/* ===== Product Scroll Area ===== */}
        <div
          ref={mainScrollRef}
          className="flex-1 overflow-y-auto"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-5 md:px-6 pt-4 pb-24">

            {loading && (
              <div className="text-gray-500 mb-3">Loading products…</div>
            )}

            {err && (
              <div className="text-red-600 mb-3">{err}</div>
            )}

            {!loading && !err && filteredProducts.length === 0 && (
              <div className="text-gray-500 mb-3">
                {isAdmin && selectedStoreId === "ALL"
                  ? "Tidak ada produk (semua cabang)."
                  : "Tidak ada produk di cabang ini."}
              </div>
            )}

            <ProductGrid
              products={filteredProducts}
              onAddToCart={handleAddToCart}
            />

            {loadingMore && (
              <div className="text-center py-3 text-gray-500">
                Loading more…
              </div>
            )}

            {!hasMore && filteredProducts.length > 0 && (
              <div className="text-center py-3 text-gray-400 text-sm">
                Semua produk sudah ditampilkan
              </div>
            )}

          </div>
        </div>

      </main>

      {/* Desktop order panel */}
      <aside
        className="hidden md:block order-2 w-full md:w-[340px] lg
        md:w-[400px] xl:w-[480px]
                   bg-white border-t md:border-t-0 md:border-l border-gray-200
                   p-4 sm:p-5 md:p-6 overflow-y-auto md:sticky md:top-0 md:h-screen
                   relative z-10"
      >
        <OrderDetails
          items={cartItems}
          itemDiscounts={itemDiscounts}
          onUpdateQuantity={handleUpdateQuantity}
          onUpdateDiscount={handleUpdateDiscount}
          onRemoveItem={handleRemoveItem}
        />

        <SaleSubmitter
          items={cartItems}
          subtotal={subtotalItems}
          tax={tax}
          additionalCharges={additionalCharges}
          total={total}
          globalDiscounts={globalDiscounts}
          onSuccess={(res) => {
            setCartItems([]);
            toast.success(
              `Transaction success! Code: ${res?.code || res?.id || "-"}`
            );
          }}
          onCancel={() => setCartItems([])}
          showSummary={true}
          extraPayload={{
            store_location_id:
              selectedStoreId && selectedStoreId !== "ALL"
                ? Number(selectedStoreId)
                : undefined,
          }}
        />
      </aside>

      {/* Mobile mini bar */}
      <div className="md:hidden fixed left-0 right-0 bottom-0 z-40 bg-white border-t border-gray-200">
        <button
          onClick={() => setSheetOpen(true)}
          className="w-full h-14 px-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-gray-700" />
            <span className="text-sm font-medium">
              Cart ({cartItems.length})
            </span>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">Total</div>
            <div className="text-sm font-semibold">
              Rp{total.toLocaleString("id-ID")}
            </div>
          </div>
          <ChevronUp className="h-5 w-5 text-gray-500" />
        </button>
      </div>

      {/* Mobile sheet */}
      <MobileOrderSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        items={cartItems}
        itemDiscounts={itemDiscounts}     // ✅ NEW
        globalDiscounts={globalDiscounts}
        onUpdateQuantity={handleUpdateQuantity}
        onUpdateDiscount={handleUpdateDiscount}
        onRemoveItem={handleRemoveItem}
        subtotal={subtotalItems}
        tax={tax}
        total={total}
        additionalCharges={additionalCharges}
        onClearCart={() => setCartItems([])}
      />
    </div>
  );
}
