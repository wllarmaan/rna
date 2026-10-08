import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";


export default function Dashboard() {
  const { profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [products, setProducts] = useState([]);
  const [stockBatches, setStockBatches] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  const organizationId = profile?.organization_id;

  const organizationName =
    profile?.organizations?.name ||
    profile?.organization_name ||
    "ALAQSA";

  const money = useCallback((value) => {
    return `$${Number(value || 0).toFixed(2)}`;
  }, []);

  const todayKey = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }, []);

  const isToday = useCallback(
    (dateValue) => {
      if (!dateValue) return false;

      const date = new Date(dateValue);

      if (Number.isNaN(date.getTime())) {
        return String(dateValue).startsWith(todayKey);
      }

      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");

      return `${year}-${month}-${day}` === todayKey;
    },
    [todayKey]
  );

  const fetchDashboard = useCallback(async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const [
        salesResult,
        expensesResult,
        productsResult,
        stockResult,
        purchasesResult,
        customersResult,
        suppliersResult,
      ] = await Promise.all([
        supabase
          .from("sales")
          .select("*")
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: false })
          .limit(50),

        supabase
          .from("expenses")
          .select("*")
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: false })
          .limit(100),

        supabase
          .from("products")
          .select("*")
          .eq("organization_id", organizationId),

        supabase
          .from("stock_batches")
          .select("*")
          .eq("organization_id", organizationId)
          .order("expiry_date", { ascending: true }),

        supabase
          .from("purchase_orders")
          .select("*")
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: false })
          .limit(20),

        supabase
          .from("customers")
          .select("*")
          .eq("organization_id", organizationId),

        supabase
          .from("suppliers")
          .select("*")
          .eq("organization_id", organizationId),
      ]);

      const results = [
        salesResult,
        expensesResult,
        productsResult,
        stockResult,
        purchasesResult,
        customersResult,
        suppliersResult,
      ];

      const failed = results.find((result) => result.error);

      if (failed?.error) {
        throw failed.error;
      }

      setSales(salesResult.data || []);
      setExpenses(expensesResult.data || []);
      setProducts(productsResult.data || []);
      setStockBatches(stockResult.data || []);
      setPurchaseOrders(purchasesResult.data || []);
      setCustomers(customersResult.data || []);
      setSuppliers(suppliersResult.data || []);
    } catch (err) {
      console.error("Dashboard error:", err);
      setError(
        err?.message ||
          "Xogta Dashboard-ka lama soo dejin karin."
      );
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  /* --------------------------------
     SALES
  -------------------------------- */

  const todaySales = useMemo(() => {
    return sales.filter((sale) =>
      isToday(
        sale.created_at ||
          sale.sale_date ||
          sale.date ||
          sale.transaction_date
      )
    );
  }, [sales, isToday]);

  const totalTodaySales = useMemo(() => {
    return todaySales.reduce((sum, sale) => {
      return (
        sum +
        Number(
          sale.total ??
            sale.grand_total ??
            sale.amount ??
            sale.net_total ??
            0
        )
      );
    }, 0);
  }, [todaySales]);

  /* --------------------------------
     EXPENSES
  -------------------------------- */

  const todayExpenses = useMemo(() => {
    return expenses.filter((expense) =>
      isToday(
        expense.created_at ||
          expense.expense_date ||
          expense.date
      )
    );
  }, [expenses, isToday]);

  const totalTodayExpenses = useMemo(() => {
    return todayExpenses.reduce((sum, expense) => {
      return (
        sum +
        Number(
          expense.amount ??
            expense.total ??
            expense.cost ??
            0
        )
      );
    }, 0);
  }, [todayExpenses]);

  /* --------------------------------
     STOCK
  -------------------------------- */

  const stockByProduct = useMemo(() => {
    const map = {};

    stockBatches.forEach((batch) => {
      const productId = batch.product_id;

      if (!productId) return;

      if (!map[productId]) {
        map[productId] = {
          quantity: 0,
          nearestExpiry: null,
        };
      }

      map[productId].quantity += Number(
        batch.quantity || 0
      );

      if (
        batch.expiry_date &&
        (!map[productId].nearestExpiry ||
          new Date(batch.expiry_date) <
            new Date(map[productId].nearestExpiry))
      ) {
        map[productId].nearestExpiry =
          batch.expiry_date;
      }
    });

    return map;
  }, [stockBatches]);

  const lowStockProducts = useMemo(() => {
    return products
      .map((product) => {
        const stock =
          stockByProduct[product.id]?.quantity || 0;

        const reorderLevel = Number(
          product.reorder_level || 0
        );

        return {
          ...product,
          quantity_on_hand: stock,
          reorderLevel,
        };
      })
      .filter(
        (product) =>
          product.quantity_on_hand <=
          product.reorderLevel
      )
      .sort(
        (a, b) =>
          a.quantity_on_hand -
          b.quantity_on_hand
      );
  }, [products, stockByProduct]);

  /* --------------------------------
     RECEIVABLES / PAYABLES
  -------------------------------- */

  const receivables = useMemo(() => {
    return customers.reduce((sum, customer) => {
      return (
        sum +
        Number(
          customer.balance ??
            customer.amount_due ??
            customer.receivable ??
            0
        )
      );
    }, 0);
  }, [customers]);

  const payables = useMemo(() => {
    return suppliers.reduce((sum, supplier) => {
      return (
        sum +
        Number(
          supplier.balance ??
            supplier.amount_due ??
            supplier.payable ??
            0
        )
      );
    }, 0);
  }, [suppliers]);

  /* --------------------------------
     COGS
     --------------------------------
     sale_items currently has no unit_cost,
     so exact COGS is not available yet.
  -------------------------------- */

  const cogs = 0;

  const grossProfit = totalTodaySales - cogs;

  const netProfit =
    grossProfit - totalTodayExpenses;

  /* --------------------------------
     HELPERS
  -------------------------------- */

  const getSaleNumber = (sale) => {
    return (
      sale.invoice_number ||
      sale.invoice_no ||
      sale.reference_number ||
      sale.id ||
      "Sale"
    );
  };

  const getSaleCustomer = (sale) => {
    return (
      sale.customer_name ||
      sale.customer ||
      "Cash Customer"
    );
  };

  const getSaleTotal = (sale) => {
    return Number(
      sale.total ??
        sale.grand_total ??
        sale.amount ??
        sale.net_total ??
        0
    );
  };

  const getPurchaseNumber = (purchase) => {
    return (
      purchase.invoice_number ||
      purchase.invoice_no ||
      purchase.order_number ||
      purchase.reference_number ||
      purchase.id ||
      "Purchase"
    );
  };

  const getPurchaseTotal = (purchase) => {
    return Number(
      purchase.total ??
        purchase.grand_total ??
        purchase.amount ??
        0
    );
  };

  const formatDate = (value) => {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime = (value) => {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  /* --------------------------------
     LOADING
  -------------------------------- */

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f7f4] p-6">
        <div className="mx-auto max-w-[1500px] animate-pulse space-y-6">
          <div className="h-32 rounded-2xl bg-white border border-slate-200" />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="h-32 rounded-2xl bg-white border border-slate-200"
              />
            ))}
          </div>

          <div className="h-10 w-64 rounded-lg bg-slate-200" />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-32 rounded-2xl bg-white border border-slate-200"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f7f4] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-7">

        {/* =====================================
            HEADER
        ====================================== */}

        <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">
              MEDVORA • {organizationName}
            </p>

            <h1 className="font-serif text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Dashboard
            </h1>

            <p className="mt-2 text-sm text-slate-500 sm:text-base">
              Xaalada ganacsigaaga maanta — xogtan waa
              mid nool (live).
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              to="/products"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
            >
              + Add Medicine
            </Link>

            <Link
              to="/sales"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              🛒 New Sale
            </Link>
          </div>
        </header>

        {/* ERROR */}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* =====================================
            PRIMARY METRICS
        ====================================== */}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">

          {/* SALES */}

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.03)]">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-lg font-bold text-emerald-700">
                $
              </div>

              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500">
                  Iibka maanta
                </p>

                <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                  {money(totalTodaySales)}
                </p>

                <p className="mt-1 text-xs text-emerald-600">
                  {todaySales.length} iib maanta
                </p>
              </div>
            </div>
          </div>

          {/* ORDERS */}

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.03)]">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-lg font-bold text-blue-600">
                #
              </div>

              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500">
                  Tirada iibabka maanta
                </p>

                <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                  {todaySales.length}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Total orders
                </p>
              </div>
            </div>
          </div>

          {/* EXPENSES */}

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.03)]">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-lg font-bold text-amber-700">
                $
              </div>

              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500">
                  Kharashaadka maanta
                </p>

                <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                  {money(totalTodayExpenses)}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Today's expenses
                </p>
              </div>
            </div>
          </div>

          {/* LOW STOCK */}

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.03)]">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-lg font-bold text-orange-600">
                !
              </div>

              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500">
                  Alaab low-stock ah
                </p>

                <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                  {lowStockProducts.length}
                </p>

                <p className="mt-1 text-xs text-orange-600">
                  Reorder needed
                </p>
              </div>
            </div>
          </div>

          {/* RECEIVABLES */}

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.03)]">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-purple-100 text-lg font-bold text-purple-700">
                $
              </div>

              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500">
                  Receivables
                </p>

                <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                  {money(receivables)}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Customer debts
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* =====================================
            FINANCIAL SNAPSHOT
        ====================================== */}

        <section>
          <div className="mb-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">
              FINANCIAL OVERVIEW
            </p>

            <h2 className="mt-1 font-serif text-2xl font-bold text-slate-900">
              Financial Snapshot
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">

            {/* COGS */}

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.03)]">
              <p className="text-sm font-semibold text-slate-700">
                Cost of Medicines Sold
              </p>

              <p className="mt-3 text-2xl font-bold text-slate-900">
                {money(cogs)}
              </p>

              <p className="mt-1 text-xs text-slate-400">
                COGS
              </p>
            </div>

            {/* GROSS PROFIT */}

            <div className="rounded-2xl border-2 border-emerald-500 bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.03)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    Gross Profit
                  </p>

                  <p className="mt-3 text-2xl font-bold text-emerald-700">
                    {money(grossProfit)}
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    Sales - COGS
                  </p>
                </div>

                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase text-emerald-700">
                  Profit
                </span>
              </div>
            </div>

            {/* EXPENSES */}

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.03)]">
              <p className="text-sm font-semibold text-slate-700">
                Expenses Today
              </p>

              <p className="mt-3 text-2xl font-bold text-slate-900">
                {money(totalTodayExpenses)}
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Operating expenses
              </p>
            </div>

            {/* PAYABLES */}

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.03)]">
              <p className="text-sm font-semibold text-slate-700">
                Payables
              </p>

              <p className="mt-3 text-2xl font-bold text-slate-900">
                {money(payables)}
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Supplier balances
              </p>
            </div>
          </div>
        </section>

        {/* =====================================
            RECENT TRANSACTIONS
        ====================================== */}

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">

          {/* RECENT SALES */}

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.03)]">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <p className="font-serif text-xl font-bold text-slate-900">
                  Iibka ugu dambeeyay
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Recent sales activity
                </p>
              </div>

              <Link
                to="/sales"
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
              >
                View all →
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {sales.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-400">
                    ✓
                  </div>

                  <p className="mt-3 text-sm font-semibold text-slate-700">
                    No recent sales
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    Iib cusub ayaa halkan kasoo muuqan doona.
                  </p>
                </div>
              ) : (
                sales.slice(0, 6).map((sale) => (
                  <div
                    key={sale.id}
                    className="flex items-center justify-between gap-4 px-5 py-4"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-sm font-bold text-emerald-700">
                        ✓
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {getSaleNumber(sale)}
                        </p>

                        <p className="truncate text-xs text-slate-400">
                          {getSaleCustomer(sale)}
                        </p>

                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {formatDate(
                            sale.created_at ||
                              sale.sale_date ||
                              sale.date
                          )}{" "}
                          {formatTime(sale.created_at)}
                        </p>
                      </div>
                    </div>

                    <strong className="shrink-0 text-sm font-bold text-slate-900">
                      {money(getSaleTotal(sale))}
                    </strong>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* PURCHASE ORDERS */}

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.03)]">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <p className="font-serif text-xl font-bold text-slate-900">
                  Purchase orders ugu dambeeyay
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Recent purchasing activity
                </p>
              </div>

              <Link
                to="/purchases"
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
              >
                View all →
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {purchaseOrders.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-400">
                    —
                  </div>

                  <p className="mt-3 text-sm font-semibold text-slate-700">
                    No purchase orders
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    Purchase orders-ka cusub halkan ayay kasoo muuqan doonaan.
                  </p>
                </div>
              ) : (
                purchaseOrders.slice(0, 6).map((purchase) => (
                  <div
                    key={purchase.id}
                    className="flex items-center justify-between gap-4 px-5 py-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {getPurchaseNumber(purchase)}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        {formatDate(
                          purchase.created_at ||
                            purchase.order_date ||
                            purchase.date
                        )}
                      </p>
                    </div>

                    <strong className="shrink-0 text-sm font-bold text-slate-900">
                      {money(getPurchaseTotal(purchase))}
                    </strong>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* =====================================
            LOW STOCK
        ====================================== */}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.03)]">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-serif text-xl font-bold text-slate-900">
                Low Stock
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Alaabta u baahan reorder
              </p>
            </div>

            <Link
              to="/inventory"
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
            >
              Open Inventory →
            </Link>
          </div>

          {lowStockProducts.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm font-semibold text-slate-700">
                Stock-ku waa hagaagsan yahay
              </p>

              <p className="mt-1 text-xs text-slate-400">
                No low-stock products.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70">
                    <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      Product
                    </th>

                    <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      Stock
                    </th>

                    <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      Reorder Level
                    </th>

                    <th className="px-5 py-3 text-right text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {lowStockProducts.slice(0, 8).map((product) => (
                    <tr
                      key={product.id}
                      className="border-b border-slate-50 last:border-0"
                    >
                      <td className="px-5 py-4">
                        <p className="text-sm font-semibold text-slate-800">
                          {product.name ||
                            product.product_name ||
                            "Unnamed product"}
                        </p>

                        {product.sku && (
                          <p className="mt-1 text-xs text-slate-400">
                            SKU: {product.sku}
                          </p>
                        )}
                      </td>

                      <td className="px-5 py-4 text-sm font-semibold text-slate-700">
                        {product.quantity_on_hand}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-500">
                        {product.reorderLevel}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <span className="inline-flex rounded-full bg-orange-50 px-3 py-1 text-[11px] font-bold text-orange-700">
                          Reorder needed
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* =====================================
            NET PROFIT
        ====================================== */}

        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">
                TODAY'S PERFORMANCE
              </p>

              <h2 className="mt-1 font-serif text-2xl font-bold text-slate-900">
                Net Profit Today
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Gross profit minus operating expenses.
              </p>
            </div>

            <div className="text-left sm:text-right">
              <p className="text-3xl font-bold tracking-tight text-emerald-700">
                {money(netProfit)}
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Sales {money(totalTodaySales)} − Expenses{" "}
                {money(totalTodayExpenses)}
              </p>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}