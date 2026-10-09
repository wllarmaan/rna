import React, { useEffect, useMemo, useState } from "react";
import {
  PackagePlus,
  Truck,
  Building2,
  Plus,
  Trash2,
  RefreshCw,
  ClipboardList,
  PackageCheck,
  Clock3,
  Search,
  X,
  Boxes,
  CircleDollarSign,
  ChevronDown,
} from "lucide-react";

import { supabase } from "../lib/supabaseClient.js";
import { useAuth } from "../lib/AuthContext.jsx";

const emptyLine = {
  product_id: "",
  quantity: "",
  unit_cost: "",
};

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function statusLabel(status) {
  if (status === "received") return "La helay";
  if (status === "pending") return "Sugaya";
  if (status === "cancelled") return "La joojiyay";
  return status || "—";
}

function statusClass(status) {
  if (status === "received") {
    return "border-[#b9dcca] bg-[#eef9f2] text-[#28734b]";
  }

  if (status === "cancelled") {
    return "border-[#e5c4c4] bg-[#fff5f5] text-[#9a4b4b]";
  }

  return "border-[#e6d3a8] bg-[#fff9ed] text-[#936d23]";
}

export default function Purchases() {
  const { profile } = useAuth();

  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [products, setProducts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [receivingId, setReceivingId] = useState(null);

  const [supplierId, setSupplierId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [lines, setLines] = useState([{ ...emptyLine }]);

  const [search, setSearch] = useState("");

  useEffect(() => {
    if (profile?.organization_id) {
      loadAll();
    }
  }, [profile?.organization_id]);

  async function loadAll() {
    if (!profile?.organization_id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const [
      ordersRes,
      suppliersRes,
      branchesRes,
      productsRes,
    ] = await Promise.all([
      supabase
        .from("purchase_orders")
        .select(
          "*, suppliers(name), branches(name), purchase_items(*, products(name))"
        )
        .eq("organization_id", profile.organization_id)
        .order("created_at", { ascending: false }),

      supabase
        .from("suppliers")
        .select("id, name, balance")
        .eq("organization_id", profile.organization_id)
        .order("name", { ascending: true }),

      supabase
        .from("branches")
        .select("id, name")
        .eq("organization_id", profile.organization_id)
        .order("name", { ascending: true }),

      supabase
        .from("products")
        .select("id, name, purchase_price")
        .eq("organization_id", profile.organization_id)
        .order("name", { ascending: true }),
    ]);

    if (ordersRes.error) {
      setError(ordersRes.error.message);
    } else {
      setOrders(ordersRes.data || []);
    }

    if (suppliersRes.error) {
      setError(suppliersRes.error.message);
    } else {
      setSuppliers(suppliersRes.data || []);
    }

    if (branchesRes.error) {
      setError(branchesRes.error.message);
    } else {
      setBranches(branchesRes.data || []);
    }

    if (productsRes.error) {
      setError(productsRes.error.message);
    } else {
      setProducts(productsRes.data || []);
    }

    setLoading(false);
  }

  function updateLine(index, key, value) {
    setLines((prev) => {
      const next = [...prev];

      next[index] = {
        ...next[index],
        [key]: value,
      };

      // Auto-fill unit cost from product purchase price.
      if (key === "product_id") {
        const product = products.find(
          (p) => p.id === value
        );

        if (product) {
          next[index].unit_cost =
            product.purchase_price ?? "";
        }
      }

      return next;
    });
  }

  function addLine() {
    setLines((prev) => [
      ...prev,
      { ...emptyLine },
    ]);
  }

  function removeLine(index) {
    setLines((prev) =>
      prev.filter((_, i) => i !== index)
    );
  }

  const total = lines.reduce(
    (sum, line) =>
      sum +
      (Number(line.quantity) || 0) *
        (Number(line.unit_cost) || 0),
    0
  );

  const validLineCount = lines.filter(
    (line) =>
      line.product_id &&
      Number(line.quantity) > 0
  ).length;

  const pendingCount = orders.filter(
    (order) => order.status === "pending"
  ).length;

  const receivedCount = orders.filter(
    (order) => order.status === "received"
  ).length;

  const totalPurchaseValue = orders.reduce(
    (sum, order) =>
      sum + Number(order.total_amount || 0),
    0
  );

  async function handleCreateOrder(e) {
    e.preventDefault();
    setError("");

    if (!profile?.organization_id) {
      setError(
        "Profile-kaaga wali lama xirin organization."
      );
      return;
    }

    const validLines = lines.filter(
      (line) =>
        line.product_id &&
        Number(line.quantity) > 0
    );

    if (
      !supplierId ||
      !branchId ||
      validLines.length === 0
    ) {
      setError(
        "Fadlan dooro supplier, branch, iyo ugu yaraan hal alaab oo tiro leh."
      );
      return;
    }

    const invalidCost = validLines.some(
      (line) =>
        Number(line.unit_cost) < 0 ||
        Number.isNaN(Number(line.unit_cost))
    );

    if (invalidCost) {
      setError(
        "Fadlan hubi qiimaha iibsiga ee alaab kasta."
      );
      return;
    }

    setSaving(true);

    const { data: order, error: orderError } =
      await supabase
        .from("purchase_orders")
        .insert({
          organization_id:
            profile.organization_id,
          supplier_id: supplierId,
          branch_id: branchId,
          status: "pending",
          total_amount: total,
          created_by: profile.id,
        })
        .select()
        .single();

    if (orderError) {
      setError(orderError.message);
      setSaving(false);
      return;
    }

    const itemsPayload = validLines.map(
      (line) => ({
        purchase_order_id: order.id,
        product_id: line.product_id,
        quantity: Number(line.quantity),
        unit_cost:
          Number(line.unit_cost) || 0,
      })
    );

    const { error: itemsError } =
      await supabase
        .from("purchase_items")
        .insert(itemsPayload);

    if (itemsError) {
      setSaving(false);
      setError(itemsError.message);
      return;
    }

    // Creating an order increases the supplier payable.
    const supplier = suppliers.find(
      (s) => s.id === supplierId
    );

    const { error: balanceError } =
      await supabase
        .from("suppliers")
        .update({
          balance:
            (Number(supplier?.balance) || 0) +
            total,
        })
        .eq("id", supplierId)
        .eq(
          "organization_id",
          profile.organization_id
        );

    setSaving(false);

    if (balanceError) {
      setError(balanceError.message);
      return;
    }

    setSupplierId("");
    setBranchId("");
    setLines([{ ...emptyLine }]);

    await loadAll();
  }

  /*
   * Receives the purchase:
   *
   * purchase_items.unit_cost
   *          ↓
   * stock_batches.unit_cost
   *
   * This allows Dashboard COGS to later calculate:
   *
   * sold quantity × batch unit cost
   */
  async function handleReceive(order) {
    if (!profile?.organization_id) {
      setError(
        "Profile-kaaga wali lama xirin organization."
      );
      return;
    }

    if (
      !order?.purchase_items ||
      order.purchase_items.length === 0
    ) {
      setError(
        "Purchase-kan wax items ah kuma jiraan."
      );
      return;
    }

    setReceivingId(order.id);
    setError("");

    try {
      for (const item of order.purchase_items) {
        const quantity = Number(item.quantity) || 0;
        const unitCost =
          Number(item.unit_cost) || 0;

        if (!item.product_id || quantity <= 0) {
          throw new Error(
            "Purchase item-ka wuxuu leeyahay xog aan sax ahayn."
          );
        }

        /*
         * IMPORTANT:
         * unit_cost is copied from purchase_items
         * into stock_batches.
         */
        const { data: batch, error: batchError } =
          await supabase
            .from("stock_batches")
            .insert({
              organization_id:
                profile.organization_id,
              branch_id: order.branch_id,
              product_id: item.product_id,
              quantity,
              unit_cost: unitCost,
            })
            .select()
            .single();

        if (batchError) {
          throw batchError;
        }

        const { error: moveError } =
          await supabase
            .from("stock_movements")
            .insert({
              organization_id:
                profile.organization_id,
              branch_id: order.branch_id,
              product_id: item.product_id,
              batch_id: batch.id,
              movement_type: "purchase",
              quantity,
              reference_type:
                "purchase_order",
              reference_id: order.id,
              created_by: profile.id,
            });

        if (moveError) {
          throw moveError;
        }

        const {
          error: itemUpdateError,
        } = await supabase
          .from("purchase_items")
          .update({
            received_quantity: quantity,
          })
          .eq("id", item.id)
          .eq(
            "purchase_order_id",
            order.id
          );

        if (itemUpdateError) {
          throw itemUpdateError;
        }
      }

      const {
        error: orderUpdateError,
      } = await supabase
        .from("purchase_orders")
        .update({
          status: "received",
        })
        .eq("id", order.id)
        .eq(
          "organization_id",
          profile.organization_id
        );

      if (orderUpdateError) {
        throw orderUpdateError;
      }

      await loadAll();
    } catch (err) {
      setError(
        err?.message ||
          "Receiving-ka purchase-ka wuu fashilmay."
      );
    } finally {
      setReceivingId(null);
    }
  }

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return orders;

    return orders.filter((order) => {
      const supplierName =
        order.suppliers?.name || "";

      const branchName =
        order.branches?.name || "";

      const status =
        statusLabel(order.status);

      const items =
        order.purchase_items
          ?.map(
            (item) =>
              item.products?.name || ""
          )
          .join(" ") || "";

      return [
        supplierName,
        branchName,
        status,
        items,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [orders, search]);

  return (
    <div className="min-h-full bg-[#f2efe7] p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-[1600px]">

        {/* ============================================================
            HEADER
        ============================================================ */}
        <header className="mb-6 overflow-hidden rounded-2xl border border-[#d9d2c3] bg-[#13293d] shadow-sm">
          <div className="relative px-5 py-6 md:px-7">
            <div className="absolute right-0 top-0 h-full w-56 bg-[#48a6a7]/10" />

            <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#48a6a7] text-white">
                    <PackagePlus size={18} />
                  </span>

                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#d7b46a]">
                    Medvora · Procurement
                  </span>
                </div>

                <h1 className="text-2xl font-extrabold tracking-tight text-white md:text-3xl">
                  Purchasing &amp; Stock
                </h1>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
                  Samee purchase order, kadibna marka
                  alaabtu timaado riix{" "}
                  <strong className="text-white/85">
                    Receive
                  </strong>{" "}
                  si stock-ka loogu daro.
                </p>
              </div>

              <div className="flex items-center gap-2 self-start rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/75 md:self-auto">
                <Truck size={15} />
                <span>Supplier Procurement</span>
              </div>
            </div>
          </div>
        </header>

        {/* ============================================================
            ERROR
        ============================================================ */}
        {error && (
          <div className="mb-5 flex items-start justify-between gap-4 rounded-2xl border border-[#e7b7b7] bg-[#fff5f5] px-4 py-3 text-sm text-[#8e3d3d] shadow-sm">
            <div>
              <p className="font-bold">
                Waxaa dhacay qalad
              </p>

              <p className="mt-0.5">
                {error}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setError("")}
              className="rounded-lg p-1 hover:bg-[#f3dede]"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* ============================================================
            SUMMARY CARDS
        ============================================================ */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <div className="rounded-2xl border border-[#d9d2c3] bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#48a6a7]/10 text-[#247b7c]">
                <ClipboardList size={19} />
              </div>

              <span className="text-xs font-bold uppercase tracking-[0.08em] text-[#8a949b]">
                Orders
              </span>
            </div>

            <p className="text-2xl font-extrabold text-[#15314a]">
              {orders.length}
            </p>

            <p className="mt-1 text-xs text-[#7a858e]">
              Purchase orders
            </p>
          </div>

          <div className="rounded-2xl border border-[#d9d2c3] bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff4d9] text-[#a27a2a]">
                <Clock3 size={19} />
              </div>

              <span className="text-xs font-bold uppercase tracking-[0.08em] text-[#8a949b]">
                Pending
              </span>
            </div>

            <p className="text-2xl font-extrabold text-[#15314a]">
              {pendingCount}
            </p>

            <p className="mt-1 text-xs text-[#7a858e]">
              Sugaya in la helo
            </p>
          </div>

          <div className="rounded-2xl border border-[#d9d2c3] bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eaf7ef] text-[#28734b]">
                <PackageCheck size={19} />
              </div>

              <span className="text-xs font-bold uppercase tracking-[0.08em] text-[#8a949b]">
                Received
              </span>
            </div>

            <p className="text-2xl font-extrabold text-[#15314a]">
              {receivedCount}
            </p>

            <p className="mt-1 text-xs text-[#7a858e]">
              Orders stock galay
            </p>
          </div>

          <div className="rounded-2xl border border-[#d9d2c3] bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef1f6] text-[#38536a]">
                <CircleDollarSign size={19} />
              </div>

              <span className="text-xs font-bold uppercase tracking-[0.08em] text-[#8a949b]">
                Value
              </span>
            </div>

            <p className="text-2xl font-extrabold text-[#15314a]">
              {money(totalPurchaseValue)}
            </p>

            <p className="mt-1 text-xs text-[#7a858e]">
              Wadarta purchases
            </p>
          </div>
        </div>

        {/* ============================================================
            CREATE PURCHASE ORDER
        ============================================================ */}
        <section className="mb-6 overflow-hidden rounded-2xl border border-[#d9d2c3] bg-white shadow-sm">

          <div className="border-b border-[#e7e1d2] bg-[#faf8f3] px-5 py-4 md:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#48a6a7]/10 text-[#247b7c]">
                <Plus size={18} />
              </div>

              <div>
                <h2 className="text-sm font-extrabold text-[#15314a]">
                  Samee Purchase Order
                </h2>

                <p className="mt-0.5 text-xs text-[#7a858e]">
                  Dooro supplier, branch iyo alaabta
                  aad iibsanayso.
                </p>
              </div>
            </div>
          </div>

          <form
            onSubmit={handleCreateOrder}
            className="p-5 md:p-6"
          >
            {/* Supplier / Branch */}
            <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.08em] text-[#6d7882]">
                  Supplier
                </label>

                <div className="relative">
                  <Truck
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7d8991]"
                  />

                  <select
                    value={supplierId}
                    onChange={(e) =>
                      setSupplierId(
                        e.target.value
                      )
                    }
                    required
                    className="w-full appearance-none rounded-xl border border-[#d9d2c3] bg-white py-3 pl-10 pr-10 text-sm text-[#15314a] outline-none transition focus:border-[#48a6a7] focus:ring-2 focus:ring-[#48a6a7]/15"
                  >
                    <option value="">
                      — Dooro Supplier —
                    </option>

                    {suppliers.map((supplier) => (
                      <option
                        key={supplier.id}
                        value={supplier.id}
                      >
                        {supplier.name}
                      </option>
                    ))}
                  </select>

                  <ChevronDown
                    size={16}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7d8991]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.08em] text-[#6d7882]">
                  Branch
                </label>

                <div className="relative">
                  <Building2
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7d8991]"
                  />

                  <select
                    value={branchId}
                    onChange={(e) =>
                      setBranchId(
                        e.target.value
                      )
                    }
                    required
                    className="w-full appearance-none rounded-xl border border-[#d9d2c3] bg-white py-3 pl-10 pr-10 text-sm text-[#15314a] outline-none transition focus:border-[#48a6a7] focus:ring-2 focus:ring-[#48a6a7]/15"
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

                  <ChevronDown
                    size={16}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7d8991]"
                  />
                </div>
              </div>
            </div>

            {/* Lines */}
            <div className="rounded-2xl border border-[#e2dbcf] bg-[#faf8f3] p-4 md:p-5">

              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-[#15314a]">
                    Purchase Items
                  </h3>

                  <p className="mt-1 text-xs text-[#7a858e]">
                    {validLineCount} item
                    {validLineCount !== 1
                      ? "s"
                      : ""}{" "}
                    oo diyaar ah
                  </p>
                </div>

                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#48a6a7] shadow-sm">
                  <Boxes size={17} />
                </div>
              </div>

              <div className="space-y-3">
                {lines.map((line, index) => (
                  <div
                    className="rounded-xl border border-[#ded7ca] bg-white p-3"
                    key={index}
                  >
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_150px_170px_auto] md:items-end">

                      {/* Product */}
                      <div>
                        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.08em] text-[#78848d]">
                          Alaabta
                        </label>

                        <div className="relative">
                          <select
                            value={
                              line.product_id
                            }
                            onChange={(e) =>
                              updateLine(
                                index,
                                "product_id",
                                e.target.value
                              )
                            }
                            className="w-full appearance-none rounded-xl border border-[#d9d2c3] bg-white px-3.5 py-2.5 pr-9 text-sm text-[#15314a] outline-none transition focus:border-[#48a6a7] focus:ring-2 focus:ring-[#48a6a7]/15"
                          >
                            <option value="">
                              — Dooro Alaabta —
                            </option>

                            {products.map(
                              (product) => (
                                <option
                                  key={
                                    product.id
                                  }
                                  value={
                                    product.id
                                  }
                                >
                                  {product.name}
                                </option>
                              )
                            )}
                          </select>

                          <ChevronDown
                            size={15}
                            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#7d8991]"
                          />
                        </div>
                      </div>

                      {/* Quantity */}
                      <div>
                        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.08em] text-[#78848d]">
                          Tirada
                        </label>

                        <input
                          type="number"
                          min="1"
                          placeholder="Tirada"
                          value={line.quantity}
                          onChange={(e) =>
                            updateLine(
                              index,
                              "quantity",
                              e.target.value
                            )
                          }
                          className="w-full rounded-xl border border-[#d9d2c3] bg-white px-3.5 py-2.5 text-sm text-[#15314a] outline-none transition focus:border-[#48a6a7] focus:ring-2 focus:ring-[#48a6a7]/15"
                        />
                      </div>

                      {/* Unit cost */}
                      <div>
                        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.08em] text-[#78848d]">
                          Qiimaha halkii
                        </label>

                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={line.unit_cost}
                          onChange={(e) =>
                            updateLine(
                              index,
                              "unit_cost",
                              e.target.value
                            )
                          }
                          className="w-full rounded-xl border border-[#d9d2c3] bg-white px-3.5 py-2.5 text-sm text-[#15314a] outline-none transition focus:border-[#48a6a7] focus:ring-2 focus:ring-[#48a6a7]/15"
                        />
                      </div>

                      {/* Remove */}
                      <div>
                        {lines.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              removeLine(index)
                            }
                            className="flex h-[42px] w-full items-center justify-center gap-2 rounded-xl border border-[#e5caca] bg-white px-3 text-xs font-bold text-[#a04f4f] transition hover:bg-[#fff5f5] md:w-auto"
                          >
                            <Trash2 size={15} />

                            <span className="md:hidden">
                              Ka saar
                            </span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Line subtotal */}
                    {line.product_id &&
                      Number(line.quantity) > 0 && (
                        <div className="mt-3 flex justify-end border-t border-[#eee9df] pt-3">
                          <span className="text-xs text-[#7a858e]">
                            Subtotal:{" "}
                            <strong className="text-[#15314a]">
                              {money(
                                Number(
                                  line.quantity
                                ) *
                                  Number(
                                    line.unit_cost
                                  )
                              )}
                            </strong>
                          </span>
                        </div>
                      )}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addLine}
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#bcdada] bg-[#f3fbfb] px-4 py-2.5 text-sm font-bold text-[#247b7c] transition hover:bg-[#e8f7f7]"
              >
                <Plus size={16} />
                Ku dar alaab kale
              </button>
            </div>

            {/* Footer */}
            <div className="mt-5 flex flex-col gap-4 rounded-2xl bg-[#13293d] p-4 md:flex-row md:items-center md:justify-between md:p-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-white/50">
                  Purchase Total
                </p>

                <p className="mt-1 text-2xl font-extrabold text-white">
                  {money(total)}
                </p>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#48a6a7] px-5 py-3 text-sm font-extrabold text-white transition hover:bg-[#399091] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <RefreshCw
                      size={17}
                      className="animate-spin"
                    />
                    Kaydinaya...
                  </>
                ) : (
                  <>
                    <PackagePlus size={17} />
                    Samee Purchase Order
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* ============================================================
            ORDERS
        ============================================================ */}
        <section className="overflow-hidden rounded-2xl border border-[#d9d2c3] bg-white shadow-sm">

          {/* Toolbar */}
          <div className="flex flex-col gap-4 border-b border-[#e7e1d2] bg-[#faf8f3] px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">

            <div>
              <h2 className="text-sm font-extrabold text-[#15314a]">
                Purchase Orders
              </h2>

              <p className="mt-1 text-xs text-[#7a858e]">
                Diiwaanka purchases iyo stock receiving
              </p>
            </div>

            <div className="flex w-full items-center gap-2 md:w-auto">
              <div className="relative w-full md:w-[300px]">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#87929b]"
                />

                <input
                  type="text"
                  value={search}
                  onChange={(e) =>
                    setSearch(e.target.value)
                  }
                  placeholder="Raadi supplier, branch, alaab..."
                  className="w-full rounded-xl border border-[#d9d2c3] bg-white py-2.5 pl-9 pr-9 text-sm text-[#15314a] outline-none transition focus:border-[#48a6a7] focus:ring-2 focus:ring-[#48a6a7]/15"
                />

                {search && (
                  <button
                    type="button"
                    onClick={() =>
                      setSearch("")
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-[#7d8991] hover:bg-[#f2efe7]"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={loadAll}
                disabled={loading}
                title="Cusboonaysii"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#d9d2c3] bg-white text-[#52616d] transition hover:border-[#48a6a7] hover:text-[#247b7c] disabled:opacity-50"
              >
                <RefreshCw
                  size={16}
                  className={
                    loading
                      ? "animate-spin"
                      : ""
                  }
                />
              </button>
            </div>
          </div>

          {/* Loading */}
          {loading ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#48a6a7]/10 text-[#247b7c]">
                <RefreshCw
                  size={22}
                  className="animate-spin"
                />
              </div>

              <p className="text-sm font-bold text-[#15314a]">
                Soo dejinaya...
              </p>

              <p className="mt-1 text-xs text-[#7a858e]">
                Purchase orders ayaa la keenayaa.
              </p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f2efe7] text-[#71808b]">
                {search ? (
                  <Search size={24} />
                ) : (
                  <ClipboardList size={24} />
                )}
              </div>

              <h3 className="text-sm font-extrabold text-[#15314a]">
                {search
                  ? "Wax natiijo ah lama helin"
                  : "Wali purchase order lama samayn"}
              </h3>

              <p className="mt-1 max-w-sm text-xs leading-5 text-[#7a858e]">
                {search
                  ? "Isku day search kale."
                  : "Isticmaal foomka kore si aad purchase order cusub u samayso."}
              </p>
            </div>
          ) : (
            <div className="space-y-4 bg-[#f7f4ed] p-4 md:p-5">
              {filteredOrders.map((order) => (
                <div
                  className="overflow-hidden rounded-2xl border border-[#d9d2c3] bg-white shadow-sm"
                  key={order.id}
                >
                  {/* Order Header */}
                  <div className="flex flex-col gap-4 border-b border-[#e7e1d2] bg-[#faf8f3] px-5 py-4 md:flex-row md:items-center md:justify-between">

                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#48a6a7]/10 text-[#247b7c]">
                        <Truck size={18} />
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-extrabold text-[#15314a]">
                            {order.suppliers
                              ?.name || "Supplier —"}
                          </h3>

                          <span className="text-[#a1a8ad]">
                            ·
                          </span>

                          <span className="text-xs font-medium text-[#687780]">
                            {order.branches
                              ?.name || "Branch —"}
                          </span>
                        </div>

                        <p className="mt-1 text-[11px] text-[#8a949b]">
                          Purchase Order ·{" "}
                          {order.id.slice(
                            0,
                            8
                          )}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`inline-flex w-fit items-center rounded-full border px-3 py-1.5 text-xs font-bold ${statusClass(
                        order.status
                      )}`}
                    >
                      {order.status ===
                        "received" && (
                        <PackageCheck
                          size={14}
                          className="mr-1.5"
                        />
                      )}

                      {order.status ===
                        "pending" && (
                        <Clock3
                          size={14}
                          className="mr-1.5"
                        />
                      )}

                      {statusLabel(
                        order.status
                      )}
                    </span>
                  </div>

                  {/* Items */}
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[650px] border-collapse">
                      <thead>
                        <tr className="border-b border-[#eee9df] bg-white">
                          <th className="px-5 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#6d7882]">
                            Alaabta
                          </th>

                          <th className="px-5 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#6d7882]">
                            Tirada
                          </th>

                          <th className="px-5 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#6d7882]">
                            Qiimaha halkii
                          </th>

                          <th className="px-5 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#6d7882]">
                            La helay
                          </th>

                          <th className="px-5 py-3 text-right text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#6d7882]">
                            Subtotal
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {order.purchase_items.map(
                          (item) => (
                            <tr
                              key={item.id}
                              className="border-b border-[#f0ece5]"
                            >
                              <td className="px-5 py-3.5 text-sm font-semibold text-[#354957]">
                                {item.products
                                  ?.name ||
                                  "—"}
                              </td>

                              <td className="px-5 py-3.5 text-sm text-[#52616d]">
                                {item.quantity}
                              </td>

                              <td className="px-5 py-3.5 text-sm text-[#52616d]">
                                {money(
                                  item.unit_cost
                                )}
                              </td>

                              <td className="px-5 py-3.5">
                                <span
                                  className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-bold ${
                                    Number(
                                      item.received_quantity
                                    ) >=
                                    Number(
                                      item.quantity
                                    )
                                      ? "bg-[#eef9f2] text-[#28734b]"
                                      : "bg-[#fff9ed] text-[#936d23]"
                                  }`}
                                >
                                  {
                                    item.received_quantity
                                  }
                                </span>
                              </td>

                              <td className="px-5 py-3.5 text-right text-sm font-bold text-[#15314a]">
                                {money(
                                  Number(
                                    item.quantity
                                  ) *
                                    Number(
                                      item.unit_cost
                                    )
                                )}
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Order Footer */}
                  <div className="flex flex-col gap-4 bg-[#faf8f3] px-5 py-4 md:flex-row md:items-center md:justify-between">

                    <div>
                      <span className="text-xs text-[#7a858e]">
                        Order Total
                      </span>

                      <p className="text-lg font-extrabold text-[#15314a]">
                        {money(
                          order.total_amount
                        )}
                      </p>
                    </div>

                    {order.status !==
                      "received" && (
                      <button
                        type="button"
                        onClick={() =>
                          handleReceive(
                            order
                          )
                        }
                        disabled={
                          receivingId ===
                          order.id
                        }
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#48a6a7] px-5 py-2.5 text-sm font-extrabold text-white transition hover:bg-[#398f90] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {receivingId ===
                        order.id ? (
                          <>
                            <RefreshCw
                              size={16}
                              className="animate-spin"
                            />
                            Receiving...
                          </>
                        ) : (
                          <>
                            <PackageCheck
                              size={17}
                            />
                            Receive · Ku dar Stock
                          </>
                        )}
                      </button>
                    )}

                    {order.status ===
                      "received" && (
                      <div className="inline-flex items-center gap-2 rounded-xl border border-[#b9dcca] bg-[#eef9f2] px-4 py-2.5 text-xs font-bold text-[#28734b]">
                        <PackageCheck
                          size={16}
                        />
                        Stock waa la helay
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading &&
            filteredOrders.length > 0 && (
              <div className="flex flex-col gap-2 border-t border-[#e7e1d2] bg-[#faf8f3] px-5 py-3 text-xs text-[#7a858e] md:flex-row md:items-center md:justify-between">
                <span>
                  Muujinaya{" "}
                  <strong className="text-[#15314a]">
                    {filteredOrders.length}
                  </strong>{" "}
                  purchase order
                  {filteredOrders.length !==
                  1
                    ? "s"
                    : ""}
                </span>

                {search && (
                  <span>
                    Search:{" "}
                    <strong className="text-[#247b7c]">
                      "{search}"
                    </strong>
                  </span>
                )}
              </div>
            )}
        </section>
      </div>
    </div>
  );
}