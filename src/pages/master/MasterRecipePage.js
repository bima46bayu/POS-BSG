import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Edit, Trash2, ChefHat } from "lucide-react";
import toast from "react-hot-toast";

import DataTable from "../../components/data-table/DataTable";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import StoreScopeFilter from "../../components/common/StoreScopeFilter";
import { useStoreScopeFilter } from "../../hooks/useStoreScopeFilter";
import { getMe } from "../../api/users";
import { listStoreLocations } from "../../api/storeLocations";
import { getProducts } from "../../api/products";
import { listUnits } from "../../api/units";
import {
  listProductRecipes,
  createProductRecipe,
  updateProductRecipe,
  deleteProductRecipe,
} from "../../api/productRecipes";

const BRANCH_STORAGE_KEY = "master_recipe_store_id";
const PARENT_STORAGE_KEY = "master_recipe_parent_store_id";

function BaseModal({ open, title, onClose, children, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-xl shadow-xl border max-h-[90vh] flex flex-col">
        <div className="px-5 py-3 border-b flex items-center justify-between shrink-0">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
        <div className="px-5 py-3 border-t flex justify-end gap-3 shrink-0">{footer}</div>
      </div>
    </div>
  );
}

function emptyItem() {
  return { ingredient_product_id: "", qty: "", unit_id: "" };
}

function productUnitId(product) {
  return product?.unit_id ?? product?.unit?.id ?? "";
}

function productUnit(product) {
  return product?.unit_name ?? product?.unit?.name ?? "";
}

function productById(products, id) {
  if (id == null || id === "") return null;
  return products.find((p) => String(p.id) === String(id)) ?? null;
}

function normalizeUnitKey(name) {
  const key = String(name || "").toLowerCase().trim();
  const map = {
    kg: "kg",
    kilogram: "kg",
    kilograms: "kg",
    g: "g",
    gr: "g",
    gram: "g",
    grams: "g",
    l: "l",
    liter: "l",
    litre: "l",
    ltr: "l",
    ml: "ml",
    milliliter: "ml",
    millilitre: "ml",
  };
  return map[key] || key;
}

function unitFamily(name) {
  const key = normalizeUnitKey(name);
  if (key === "kg" || key === "g") return "mass";
  if (key === "l" || key === "ml") return "volume";
  return "other";
}

/** Units that can convert to the ingredient's catalog (stock) unit. */
function compatibleUnits(allUnits, stockUnitName) {
  if (!stockUnitName) return allUnits;
  const family = unitFamily(stockUnitName);
  if (family === "mass") {
    return allUnits.filter((u) => unitFamily(u.name) === "mass");
  }
  if (family === "volume") {
    return allUnits.filter((u) => unitFamily(u.name) === "volume");
  }
  const stockKey = normalizeUnitKey(stockUnitName);
  return allUnits.filter((u) => normalizeUnitKey(u.name) === stockKey);
}

