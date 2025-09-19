import { api } from "./client";

/**
 * Payload yang cocok dengan backend kamu (contoh minimal):
 * {
 *   cashier_id: 1,                 // opsional kalau BE ambil dari token
 *   customer_name: "Budi",
 *   discount: 0,
 *   tax: 0,
 *   items: [
 *     { product_id: 1, price: 120000, qty: 2, subtotal: 240000 },
 *   ],
 *   payments: [
 *     { method: "cash", amount: 400000, reference: null }
 *   ]
 * }
 *
 * BE akan balas struk lengkap seperti contoh yang kamu kirim.
 */
export async function createSale(payload) {
  const { data } = await api.post("/api/sales", payload);
  return data;
}

export async function getSale(id) {
  const { data } = await api.get(`/api/sales/${id}`);
  return data; // pastikan backend mengembalikan { id, code, created_at, cashier, customer_name, items, subtotal, discount, tax, total, paid, change, payments: [...] }
}

