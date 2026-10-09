import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { useAuth } from "../lib/AuthContext.jsx";
import {
  Banknote,
  CreditCard,
  Receipt,
  ShoppingCart,
  Smartphone,
  Trash2,
  WalletCards,
} from "lucide-react";

const emptyLine = {
  product_id: "",
  quantity: "",
  unit_price: "",
};

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "evc_plus", label: "EVC Plus", icon: Smartphone },
  { value: "edahab", label: "eDahab", icon: Smartphone },
  { value: "bank", label: "Bank", icon: WalletCards },
  { value: "card", label: "Card", icon: CreditCard },
  { value: "credit", label: "Credit (deyn)", icon: Receipt },
];

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

export default function Sales() {
  const { profile } = useAuth();

  const [sales, setSales] = useState([]);
  const [branches, setBranches] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [stockLevels, setStockLevels] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [branchId, setBranchId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [discount, setDiscount] = useState("0");
  const [tax, setTax] = useState("0");
  const [lines, setLines] = useState([{ ...emptyLine }]);

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

    const [
      salesRes,
      branchesRes,
      customersRes,
      productsRes,
      stockRes,
    ] = await Promise.all([
      supabase
        .from("sales")
        .select(
          "*, customers(name), branches(name), sale_items(*, products(name))"
        )
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false }),

      supabase
        .from("branches")
        .select("id, name")
        .eq("organization_id", organizationId)
        .order("name"),

      supabase
        .from("customers")
        .select("id, name, balance")
        .eq("organization_id", organizationId)
        .order("name"),

      supabase
        .from("products")
        .select("id, name, selling_price, unit, status")
        .eq("organization_id", organizationId)
        .order("name"),

      supabase
        .from("stock_batches")
        .select("id, branch_id, product_id, quantity")
        .eq("organization_id", organizationId),
    ]);

    if (salesRes.error) {
      setError(salesRes.error.message);
      setLoading(false);
      return;
    }

    if (branchesRes.error) {
      setError(branchesRes.error.message);
      setLoading(false);
      return;
    }

    if (customersRes.error) {
      setError(customersRes.error.message);
      setLoading(false);
      return;
    }

    if (productsRes.error) {
      setError(productsRes.error.message);
      setLoading(false);
      return;
    }

    if (stockRes.error) {
      setError(stockRes.error.message);
      setLoading(false);
      return;
    }

    /*
      IMPORTANT:
      Do NOT use key.split("-") here because UUIDs contain "-".

      Instead, store branch_id and product_id directly
      inside each stock row.
    */
    const stockMap = {};

    (stockRes.data || []).forEach((batch) => {
      const key = `${batch.branch_id}:${batch.product_id}`;

      if (!stockMap[key]) {
        stockMap[key] = {
          branch_id: batch.branch_id,
          product_id: batch.product_id,
          quantity_on_hand: 0,
        };
      }

      stockMap[key].quantity_on_hand += Number(
        batch.quantity || 0
      );
    });

    const stockRows = Object.values(stockMap);

    setSales(salesRes.data || []);
    setBranches(branchesRes.data || []);
    setCustomers(customersRes.data || []);
    setProducts(productsRes.data || []);
    setStockLevels(stockRows);

    setLoading(false);
  }

  function availableStock(productId, selectedBranchId = branchId) {
    if (!selectedBranchId || !productId) {
      return 0;
    }

    const row = stockLevels.find(
      (stock) =>
        stock.branch_id === selectedBranchId &&
        stock.product_id === productId
    );

    return row ? Number(row.quantity_on_hand) : 0;
  }

  /*
    Products that belong to the selected branch's
    available inventory.

    We keep products with zero stock visible so the
    cashier can clearly see that they are unavailable.
  */
  const branchProducts = useMemo(() => {
    if (!branchId) {
      return products;
    }

    return products;
  }, [products, branchId]);

  function updateLine(index, key, value) {
    setLines((prev) => {
      const next = [...prev];

      next[index] = {
        ...next[index],
        [key]: value,
      };

      if (key === "product_id") {
        const product = products.find(
          (p) => p.id === value
        );

        if (product) {
          next[index].unit_price =
            product.selling_price ?? "";
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

  const subtotal = useMemo(
    () =>
      lines.reduce(
        (sum, line) =>
          sum +
          (Number(line.quantity) || 0) *
            (Number(line.unit_price) || 0),
        0
      ),
    [lines]
  );

  const total =
    subtotal -
    (Number(discount) || 0) +
    (Number(tax) || 0);

  async function handleCreateSale(e) {
    e.preventDefault();

    setError("");

    if (!profile?.organization_id) {
      setError(
        "Profile-kaaga wali lama xirin organization."
      );
      return;
    }

    if (!branchId) {
      setError("Fadlan dooro branch.");
      return;
    }

    const validLines = lines.filter(
      (line) =>
        line.product_id &&
        Number(line.quantity) > 0
    );

    if (validLines.length === 0) {
      setError(
        "Fadlan ku dar ugu yaraan hal alaab oo tiro leh."
      );
      return;
    }

    if (
      paymentMethod === "credit" &&
      !customerId
    ) {
      setError(
        "Iibinta deynta (credit) waxay u baahan tahay inaad dooratid macmiil."
      );
      return;
    }

    /*
      Prevent duplicate products in the same sale
      from bypassing stock validation.

      Example:
      Stock = 10
      Line 1 = 6
      Line 2 = 6

      Total requested = 12 -> reject.
    */
    const requestedByProduct = {};

    for (const line of validLines) {
      if (!requestedByProduct[line.product_id]) {
        requestedByProduct[line.product_id] = 0;
      }

      requestedByProduct[line.product_id] +=
        Number(line.quantity);
    }

    for (const [productId, requested] of Object.entries(
      requestedByProduct
    )) {
      const available = availableStock(productId);

      if (requested > available) {
        const product = products.find(
          (p) => p.id === productId
        );

        setError(
          `Stock kuma filna: ${
            product?.name || "Alaabta"
          }. Hadda waxaa jira ${available}, waxaad rabtaa ${requested}.`
        );

        return;
      }
    }

    /*
      Prevent negative totals.
    */
    if (total < 0) {
      setError(
        "Total-ka iibka ma noqon karo lacag taban."
      );
      return;
    }

    setSaving(true);

    const invoiceNumber = `INV-${Date.now()}`;

    const paymentStatus =
      paymentMethod === "credit"
        ? "unpaid"
        : "paid";

    const { data: sale, error: saleError } =
      await supabase
        .from("sales")
        .insert({
          organization_id:
            profile.organization_id,
          branch_id: branchId,
          customer_id: customerId || null,
          invoice_number: invoiceNumber,
          subtotal,
          discount: Number(discount) || 0,
          tax: Number(tax) || 0,
          total,
          payment_status: paymentStatus,
          payment_method: paymentMethod,
          status: "completed",
          cashier_id: profile.id,
        })
        .select()
        .single();

    if (saleError) {
      setError(saleError.message);
      setSaving(false);
      return;
    }

    try {
      /*
        ------------------------------------------------------------
        1. CREATE SALE ITEMS
        ------------------------------------------------------------
      */
      const itemsPayload = validLines.map(
        (line) => ({
          sale_id: sale.id,
          product_id: line.product_id,
          quantity: Number(line.quantity),
          unit_price:
            Number(line.unit_price) || 0,
          discount: 0,
          total:
            Number(line.quantity) *
            (Number(line.unit_price) || 0),
        })
      );

      const { error: itemsError } =
        await supabase
          .from("sale_items")
          .insert(itemsPayload);

      if (itemsError) {
        throw itemsError;
      }

      /*
        ------------------------------------------------------------
        2. REDUCE INVENTORY
        ------------------------------------------------------------

        We use the SAME stock_batches table that Inventory
        reads from.

        Positive batch:
          Purchase / adjustment +100

        Negative batch:
          Sale -5

        Inventory calculates:
          +100 - 5 = 95
      */
      for (const line of validLines) {
        const quantity = Number(line.quantity);

        const { data: batch, error: batchError } =
          await supabase
            .from("stock_batches")
            .insert({
              organization_id:
                profile.organization_id,
              branch_id: branchId,
              product_id: line.product_id,
              quantity: -quantity,
              received_at:
                new Date().toISOString(),
            })
            .select()
            .single();

        if (batchError) {
          throw batchError;
        }

        /*
          ----------------------------------------------------------
          3. RECORD STOCK MOVEMENT
          ----------------------------------------------------------
        */
        const { error: moveError } =
          await supabase
            .from("stock_movements")
            .insert({
              organization_id:
                profile.organization_id,
              branch_id: branchId,
              product_id: line.product_id,
              batch_id: batch.id,
              movement_type: "sale",
              quantity: -quantity,
              reference_type: "sale",
              reference_id: sale.id,
              created_by: profile.id,
            });

        if (moveError) {
          throw moveError;
        }
      }

      /*
        ------------------------------------------------------------
        4. CUSTOMER CREDIT
        ------------------------------------------------------------
      */
      if (paymentMethod === "credit") {
        const customer = customers.find(
          (customerItem) =>
            customerItem.id === customerId
        );

        const newBalance =
          (Number(customer?.balance) || 0) +
          total;

        const { error: balanceError } =
          await supabase
            .from("customers")
            .update({
              balance: newBalance,
            })
            .eq("id", customerId)
            .eq(
              "organization_id",
              profile.organization_id
            );

        if (balanceError) {
          throw balanceError;
        }
      } else {
        /*
          ----------------------------------------------------------
          5. PAYMENT
          ----------------------------------------------------------
        */
        const { error: paymentError } =
          await supabase
            .from("payments")
            .insert({
              organization_id:
                profile.organization_id,
              sale_id: sale.id,
              customer_id:
                customerId || null,
              amount: total,
              method: paymentMethod,
            });

        if (paymentError) {
          throw paymentError;
        }
      }

      /*
        ------------------------------------------------------------
        6. RESET POS
        ------------------------------------------------------------
      */
      setBranchId("");
      setCustomerId("");
      setPaymentMethod("cash");
      setDiscount("0");
      setTax("0");
      setLines([{ ...emptyLine }]);

      /*
        ------------------------------------------------------------
        7. RELOAD INVENTORY + SALES
        ------------------------------------------------------------
      */
      await loadAll();
    } catch (err) {
      setError(
        `Sale-ka waa la abuuray (${invoiceNumber}) laakiin qaybo ka mid ah (stock/payment) way fashilantay: ${err.message}. Fadlan hubi Inventory bogga.`
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-full bg-[#f2efe7] p-4 md:p-6 lg:p-8">
      {/* PAGE HEADER */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#48a6a7]">
            <span className="h-2 w-2 rounded-full bg-[#48a6a7]" />
            Point of Sale
          </div>

          <h1 className="text-3xl font-black tracking-tight text-[#13293d] md:text-4xl">
            Sales / POS
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5e6b75]">
            Samee iib cusub. POS-ku wuxuu akhriyaa
            stock-ga Inventory-ga branch-ka aad
            dooratay, iibkuna si otomaatig ah ayuu
            stock uga jarayaa.
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-[#d8d2c4] bg-[#fffdf8] px-4 py-3 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#13293d] text-[#d7b46a]">
            <ShoppingCart size={20} />
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#7c858c]">
              Current Sale
            </p>

            <p className="text-sm font-black text-[#13293d]">
              {
                lines.filter(
                  (line) =>
                    line.product_id &&
                    Number(line.quantity) > 0
                ).length
              }{" "}
              item(s)
            </p>
          </div>
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="mb-5 rounded-2xl border border-[#e2b7b2] bg-[#fff4f2] px-4 py-3 text-sm font-medium text-[#9b3028]">
          {error}
        </div>
      )}

      {/* POS FORM */}
      <form onSubmit={handleCreateSale}>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          {/* LEFT */}
          <div className="rounded-3xl border border-[#d8d2c4] bg-[#fffdf8] shadow-[0_12px_35px_rgba(19,41,61,0.06)]">
            <div className="border-b border-[#e3ded3] px-5 py-5 md:px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e8f4f3] text-[#287d80]">
                  <Receipt size={21} />
                </div>

                <div>
                  <h2 className="text-base font-black text-[#13293d]">
                    New Sale
                  </h2>

                  <p className="text-xs text-[#7c858c]">
                    Geli xogta iibka hoose
                  </p>
                </div>
              </div>
            </div>

            {/* Branch / Customer / Payment */}
            <div className="grid gap-4 border-b border-[#e3ded3] p-5 md:grid-cols-3 md:p-6">
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#69757e]">
                  Branch
                </span>

                <select
                  value={branchId}
                  onChange={(e) => {
                    setBranchId(e.target.value);

                    /*
                      Branch changes mean the selected product
                      may have different stock.
                    */
                    setLines((prev) =>
                      prev.map((line) => ({
                        ...line,
                      }))
                    );
                  }}
                  required
                  className="h-11 w-full rounded-xl border border-[#d6d1c7] bg-[#f8f5ed] px-3 text-sm font-medium text-[#13293d] outline-none transition focus:border-[#48a6a7] focus:ring-4 focus:ring-[#48a6a7]/10"
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

              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#69757e]">
                  Macmiil
                </span>

                <select
                  value={customerId}
                  onChange={(e) =>
                    setCustomerId(e.target.value)
                  }
                  className="h-11 w-full rounded-xl border border-[#d6d1c7] bg-[#f8f5ed] px-3 text-sm font-medium text-[#13293d] outline-none transition focus:border-[#48a6a7] focus:ring-4 focus:ring-[#48a6a7]/10"
                >
                  <option value="">
                    — Macmiil (ikhtiyaari) —
                  </option>

                  {customers.map((customer) => (
                    <option
                      key={customer.id}
                      value={customer.id}
                    >
                      {customer.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#69757e]">
                  Payment
                </span>

                <select
                  value={paymentMethod}
                  onChange={(e) =>
                    setPaymentMethod(e.target.value)
                  }
                  className="h-11 w-full rounded-xl border border-[#d6d1c7] bg-[#f8f5ed] px-3 text-sm font-medium text-[#13293d] outline-none transition focus:border-[#48a6a7] focus:ring-4 focus:ring-[#48a6a7]/10"
                >
                  {PAYMENT_METHODS.map(
                    (method) => (
                      <option
                        key={method.value}
                        value={method.value}
                      >
                        {method.label}
                      </option>
                    )
                  )}
                </select>
              </label>
            </div>

            {/* Sale lines */}
            <div className="p-5 md:p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-[#13293d]">
                    Alaabta
                  </h3>

                  <p className="mt-1 text-xs text-[#7c858c]">
                    Ku dar dawooyinka ama alaabta
                    iibka ku jirta.
                  </p>
                </div>

                <span className="rounded-full bg-[#e8f4f3] px-3 py-1 text-[11px] font-bold text-[#287d80]">
                  {lines.length} line
                  {lines.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="mb-2 hidden grid-cols-[minmax(0,1fr)_120px_150px_100px_42px] gap-3 px-1 text-[10px] font-black uppercase tracking-wider text-[#8a9298] lg:grid">
                <span>Alaabta</span>
                <span>Tirada</span>
                <span>Qiimaha</span>
                <span>Stock</span>
                <span />
              </div>

              <div className="space-y-3">
                {lines.map((line, index) => {
                  const available =
                    branchId && line.product_id
                      ? availableStock(
                          line.product_id
                        )
                      : null;

                  const over =
                    available !== null &&
                    Number(line.quantity) >
                      available;

                  return (
                    <div
                      className={`rounded-2xl border p-3 transition ${
                        over
                          ? "border-[#d98b84] bg-[#fff5f3]"
                          : "border-[#e1ddd4] bg-[#faf8f2]"
                      }`}
                      key={index}
                    >
                      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_120px_150px_100px_42px] lg:items-center">
                        <label>
                          <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-[#8a9298] lg:hidden">
                            Alaabta
                          </span>

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
                            className="h-10 w-full rounded-lg border border-[#d6d1c7] bg-white px-3 text-sm font-medium text-[#13293d] outline-none focus:border-[#48a6a7]"
                          >
                            <option value="">
                              — Alaabta —
                            </option>

                            {branchProducts.map(
                              (product) => {
                                const stock =
                                  availableStock(
                                    product.id
                                  );

                                return (
                                  <option
                                    key={
                                      product.id
                                    }
                                    value={
                                      product.id
                                    }
                                  >
                                    {product.name} · Stock:{" "}
                                    {stock}
                                  </option>
                                );
                              }
                            )}
                          </select>
                        </label>

                        <label>
                          <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-[#8a9298] lg:hidden">
                            Tirada
                          </span>

                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Tirada"
                            value={
                              line.quantity
                            }
                            onChange={(e) =>
                              updateLine(
                                index,
                                "quantity",
                                e.target.value
                              )
                            }
                            className={`h-10 w-full rounded-lg border bg-white px-3 text-sm font-semibold text-[#13293d] outline-none ${
                              over
                                ? "border-[#b94136] ring-2 ring-[#b94136]/10"
                                : "border-[#d6d1c7] focus:border-[#48a6a7]"
                            }`}
                          />
                        </label>

                        <label>
                          <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-[#8a9298] lg:hidden">
                            Qiimaha halkii
                          </span>

                          <div className="relative">
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#8a9298]">
                              $
                            </span>

                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="Qiimaha"
                              value={
                                line.unit_price
                              }
                              onChange={(e) =>
                                updateLine(
                                  index,
                                  "unit_price",
                                  e.target.value
                                )
                              }
                              className="h-10 w-full rounded-lg border border-[#d6d1c7] bg-white pl-7 pr-3 text-sm font-semibold text-[#13293d] outline-none focus:border-[#48a6a7]"
                            />
                          </div>
                        </label>

                        <div>
                          <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-[#8a9298] lg:hidden">
                            Stock
                          </span>

                          {available !== null ? (
                            <div
                              className={`flex h-10 items-center rounded-lg px-3 text-xs font-black ${
                                over
                                  ? "bg-[#fde8e5] text-[#a5312a]"
                                  : available ===
                                    0
                                  ? "bg-[#fff1d7] text-[#96702a]"
                                  : "bg-[#e8f4f3] text-[#287d80]"
                              }`}
                            >
                              {available}
                            </div>
                          ) : (
                            <div className="flex h-10 items-center rounded-lg bg-[#eeeae1] px-3 text-xs font-bold text-[#8a9298]">
                              —
                            </div>
                          )}
                        </div>

                        <div className="flex justify-end">
                          {lines.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                removeLine(index)
                              }
                              title="Ka saar"
                              className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#e0b7b3] bg-[#fff5f3] text-[#a5312a] transition hover:bg-[#fbe3df]"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>

                      {over && (
                        <p className="mt-2 text-xs font-semibold text-[#a5312a]">
                          ⚠ Stock kuma filna.
                          Hadda waxaa jira{" "}
                          {available}, waxaad
                          rabtaa{" "}
                          {line.quantity}.
                        </p>
                      )}

                      {available === 0 &&
                        line.product_id &&
                        !over && (
                          <p className="mt-2 text-xs font-semibold text-[#96702a]">
                            ⚠ Alaabtan branch-kan
                            stock kama hayso.
                          </p>
                        )}
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={addLine}
                className="mt-4 flex items-center gap-2 rounded-xl border border-dashed border-[#aebfbe] bg-[#f4f9f8] px-4 py-2.5 text-xs font-black text-[#287d80] transition hover:border-[#48a6a7] hover:bg-[#e8f4f3]"
              >
                <span className="text-base">
                  +
                </span>
                Ku dar alaab kale
              </button>
            </div>
          </div>

          {/* RIGHT */}
          <div className="h-fit space-y-4">
            <div className="overflow-hidden rounded-3xl border border-[#d8d2c4] bg-[#13293d] text-white shadow-[0_16px_40px_rgba(19,41,61,0.14)]">
              <div className="border-b border-white/10 px-5 py-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#48a6a7] text-white">
                    <ShoppingCart size={19} />
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-[#9fc5c5]">
                      Checkout
                    </p>

                    <h2 className="text-lg font-black">
                      Sale Summary
                    </h2>
                  </div>
                </div>
              </div>

              <div className="space-y-4 px-5 py-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#b9c6ce]">
                    Subtotal
                  </span>

                  <span className="font-bold">
                    {money(subtotal)}
                  </span>
                </div>

                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-[#9eb0ba]">
                    Discount
                  </label>

                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#8fa2ad]">
                      $
                    </span>

                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={discount}
                      onChange={(e) =>
                        setDiscount(
                          e.target.value
                        )
                      }
                      className="h-10 w-full rounded-xl border border-white/10 bg-white/10 pl-7 pr-3 text-sm font-bold text-white outline-none placeholder:text-[#80929d] focus:border-[#48a6a7]"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-[#9eb0ba]">
                    Tax
                  </label>

                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#8fa2ad]">
                      $
                    </span>

                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={tax}
                      onChange={(e) =>
                        setTax(e.target.value)
                      }
                      className="h-10 w-full rounded-xl border border-white/10 bg-white/10 pl-7 pr-3 text-sm font-bold text-white outline-none placeholder:text-[#80929d] focus:border-[#48a6a7]"
                    />
                  </div>
                </div>

                <div className="border-t border-white/10 pt-4">
                  <div className="flex items-end justify-between">
                    <span className="text-sm font-bold text-[#b9c6ce]">
                      Total
                    </span>

                    <span className="text-3xl font-black tracking-tight text-[#d7b46a]">
                      {money(total)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="border-t border-white/10 p-5">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#48a6a7] text-sm font-black text-white shadow-lg shadow-black/10 transition hover:bg-[#3d9697] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Receipt size={18} />

                  {saving
                    ? "Processing..."
                    : "Samee Iibka"}
                </button>
              </div>
            </div>

            {/* Payment methods */}
            <div className="rounded-3xl border border-[#d8d2c4] bg-[#fffdf8] p-5">
              <p className="mb-3 text-[10px] font-black uppercase tracking-[0.16em] text-[#8a9298]">
                Payment Method
              </p>

              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map(
                  (method) => {
                    const Icon = method.icon;
                    const active =
                      paymentMethod ===
                      method.value;

                    return (
                      <button
                        key={method.value}
                        type="button"
                        onClick={() =>
                          setPaymentMethod(
                            method.value
                          )
                        }
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-bold transition ${
                          active
                            ? "border-[#48a6a7] bg-[#e8f4f3] text-[#287d80]"
                            : "border-[#e0dcd3] bg-[#faf8f2] text-[#68747d] hover:border-[#b9cfce]"
                        }`}
                      >
                        <Icon size={15} />

                        <span className="truncate">
                          {method.label}
                        </span>
                      </button>
                    );
                  }
                )}
              </div>

              {paymentMethod === "credit" && (
                <div className="mt-3 rounded-xl bg-[#fff5dc] px-3 py-2.5 text-xs font-semibold leading-5 text-[#856622]">
                  ⚠ Credit sale waxay kordhinaysaa
                  balance-ka macmiilka.
                </div>
              )}
            </div>
          </div>
        </div>
      </form>

      {/* SALES HISTORY */}
      <div className="mt-8">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-[#13293d]">
                Sales History
              </h2>

              <span className="rounded-full bg-[#e8f4f3] px-2.5 py-1 text-[10px] font-black text-[#287d80]">
                {sales.length}
              </span>
            </div>

            <p className="mt-1 text-xs text-[#7c858c]">
              Dhammaan iibkii ugu dambeeyay ee
              organization-ka.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-[#d8d2c4] bg-[#fffdf8] px-5 py-12 text-center text-sm font-semibold text-[#7c858c]">
            Soo dejinaya sales...
          </div>
        ) : sales.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[#cfc8bb] bg-[#fffdf8] px-5 py-14 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e8f4f3] text-[#287d80]">
              <Receipt size={21} />
            </div>

            <p className="text-sm font-black text-[#13293d]">
              Wali iib lama samayn
            </p>

            <p className="mt-1 text-xs text-[#7c858c]">
              Marka iib cusub la sameeyo,
              history-ga wuxuu halkan ka soo
              muuqan doonaa.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sales.map((sale) => (
              <div
                className="overflow-hidden rounded-3xl border border-[#d8d2c4] bg-[#fffdf8] shadow-sm"
                key={sale.id}
              >
                <div className="flex flex-col gap-4 border-b border-[#e3ded3] px-5 py-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f0eee7] text-[#13293d]">
                      <Receipt size={18} />
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-sm font-black text-[#13293d]">
                          {sale.invoice_number}
                        </strong>

                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
                            sale.payment_status ===
                            "paid"
                              ? "bg-[#e8f4f3] text-[#287d80]"
                              : "bg-[#fff1d2] text-[#8b6921]"
                          }`}
                        >
                          {sale.payment_status}
                        </span>

                        <span className="rounded-full bg-[#f0eee7] px-2.5 py-1 text-[10px] font-bold text-[#6f7a82]">
                          {sale.payment_method}
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-[#7c858c]">
                        {sale.branches?.name ||
                          "—"}

                        {sale.customers?.name
                          ? ` · ${sale.customers.name}`
                          : ""}
                      </p>
                    </div>
                  </div>

                  <div className="text-left md:text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#8a9298]">
                      Total
                    </p>

                    <p className="text-xl font-black text-[#13293d]">
                      {money(sale.total)}
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-left">
                    <thead>
                      <tr className="border-b border-[#e8e4db] bg-[#faf8f2] text-[10px] font-black uppercase tracking-wider text-[#8a9298]">
                        <th className="px-5 py-3">
                          Alaabta
                        </th>

                        <th className="px-5 py-3">
                          Tirada
                        </th>

                        <th className="px-5 py-3">
                          Qiimaha
                        </th>

                        <th className="px-5 py-3">
                          Total
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {(sale.sale_items || []).map(
                        (item) => (
                          <tr
                            key={item.id}
                            className="border-b border-[#eeeae2] last:border-0"
                          >
                            <td className="px-5 py-3 text-sm font-semibold text-[#273b4b]">
                              {item.products?.name ||
                                "—"}
                            </td>

                            <td className="px-5 py-3 text-sm font-medium text-[#68747d]">
                              {item.quantity}
                            </td>

                            <td className="px-5 py-3 text-sm font-medium text-[#68747d]">
                              {money(
                                item.unit_price
                              )}
                            </td>

                            <td className="px-5 py-3 text-sm font-black text-[#13293d]">
                              {money(item.total)}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col gap-2 bg-[#faf8f2] px-5 py-3 text-xs text-[#7c858c] md:flex-row md:items-center md:justify-between">
                  <span>
                    {new Date(
                      sale.created_at
                    ).toLocaleString()}
                  </span>

                  <span className="font-bold text-[#13293d]">
                    {sale.sale_items?.length || 0}{" "}
                    item(s)
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}