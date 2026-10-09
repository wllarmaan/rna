import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { useAuth } from "../lib/AuthContext.jsx";
import {
  AlertTriangle,
  Boxes,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Package,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Warehouse,
} from "lucide-react";

function formatQty(value) {
  return Number(value || 0).toFixed(2);
}

function formatMoney(value) {
  return Number(value || 0).toFixed(2);
}

function formatDate(value) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString();
}

function getInventoryKey(branchId, productId) {
  return `${branchId}::${productId}`;
}

export default function Inventory() {
  const { profile } = useAuth();

  const [levels, setLevels] = useState([]);
  const [branches, setBranches] = useState([]);
  const [products, setProducts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [branchFilter, setBranchFilter] = useState("");
  const [query, setQuery] = useState("");

  const [adjBranch, setAdjBranch] = useState("");
  const [adjProduct, setAdjProduct] = useState("");
  const [adjQty, setAdjQty] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile?.organization_id) {
      loadAll();
    }
  }, [profile?.organization_id]);

  async function loadAll() {
    if (!profile?.organization_id) return;

    setLoading(true);
    setError("");

    const organizationId = profile.organization_id;

    const [stockRes, branchesRes, productsRes] =
      await Promise.all([
        supabase
          .from("stock_batches")
          .select(
            `
              id,
              organization_id,
              branch_id,
              product_id,
              quantity,
              expiry_date,
              batch_number,
              received_at,
              unit_cost
            `
          )
          .eq("organization_id", organizationId)
          .order("expiry_date", {
            ascending: true,
            nullsFirst: false,
          }),

        supabase
          .from("branches")
          .select("id, name")
          .eq("organization_id", organizationId)
          .order("name"),

        supabase
          .from("products")
          .select(
            `
              id,
              name,
              unit,
              reorder_level,
              status
            `
          )
          .eq("organization_id", organizationId)
          .order("name"),
      ]);

    if (stockRes.error) {
      setError(stockRes.error.message);
      setLoading(false);
      return;
    }

    if (branchesRes.error) {
      setError(branchesRes.error.message);
      setLoading(false);
      return;
    }

    if (productsRes.error) {
      setError(productsRes.error.message);
      setLoading(false);
      return;
    }

    const branchMap = {};

    (branchesRes.data || []).forEach((branch) => {
      branchMap[branch.id] = branch;
    });

    const productMap = {};

    (productsRes.data || []).forEach((product) => {
      productMap[product.id] = product;
    });

    const grouped = {};

    (stockRes.data || []).forEach((batch) => {
      const product = productMap[batch.product_id];
      const branch = branchMap[batch.branch_id];

      if (!product || !branch) return;

      const key = getInventoryKey(
        batch.branch_id,
        batch.product_id
      );

      if (!grouped[key]) {
        grouped[key] = {
          branch_id: batch.branch_id,
          branch_name: branch.name,
          product_id: batch.product_id,
          product_name: product.name,
          unit: product.unit,
          reorder_level: product.reorder_level,
          quantity_on_hand: 0,
          stock_value: 0,
          nearest_expiry: null,
        };
      }

      const quantity = Number(batch.quantity || 0);
      const unitCost = Number(batch.unit_cost || 0);

      grouped[key].quantity_on_hand += quantity;
      grouped[key].stock_value +=
        quantity * unitCost;

      if (batch.expiry_date) {
        const currentExpiry =
          grouped[key].nearest_expiry;

        if (
          !currentExpiry ||
          new Date(batch.expiry_date) <
            new Date(currentExpiry)
        ) {
          grouped[key].nearest_expiry =
            batch.expiry_date;
        }
      }
    });

    setLevels(Object.values(grouped));
    setBranches(branchesRes.data || []);
    setProducts(productsRes.data || []);

    setLoading(false);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return levels.filter((level) => {
      if (
        branchFilter &&
        level.branch_id !== branchFilter
      ) {
        return false;
      }

      if (
        q &&
        !String(level.product_name || "")
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }

      return true;
    });
  }, [levels, branchFilter, query]);

  const summary = useMemo(() => {
    const lowStock = levels.filter(
      (level) =>
        level.reorder_level != null &&
        Number(level.quantity_on_hand) <=
          Number(level.reorder_level)
    );

    const totalUnits = levels.reduce(
      (sum, level) =>
        sum +
        Number(level.quantity_on_hand || 0),
      0
    );

    const totalStockValue = levels.reduce(
      (sum, level) =>
        sum +
        Number(level.stock_value || 0),
      0
    );

    const expiryCount = levels.filter(
      (level) => level.nearest_expiry
    ).length;

    return {
      totalItems: levels.length,
      totalUnits,
      totalStockValue,
      lowStock: lowStock.length,
      expiryCount,
    };
  }, [levels]);

  async function handleAdjust(e) {
    e.preventDefault();

    setError("");

    if (!profile?.organization_id) {
      setError(
        "Profile-kaaga wali lama xirin organization."
      );
      return;
    }

    if (
      !adjBranch ||
      !adjProduct ||
      !adjQty ||
      Number(adjQty) === 0
    ) {
      setError(
        "Fadlan dooro branch, alaab, iyo geli tiro aan eber ahayn."
      );
      return;
    }

    const quantity = Number(adjQty);

    if (!Number.isFinite(quantity)) {
      setError(
        "Quantity-ga aad gelisay ma saxna."
      );
      return;
    }

    setSaving(true);

    /*
     * Adjustment-kan wuxuu sameynayaa stock batch cusub.
     *
     * Positive quantity:
     *   stock-ka waa lagu daraa.
     *
     * Negative quantity:
     *   waxaan ka hortageynaa in batch cusub
     *   oo negative quantity ah la abuuro.
     *
     * Negative adjustment waxaa loo baahan yahay
     * in si batch-level ah looga jaro stock-ga jira.
     */

    if (quantity < 0) {
      setError(
        "Negative adjustment hadda lama fulinayo si aan loo abuuro stock batch negative ah. Marka batch-level deduction la dhammeeyo ayaa -quantity si ammaan ah loo taageeri doonaa."
      );
      setSaving(false);
      return;
    }

    const {
      data: batch,
      error: batchError,
    } = await supabase
      .from("stock_batches")
      .insert({
        organization_id:
          profile.organization_id,
        branch_id: adjBranch,
        product_id: adjProduct,
        quantity,
        received_at:
          new Date().toISOString(),
        unit_cost: 0,
      })
      .select()
      .single();

    if (batchError) {
      setError(batchError.message);
      setSaving(false);
      return;
    }

    const { error: moveError } =
      await supabase
        .from("stock_movements")
        .insert({
          organization_id:
            profile.organization_id,
          branch_id: adjBranch,
          product_id: adjProduct,
          batch_id: batch.id,
          movement_type: "adjustment",
          quantity,
          reference_type: "manual",
          created_by: profile.id,
        });

    if (moveError) {
      setError(moveError.message);
      setSaving(false);
      return;
    }

    setAdjBranch("");
    setAdjProduct("");
    setAdjQty("");

    await loadAll();

    setSaving(false);
  }

  return (
    <div className="min-h-full bg-[#f2efe7] p-4 md:p-6 lg:p-8">
      {/* PAGE HEADER */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#48a6a7]">
            <span className="h-2 w-2 rounded-full bg-[#48a6a7]" />
            Inventory Control
          </div>

          <h1 className="text-3xl font-black tracking-tight text-[#13293d] md:text-4xl">
            Inventory
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5e6b75]">
            La soco stock-ga branch kasta,
            low-stock items, expiry-ga ugu
            dhow, iyo qiimaha stock-ga.
            Xogtu waxay si toos ah uga
            imaanaysaa stock batches-ka.
          </p>
        </div>

        <button
          type="button"
          onClick={loadAll}
          disabled={loading}
          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[#d4cec1] bg-[#fffdf8] px-4 text-sm font-bold text-[#13293d] shadow-sm transition hover:border-[#48a6a7] hover:text-[#287d80] disabled:opacity-60"
        >
          <RefreshCw
            size={16}
            className={
              loading ? "animate-spin" : ""
            }
          />
          Refresh
        </button>
      </div>

      {/* SUMMARY CARDS */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-[#d8d2c4] bg-[#fffdf8] p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e8f4f3] text-[#287d80]">
              <Boxes size={19} />
            </div>

            <span className="text-[10px] font-black uppercase tracking-wider text-[#8a9298]">
              Items
            </span>
          </div>

          <p className="text-2xl font-black text-[#13293d]">
            {summary.totalItems}
          </p>

          <p className="mt-1 text-xs text-[#7c858c]">
            Product / branch combinations
          </p>
        </div>

        <div className="rounded-2xl border border-[#d8d2c4] bg-[#fffdf8] p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef1f5] text-[#34546d]">
              <Package size={19} />
            </div>

            <span className="text-[10px] font-black uppercase tracking-wider text-[#8a9298]">
              Quantity
            </span>
          </div>

          <p className="text-2xl font-black text-[#13293d]">
            {formatQty(summary.totalUnits)}
          </p>

          <p className="mt-1 text-xs text-[#7c858c]">
            Total units on hand
          </p>
        </div>

        <div className="rounded-2xl border border-[#d8d2c4] bg-[#fffdf8] p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff1d7] text-[#96702a]">
              <ClipboardList size={19} />
            </div>

            <span className="text-[10px] font-black uppercase tracking-wider text-[#8a9298]">
              Stock Value
            </span>
          </div>

          <p className="text-2xl font-black text-[#13293d]">
            {formatMoney(
              summary.totalStockValue
            )}
          </p>

          <p className="mt-1 text-xs text-[#7c858c]">
            Based on batch unit cost
          </p>
        </div>

        <div className="rounded-2xl border border-[#d8d2c4] bg-[#fffdf8] p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff1d7] text-[#96702a]">
              <AlertTriangle size={19} />
            </div>

            <span className="text-[10px] font-black uppercase tracking-wider text-[#8a9298]">
              Attention
            </span>
          </div>

          <p className="text-2xl font-black text-[#13293d]">
            {summary.lowStock}
          </p>

          <p className="mt-1 text-xs text-[#7c858c]">
            Low-stock items
          </p>
        </div>

        <div className="rounded-2xl border border-[#d8d2c4] bg-[#fffdf8] p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f0eee7] text-[#53616b]">
              <CalendarClock size={19} />
            </div>

            <span className="text-[10px] font-black uppercase tracking-wider text-[#8a9298]">
              Expiry
            </span>
          </div>

          <p className="text-2xl font-black text-[#13293d]">
            {summary.expiryCount}
          </p>

          <p className="mt-1 text-xs text-[#7c858c]">
            Items with expiry data
          </p>
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="mb-5 rounded-2xl border border-[#e2b7b2] bg-[#fff4f2] px-4 py-3 text-sm font-medium text-[#9b3028]">
          {error}
        </div>
      )}

      {/* FILTER BAR */}
      <div className="mb-6 rounded-3xl border border-[#d8d2c4] bg-[#fffdf8] p-5 shadow-sm md:p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef1f5] text-[#34546d]">
            <SlidersHorizontal size={18} />
          </div>

          <div>
            <h2 className="text-sm font-black text-[#13293d]">
              Inventory Filters
            </h2>

            <p className="text-xs text-[#7c858c]">
              Kala saar branch ama raadi alaab
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[260px_minmax(0,1fr)]">
          <select
            value={branchFilter}
            onChange={(e) =>
              setBranchFilter(e.target.value)
            }
            className="h-11 rounded-xl border border-[#d6d1c7] bg-[#f8f5ed] px-3 text-sm font-medium text-[#13293d] outline-none focus:border-[#48a6a7] focus:ring-4 focus:ring-[#48a6a7]/10"
          >
            <option value="">
              Dhammaan branches
            </option>

            {branches.map((branch) => (
              <option
                key={branch.id}
                value={branch.id}
              >
                {branch.name}
              </option>
            ))}
          </select>

          <div className="relative">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a9298]"
            />

            <input
              type="text"
              placeholder="Raadi alaab..."
              value={query}
              onChange={(e) =>
                setQuery(e.target.value)
              }
              className="h-11 w-full rounded-xl border border-[#d6d1c7] bg-[#f8f5ed] pl-10 pr-3 text-sm font-medium text-[#13293d] outline-none placeholder:text-[#9ba1a5] focus:border-[#48a6a7] focus:ring-4 focus:ring-[#48a6a7]/10"
            />
          </div>
        </div>
      </div>

      {/* INVENTORY TABLE */}
      <div className="mb-8 overflow-hidden rounded-3xl border border-[#d8d2c4] bg-[#fffdf8] shadow-sm">
        <div className="flex flex-col gap-2 border-b border-[#e3ded3] px-5 py-5 md:flex-row md:items-center md:justify-between md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e8f4f3] text-[#287d80]">
              <Warehouse size={18} />
            </div>

            <div>
              <h2 className="text-base font-black text-[#13293d]">
                Current Stock
              </h2>

              <p className="text-xs text-[#7c858c]">
                {filtered.length} result
                {filtered.length !== 1
                  ? "s"
                  : ""}{" "}
                displayed
              </p>
            </div>
          </div>

          <span className="w-fit rounded-full bg-[#f0eee7] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#68747d]">
            Live · Supabase
          </span>
        </div>

        {loading ? (
          <div className="px-5 py-14 text-center">
            <RefreshCw
              size={24}
              className="mx-auto mb-3 animate-spin text-[#48a6a7]"
            />

            <p className="text-sm font-bold text-[#13293d]">
              Soo dejinaya inventory...
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f0eee7] text-[#68747d]">
              <Package size={21} />
            </div>

            <p className="text-sm font-black text-[#13293d]">
              Stock lama helin
            </p>

            <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-[#7c858c]">
              Wali stock lama helin ama filter-ka
              ayaa qarinaya xogta. Samee Purchase
              Order kadibna Receive garee.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1050px] w-full text-left">
              <thead>
                <tr className="border-b border-[#e3ded3] bg-[#faf8f2] text-[10px] font-black uppercase tracking-wider text-[#8a9298]">
                  <th className="px-5 py-4">
                    Alaabta
                  </th>

                  <th className="px-5 py-4">
                    Branch
                  </th>

                  <th className="px-5 py-4">
                    Hadda haysta
                  </th>

                  <th className="px-5 py-4">
                    Unit
                  </th>

                  <th className="px-5 py-4">
                    Reorder
                  </th>

                  <th className="px-5 py-4">
                    Stock Value
                  </th>

                  <th className="px-5 py-4">
                    Xaalada
                  </th>

                  <th className="px-5 py-4">
                    Expiry
                  </th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((level) => {
                  const low =
                    level.reorder_level !=
                      null &&
                    Number(
                      level.quantity_on_hand
                    ) <=
                      Number(
                        level.reorder_level
                      );

                  return (
                    <tr
                      key={getInventoryKey(
                        level.branch_id,
                        level.product_id
                      )}
                      className="border-b border-[#eeeae2] last:border-0 hover:bg-[#faf8f2]"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f0eee7] text-[#13293d]">
                            <Package size={16} />
                          </div>

                          <span className="text-sm font-black text-[#273b4b]">
                            {level.product_name}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-sm font-semibold text-[#68747d]">
                        {level.branch_name}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`text-sm font-black ${
                            low
                              ? "text-[#a5312a]"
                              : "text-[#13293d]"
                          }`}
                        >
                          {formatQty(
                            level.quantity_on_hand
                          )}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-sm font-medium text-[#68747d]">
                        {level.unit || "—"}
                      </td>

                      <td className="px-5 py-4 text-sm font-medium text-[#68747d]">
                        {level.reorder_level ??
                          "—"}
                      </td>

                      <td className="px-5 py-4 text-sm font-bold text-[#13293d]">
                        {formatMoney(
                          level.stock_value
                        )}
                      </td>

                      <td className="px-5 py-4">
                        {low ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fff0ed] px-2.5 py-1.5 text-[10px] font-black text-[#a5312a]">
                            <AlertTriangle size={12} />
                            Low stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e8f4f3] px-2.5 py-1.5 text-[10px] font-black text-[#287d80]">
                            <CheckCircle2 size={12} />
                            OK
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        {level.nearest_expiry ? (
                          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#68747d]">
                            <CalendarClock size={14} />
                            {formatDate(
                              level.nearest_expiry
                            )}
                          </span>
                        ) : (
                          <span className="text-sm text-[#9ba1a5]">
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* STOCK ADJUSTMENT */}
      <div className="overflow-hidden rounded-3xl border border-[#d8d2c4] bg-[#fffdf8] shadow-sm">
        <div className="border-b border-[#e3ded3] px-5 py-5 md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff1d7] text-[#96702a]">
              <SlidersHorizontal size={19} />
            </div>

            <div>
              <h2 className="text-base font-black text-[#13293d]">
                Stock Adjustment
              </h2>

              <p className="mt-1 text-xs text-[#7c858c]">
                Saxid gacanta ah marka stock-ku
                aanu la jaanqaadin xisaabta.
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 md:p-6">
          <div className="mb-5 rounded-2xl border border-[#e7dcc2] bg-[#fff9e9] px-4 py-3">
            <div className="flex gap-3">
              <ClipboardList
                size={18}
                className="mt-0.5 shrink-0 text-[#96702a]"
              />

              <p className="text-xs leading-5 text-[#765e2b]">
                <strong>Talo:</strong> geli tiro
                togan si aad stock-ka u kordhiso.
                Negative adjustment hadda lama
                oggola ilaa batch-level deduction
                la dhammeeyo, si stock-ku uusan u
                yeelan quantity negative ah.
              </p>
            </div>
          </div>

          <form
            onSubmit={handleAdjust}
            className="grid gap-4 lg:grid-cols-[1fr_1fr_180px_auto]"
          >
            <label>
              <span className="mb-2 block text-[10px] font-black uppercase tracking-wider text-[#8a9298]">
                Branch
              </span>

              <select
                value={adjBranch}
                onChange={(e) =>
                  setAdjBranch(e.target.value)
                }
                required
                className="h-11 w-full rounded-xl border border-[#d6d1c7] bg-[#f8f5ed] px-3 text-sm font-medium text-[#13293d] outline-none focus:border-[#48a6a7] focus:ring-4 focus:ring-[#48a6a7]/10"
              >
                <option value="">
                  — Dooro Branch —
                </option>

                {branches.map((branch) => (
                  <option
                    key={branch.id}
                    value={branch.id}
                  >
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-2 block text-[10px] font-black uppercase tracking-wider text-[#8a9298]">
                Alaabta
              </span>

              <select
                value={adjProduct}
                onChange={(e) =>
                  setAdjProduct(e.target.value)
                }
                required
                className="h-11 w-full rounded-xl border border-[#d6d1c7] bg-[#f8f5ed] px-3 text-sm font-medium text-[#13293d] outline-none focus:border-[#48a6a7] focus:ring-4 focus:ring-[#48a6a7]/10"
              >
                <option value="">
                  — Dooro Alaabta —
                </option>

                {products.map((product) => (
                  <option
                    key={product.id}
                    value={product.id}
                  >
                    {product.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-2 block text-[10px] font-black uppercase tracking-wider text-[#8a9298]">
                Quantity +
              </span>

              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="+10"
                value={adjQty}
                onChange={(e) =>
                  setAdjQty(e.target.value)
                }
                required
                className="h-11 w-full rounded-xl border border-[#d6d1c7] bg-[#f8f5ed] px-3 text-sm font-bold text-[#13293d] outline-none placeholder:text-[#9ba1a5] focus:border-[#48a6a7] focus:ring-4 focus:ring-[#48a6a7]/10"
              />
            </label>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={saving}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#13293d] px-5 text-sm font-black text-white transition hover:bg-[#1d3b54] disabled:cursor-not-allowed disabled:opacity-60 lg:w-auto"
              >
                <SlidersHorizontal size={16} />

                {saving
                  ? "Saving..."
                  : "Sax stock-ka"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}