function RecipeModal({
  open,
  onClose,
  onSubmit,
  loading,
  initial,
  finishedProducts,
  ingredientProducts,
  usedProductIds,
  units = [],
}) {
  const isEdit = !!initial;

  const [productId, setProductId] = useState("");
  const [items, setItems] = useState([emptyItem()]);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setProductId(String(initial.product_id ?? initial.product?.id ?? ""));
      setItems(
        (initial.items || []).length
          ? initial.items.map((r) => ({
              ingredient_product_id: String(r.ingredient_product_id ?? r.ingredient?.id ?? ""),
              qty: String(r.qty ?? ""),
              unit_id: String(
                r.unit_id ??
                  r.unit?.id ??
                  r.ingredient?.unit_id ??
                  r.ingredient?.unit?.id ??
                  ""
              ),
            }))
          : [emptyItem()]
      );
    } else {
      setProductId("");
      setItems([emptyItem()]);
    }
  }, [open, initial]);

  const availableFinished = useMemo(() => {
    if (isEdit) return finishedProducts;
    return finishedProducts.filter((p) => !usedProductIds.has(Number(p.id)));
  }, [finishedProducts, usedProductIds, isEdit]);

  const setItem = (idx, patch) => {
    setItems((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };

  const addRow = () => setItems((prev) => [...prev, emptyItem()]);
  const removeRow = (idx) =>
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));

  const valid =
    productId &&
    items.every(
      (r) => r.ingredient_product_id && r.unit_id && Number(r.qty) > 0
    );

  const finishedName = productById(finishedProducts, productId)?.name ?? "";

  return (
    <BaseModal
      open={open}
      title={isEdit ? "Edit Recipe" : "Add Recipe"}
      onClose={loading ? () => {} : onClose}
      footer={
        <>
          <button onClick={onClose} disabled={loading} className="px-3 py-2 border rounded-lg text-sm">
            Cancel
          </button>
          <button
            onClick={() =>
              onSubmit({
                product_id: Number(productId),
                items: items.map((r) => ({
                  ingredient_product_id: Number(r.ingredient_product_id),
                  qty: Number(r.qty),
                  unit_id: Number(r.unit_id),
                })),
              })
            }
            disabled={loading || !valid}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Finished Product</label>
          <select
            value={productId}
            disabled={isEdit}
            onChange={(e) => setProductId(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm bg-white disabled:bg-gray-50"
          >
            <option value="">— Select product —</option>
            {availableFinished.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Usually a non-stock product sold at POS (e.g. Pancake).
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Ingredients</label>
            <button type="button" onClick={addRow} className="text-xs text-blue-600">
              + Add row
            </button>
          </div>
          {finishedName ? (
            <p className="text-xs text-gray-600 mb-2">
              How much of each ingredient is used to make{" "}
              <span className="font-medium">1 {finishedName}</span> sold at POS.
            </p>
          ) : (
            <p className="text-xs text-gray-500 mb-2">
              Select a finished product first, then enter usage per 1 sale.
            </p>
          )}
          <div className="grid grid-cols-[1fr_5.5rem_5.5rem_2.5rem] gap-2 items-center px-1 mb-1">
            <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
              Ingredient
            </span>
            <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
              Amount
            </span>
            <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
              Unit
            </span>
            <span />
          </div>
          <div className="space-y-2">
            {items.map((row, idx) => {
              const ing = productById(ingredientProducts, row.ingredient_product_id);
              const stockUnit = productUnit(ing);
              const rowUnits = compatibleUnits(units, stockUnit);
              return (
              <div key={idx} className="space-y-1">
              <div className="flex gap-2 items-start">
                <select
                  value={row.ingredient_product_id}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    const nextIng = productById(ingredientProducts, nextId);
                    const nextStock = productUnit(nextIng);
                    const allowed = compatibleUnits(units, nextStock);
                    const defaultUnitId =
                      productUnitId(nextIng) ||
                      (allowed[0] ? String(allowed[0].id) : "");
                    setItem(idx, {
                      ingredient_product_id: nextId,
                      unit_id: String(defaultUnitId),
                    });
                  }}
                  className="flex-1 px-2 py-2 border rounded-lg text-sm min-w-0"
                >
                  <option value="">Select ingredient</option>
                  {ingredientProducts.map((p) => {
                    const u = productUnit(p);
                    return (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {u ? ` (stock: ${u})` : ""}
                      </option>
                    );
                  })}
                </select>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  placeholder={stockUnit ? "150" : "0"}
                  aria-label={
                    finishedName
                      ? `${ing?.name ?? "Ingredient"} used per 1 ${finishedName}`
                      : "Ingredient usage per sale"
                  }
                  value={row.qty}
                  onChange={(e) => setItem(idx, { qty: e.target.value })}
                  className="w-[5.5rem] px-2 py-2 border rounded-lg text-sm shrink-0"
                />
                <select
                  value={row.unit_id}
                  onChange={(e) => setItem(idx, { unit_id: e.target.value })}
                  className="w-[5.5rem] px-2 py-2 border rounded-lg text-sm shrink-0 bg-white"
                  title="Recipe unit (convertible to stock unit at POS)"
                >
                  <option value="">Unit</option>
                  {rowUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {ing && unitFamily(stockUnit) === "mass" && /air|water|minum|liquid/i.test(ing.name || "") && (
                <p className="text-xs text-amber-700 pl-1">
                  {ing.name} uses stock unit <b>{stockUnit}</b> (weight). For volume (Ml/L), edit
                  this product in Catalog and set unit to <b>L</b> or <b>Ml</b>.
                </p>
              )}
              </div>
            );
            })}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Recipe unit must match the ingredient&apos;s stock type: weight (Kg/Gram) or volume
            (L/Ml). Example: 200 Gram flour if stock is Kg; 150 Ml water if stock is L/Ml.
          </p>
        </div>
      </div>
    </BaseModal>
  );
}

export default function MasterRecipePage() {
  const qc = useQueryClient();
  const [me, setMe] = useState(null);
  const [stores, setStores] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  const {
    parentFilterId,
    storeFilterId,
    effectiveStoreId,
    canPickStore,
    needsStoreSelection,
    activeStoreLabel,
    handleParentChange,
    handleBranchChange,
  } = useStoreScopeFilter({
    branchStorageKey: BRANCH_STORAGE_KEY,
    parentStorageKey: PARENT_STORAGE_KEY,
    me,
    stores,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const profile = await getMe();
        if (!cancelled) setMe(profile);
      } catch {
        if (!cancelled) setMe(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!canPickStore) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await listStoreLocations({ page: 1, per_page: 200 });
        if (!cancelled) setStores(res?.items || []);
      } catch {
        if (!cancelled) setStores([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canPickStore]);

  const { data: recipes = [], isLoading } = useQuery({
    queryKey: ["product-recipes", effectiveStoreId],
    enabled: effectiveStoreId != null,
    queryFn: ({ signal }) =>
      listProductRecipes({ store_location_id: effectiveStoreId }, signal).then(
        (r) => (Array.isArray(r.data) ? r.data : r.data?.data ?? [])
      ),
  });

  const { data: productRes } = useQuery({
    queryKey: ["recipe-products", effectiveStoreId],
    enabled: effectiveStoreId != null,
    queryFn: ({ signal }) =>
      getProducts({ per_page: 500, store_location_id: effectiveStoreId }, signal),
  });

  const allProducts = useMemo(
    () => productRes?.items ?? [],
    [productRes]
  );

  const finishedProducts = useMemo(
    () => allProducts.filter((p) => p.inventory_type !== "stock"),
    [allProducts]
  );

  const ingredientProducts = useMemo(
    () => allProducts.filter((p) => p.inventory_type === "stock"),
    [allProducts]
  );

  const usedProductIds = useMemo(
    () => new Set(recipes.map((r) => Number(r.product_id))),
    [recipes]
  );

  const { data: units = [] } = useQuery({
    queryKey: ["recipe-units"],
    queryFn: () => listUnits({ per_page: 100 }),
    staleTime: 5 * 60_000,
  });

  const mCreate = useMutation({
    mutationFn: (payload) =>
      createProductRecipe({ ...payload, store_location_id: effectiveStoreId }),
    onSuccess: () => {
      toast.success("Recipe saved");
      setShowAdd(false);
      qc.invalidateQueries({ queryKey: ["product-recipes"] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || "Failed to save"),
  });

  const mUpdate = useMutation({
    mutationFn: ({ id, payload }) => updateProductRecipe(id, payload),
    onSuccess: () => {
      toast.success("Recipe updated");
      setEditTarget(null);
      qc.invalidateQueries({ queryKey: ["product-recipes"] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || "Failed to update"),
  });

  const mDelete = useMutation({
    mutationFn: deleteProductRecipe,
    onSuccess: () => {
      toast.success("Recipe deleted");
      setConfirmDel(null);
      qc.invalidateQueries({ queryKey: ["product-recipes"] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || "Failed to delete"),
  });

  const columns = useMemo(
    () => [
      {
        key: "product",
        header: "Product",
        cell: (r) => (
          <div className="flex items-center gap-2">
            <ChefHat className="w-4 h-4 text-gray-400" />
            <span className="font-medium">{r.product?.name ?? r.product_id}</span>
          </div>
        ),
      },
      {
        key: "items",
        header: "Ingredients",
        cell: (r) => (
          <span className="text-sm text-gray-600">
            {(r.items || [])
              .map((i) => {
                const name = i.ingredient?.name ?? i.ingredient_product_id;
                const unit =
                  i.unit?.name ??
                  i.unit_name ??
                  i.ingredient?.unit_name ??
                  i.ingredient?.unit?.name ??
                  "";
                const qty = Number(i.qty);
                return unit ? `${name}: ${qty} ${unit}` : `${name}: ${qty}`;
              })
              .join(" · ") || "—"}
          </span>
        ),
      },
      {
        key: "is_active",
        header: "Active",
        cell: (r) => (
          <span className={`text-xs ${r.is_active ? "text-green-600" : "text-gray-400"}`}>
            {r.is_active ? "Yes" : "No"}
          </span>
        ),
      },
      {
        key: "__actions",
        header: "Action",
        align: "center",
        cell: (r) => (
          <div className="flex justify-center gap-1.5">
            <button
              onClick={() => setEditTarget(r)}
              className="inline-flex items-center h-8 px-2 bg-blue-600 text-white rounded-lg text-xs"
            >
              <Edit className="w-4 h-4 mr-1" />
              Edit
            </button>
            <button
              onClick={() => setConfirmDel(r)}
              className="inline-flex items-center justify-center h-8 w-8 bg-red-500 text-white rounded-lg"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ),
      },
    ],
    []
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen space-y-4">
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <h2 className="text-lg font-semibold">Product Recipes</h2>
        <p className="text-sm text-gray-500">
          Define ingredients consumed when a finished product is sold (e.g. Pancake → flour, water).
        </p>
        <div className="mt-3">
          <StoreScopeFilter
            stores={stores}
            me={me}
            parentId={parentFilterId}
            branchId={storeFilterId}
            onParentChange={handleParentChange}
            onBranchChange={handleBranchChange}
            canPickStore={canPickStore}
            lockedLabel={activeStoreLabel}
          />
        </div>
      </div>

      {needsStoreSelection && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-4 py-3">
          Select parent store and branch to manage recipes.
        </div>
      )}

      <div className="bg-white p-4 rounded-lg shadow-sm border flex justify-end">
        <button
          onClick={() => setShowAdd(true)}
          disabled={effectiveStoreId == null || finishedProducts.length === 0}
          className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          Add Recipe
        </button>
      </div>

      <div className="bg-white border rounded-lg">
        <DataTable
          columns={columns}
          data={recipes}
          loading={isLoading}
          getRowKey={(r) => r.id}
        />
      </div>

      <RecipeModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        loading={mCreate.isPending}
        finishedProducts={finishedProducts}
        ingredientProducts={ingredientProducts}
        usedProductIds={usedProductIds}
        units={units}
        onSubmit={(payload) => mCreate.mutate(payload)}
      />

      <RecipeModal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        loading={mUpdate.isPending}
        initial={editTarget}
        finishedProducts={finishedProducts}
        ingredientProducts={ingredientProducts}
        usedProductIds={usedProductIds}
        units={units}
        onSubmit={(payload) =>
          mUpdate.mutate({ id: editTarget.id, payload })
        }
      />

      <ConfirmDialog
        open={!!confirmDel}
        title="Delete Recipe"
        message={
          confirmDel && (
            <>
              Delete recipe for <b>{confirmDel.product?.name}</b>?
            </>
          )
        }
        onClose={() => setConfirmDel(null)}
        onConfirm={() => mDelete.mutate(confirmDel.id)}
      />
    </div>
  );
}
