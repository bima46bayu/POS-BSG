import React, { useCallback, useMemo, useEffect } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import SearchBar from "../components/pos/SearchBar";
import ProductGrid from "../components/pos/ProductGrid";
import OrderDetails from "../components/pos/OrderDetails";
import MobileOrderSheet from "../components/pos/MobileOrderSheet";
import SaleSubmitter from "../components/pos/SaleSubmitter";
import { ShoppingCart, ChevronUp } from "lucide-react";

import { getProducts, getProductBySKU } from "../api/products";
import { getCategories, getSubCategories } from "../api/categories";

const PER_PAGE = 20;
const TAX_RATE = 0.11;

// Normalizer: samakan bentuk data product untuk FE
const normalize = (p) => ({
  id: p.id ?? p.product_id ?? p.sku,
  name: p.name ?? p.product_name ?? p.nama ?? "Tanpa Nama",
  price: Number(p.price ?? p.unit_price ?? p.sale_price ?? 0),
  image: p.image_url || p.image || p.thumbnail_url || p.photo_url || null,
  stock: p.stock ?? p.qty ?? p.quantity ?? 0,
  sku: p.sku ?? p.barcode ?? null,
  category_id: p.category_id,
  sub_category_id: p.sub_category_id,
});

export default function POSPage() {
  // ===== Local UI states =====
  const [q, setQ] = React.useState("");
  const [filters, setFilters] = React.useState({
    category_id: undefined,
    sub_category_id: undefined,
    stock_status: "any", // any|available|out
  });
  const [pickedCategory, setPickedCategory] = React.useState(undefined);

  const [cartItems, setCartItems] = React.useState([]);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  // ===== Categories (cached) =====
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

  // ===== Products (infinite) =====
  const productsQuery = useInfiniteQuery({
    queryKey: ["products", { q, ...filters }],
    queryFn: async ({ pageParam = 1 }) => {
      const params = {
        search: q || undefined,
        page: pageParam,
        per_page: PER_PAGE,
        category_id: filters.category_id,
        sub_category_id: filters.sub_category_id,
        in_stock: filters.stock_status === "available" ? 1 : undefined,
        out_of_stock: filters.stock_status === "out" ? 1 : undefined,
      };
      const res = await getProducts(params);
      return res; // { items, meta } atau { items: [], meta: {} }
    },
    getNextPageParam: (lastPage) => {
      const m = lastPage?.meta;
      if (m && m.current_page < m.last_page) return m.current_page + 1;
      return undefined;
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

  const hasMore = !!productsQuery.hasNextPage;
  const loading = productsQuery.isFetching && !productsQuery.isFetchingNextPage;
  const loadingMore = productsQuery.isFetchingNextPage;
  const err = productsQuery.isError ? "Gagal memuat produk" : "";

  // ===== Cart handlers =====
  const handleAddToCart = useCallback((product) => {
    setCartItems((prev) => {
      const exist = prev.find((i) => i.id === product.id);
      return exist
        ? prev.map((i) => (i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i))
        : [...prev, { ...product, quantity: 1 }];
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

  const handleRemoveItem = useCallback((id) => {
    setCartItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  // ===== Search / Filter / Category pick / Scan =====
  const handleSearch = useCallback((text) => setQ(text), []);
  const handleFilterChange = useCallback((f) => setFilters(f), []);
  const handlePickCategory = useCallback((catId) => setPickedCategory(catId || undefined), []);
  const handleScan = useCallback(
    async (code) => {
      try {
        const p = await getProductBySKU(code);
        if (!p) return alert(`Kode ${code} tidak ditemukan`);
        handleAddToCart(normalize(p));
      } catch (e) {
        console.error(e);
        alert("Scanner error. Coba lagi.");
      }
    },
    [handleAddToCart]
  );

  // ===== Totals (subtotal before tax, tax 11%, total) =====
  const subtotalItems = useMemo(
    () => cartItems.reduce((s, i) => s + (i.price || 0) * (i.quantity || 0), 0),
    [cartItems]
  );
  const tax = useMemo(() => Math.round(subtotalItems * TAX_RATE), [subtotalItems]);
  const total = subtotalItems + tax;

  // ===== Infinite scroll trigger =====
  useEffect(() => {
    function onScroll() {
      if (!hasMore || productsQuery.isFetchingNextPage) return;
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 200) {
        productsQuery.fetchNextPage();
      }
    }
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [hasMore, productsQuery.isFetchingNextPage, productsQuery.fetchNextPage]);

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-50">
      {/* Main Content */}
      <main className="order-1 flex-1 p-4 sm:p-5 md:p-6 overflow-y-auto pb-20 md:pb-0">
        <div className="max-w-6xl mx-auto">
          <SearchBar
            onSearch={handleSearch}
            onScan={handleScan}
            onFilterChange={handleFilterChange}
            categories={categories}
            subCategories={subCategories}
            onPickCategory={handlePickCategory}
          />

          {loading && <div className="text-gray-500 mb-3">Loading products…</div>}
          {err && <div className="text-red-600 mb-3">{err}</div>}
          {!loading && !err && flatProducts.length === 0 && (
            <div className="text-gray-500 mb-3">Tidak ada produk.</div>
          )}

          <ProductGrid products={flatProducts} onAddToCart={handleAddToCart} />

          {loadingMore && <div className="text-center py-3 text-gray-500">Loading more…</div>}
          {!hasMore && flatProducts.length > 0 && (
            <div className="text-center py-3 text-gray-400 text-sm">Semua produk sudah ditampilkan</div>
          )}
        </div>
      </main>

      {/* Desktop order panel */}
      <aside className="hidden md:block order-2 w-full md:w-[340px] lg:w-[400px] xl:w-[480px]
                        bg-white border-t md:border-t-0 md:border-l border-gray-200
                        p-4 sm:p-5 md:p-6 overflow-y-auto md:sticky md:top-0 md:h-screen">
        <OrderDetails
          items={cartItems}
          onUpdateQuantity={handleUpdateQuantity}
          onRemoveItem={handleRemoveItem}
        />

        {/* Payment + Summary + Mutation ada di dalam SaleSubmitter */}
        <SaleSubmitter
          items={cartItems}
          subtotal={subtotalItems}
          tax={tax}
          total={total}
          onSuccess={(res) => {
            setCartItems([]);
            alert(`Transaction success! Code: ${res?.code || res?.id || "-"}`);
          }}
          onCancel={() => setCartItems([])}
          showSummary={true}
        />
      </aside>

      {/* Mobile mini bar (drop-up trigger) */}
      <div className="md:hidden fixed left-0 right-0 bottom-0 z-40 bg-white border-t border-gray-200">
        <button
          onClick={() => setSheetOpen(true)}
          className="w-full h-14 px-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-gray-700" />
            <span className="text-sm font-medium">Cart ({cartItems.length})</span>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">Total</div>
            <div className="text-sm font-semibold">Rp{total.toLocaleString("id-ID")}</div>
          </div>
          <ChevronUp className="h-5 w-5 text-gray-500" />
        </button>
      </div>

      {/* Mobile sheet */}
      <MobileOrderSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        items={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        // SaleSubmitter dirender di dalam sheet (lihat file komponen)
        subtotal={subtotalItems}
        tax={tax}
        total={total}
        onClearCart={() => setCartItems([])}
      />
    </div>
  );
}
