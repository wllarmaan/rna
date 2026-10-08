import React, { useEffect, useMemo, useState } from "react";
import {
  Plus,
  ShoppingCart,
  DollarSign,
  Package,
  AlertTriangle,
  Users,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  Truck,
  Clock,
} from "lucide-react";

import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient.js";
import { useAuth } from "../lib/AuthContext.jsx";

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

export default function Dashboard() {
  const { profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [products, setProducts] = useState([]);
  const [stockBatches, setStockBatches] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  useEffect(() => {
    async function loadDashboard() {
      if (!profile?.organization_id) {
        setLoading(false);
        return;
      }

      setLoading(true);

      const organizationId = profile.organization_id;

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
          .limit(20),

        supabase
          .from("expenses")
          .select("*")
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: false })
          .limit(50),

        supabase
          .from("products")
          .select("*")
          .eq("organization_id", organizationId),

        supabase
          .from("stock_batches")
          .select("*")
          .eq("organization_id", organizationId),

        supabase
          .from("purchase_orders")
          .select("*")
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: false })
          .limit(10),

        supabase
          .from("customers")
          .select("*")
          .eq("organization_id", organizationId),

        supabase
          .from("suppliers")
          .select("*")
          .eq("organization_id", organizationId),
      ]);

      if (salesResult.error) {
        console.error("Dashboard sales:", salesResult.error);
      }

      if (expensesResult.error) {
        console.error("Dashboard expenses:", expensesResult.error);
      }

      if (productsResult.error) {
        console.error("Dashboard products:", productsResult.error);
      }

      if (stockResult.error) {
        console.error("Dashboard stock:", stockResult.error);
      }

      if (purchasesResult.error) {
        console.error(
          "Dashboard purchase orders:",
          purchasesResult.error
        );
      }

      if (customersResult.error) {
        console.error(
          "Dashboard customers:",
          customersResult.error
        );
      }

      if (suppliersResult.error) {
        console.error(
          "Dashboard suppliers:",
          suppliersResult.error
        );
      }

      setSales(salesResult.data || []);
      setExpenses(expensesResult.data || []);
      setProducts(productsResult.data || []);
      setStockBatches(stockResult.data || []);
      setPurchaseOrders(purchasesResult.data || []);
      setCustomers(customersResult.data || []);
      setSuppliers(suppliersResult.data || []);

      setLoading(false);
    }

    loadDashboard();
  }, [profile?.organization_id]);

  const today = new Date().toISOString().slice(0, 10);

  const todaySales = useMemo(() => {
    return sales.filter((sale) => {
      const date = sale.created_at || sale.sale_date;
      return date?.slice(0, 10) === today;
    });
  }, [sales, today]);

  const todayExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      const date = expense.created_at || expense.expense_date;
      return date?.slice(0, 10) === today;
    });
  }, [expenses, today]);

  const salesTodayTotal = useMemo(() => {
    return todaySales.reduce(
      (sum, sale) =>
        sum +
        Number(
          sale.total ??
            sale.grand_total ??
            sale.amount ??
            0
        ),
      0
    );
  }, [todaySales]);

  const expensesTodayTotal = useMemo(() => {
    return todayExpenses.reduce(
      (sum, expense) =>
        sum +
        Number(
          expense.amount ??
            expense.total ??
            0
        ),
      0
    );
  }, [todayExpenses]);

  const stockByProduct = useMemo(() => {
    const map = {};

    for (const batch of stockBatches) {
      const productId = batch.product_id;

      if (!productId) {
        continue;
      }

      map[productId] =
        (map[productId] || 0) +
        Number(batch.quantity || 0);
    }

    return map;
  }, [stockBatches]);

  const lowStockProducts = useMemo(() => {
    return products.filter((product) => {
      const quantity =
        Number(stockByProduct[product.id] || 0);

      const reorderLevel =
        Number(product.reorder_level || 0);

      return quantity <= reorderLevel;
    });
  }, [products, stockByProduct]);

  const receivables = useMemo(() => {
    return customers.reduce(
      (sum, customer) =>
        sum +
        Number(
          customer.balance ??
            customer.balance_due ??
            customer.debt ??
            0
        ),
      0
    );
  }, [customers]);

  const payables = useMemo(() => {
    return suppliers.reduce(
      (sum, supplier) =>
        sum +
        Number(
          supplier.balance ??
            supplier.balance_due ??
            supplier.debt ??
            0
        ),
      0
    );
  }, [suppliers]);

  /*
   * Current schema does not store sale-item unit cost directly.
   * Therefore true COGS cannot yet be calculated here.
   */
  const cogs = 0;

  const grossProfit =
    salesTodayTotal - cogs;

  const netProfit =
    grossProfit - expensesTodayTotal;

  const recentSales = sales.slice(0, 5);
  const recentPurchases = purchaseOrders.slice(0, 5);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f7f4] p-6 md:p-8">
        <div className="mx-auto max-w-7xl animate-pulse space-y-8">
          <div className="h-32 rounded-3xl bg-white" />

          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
            {[1, 2, 3, 4, 5].map((item) => (
              <div
                key={item}
                className="h-40 rounded-2xl bg-white"
              />
            ))}
          </div>

          <div className="h-64 rounded-3xl bg-white" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f7f4]">
      <div className="mx-auto max-w-[1600px] p-5 md:p-8">

        {/* =====================================================
            HEADER
        ====================================================== */}
        <header className="mb-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">
                MEDVORA • ALAQSA
              </p>

              <h1 className="font-serif text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
                Dashboard
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 md:text-base">
                Xaalada ganacsigaaga maanta — xogtan waa mid nool
                (live).
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                to="/products"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
              >
                <Plus size={18} />
                Add Medicine
              </Link>

              <Link
                to="/sales"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800"
              >
                <ShoppingCart size={18} />
                New Sale
              </Link>
            </div>
          </div>
        </header>

        {/* =====================================================
            KPI CARDS
        ====================================================== */}
        <section className="mb-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-5">

          {/* Sales */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  Iibka maanta
                </p>

                <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
                  {money(salesTodayTotal)}
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <DollarSign size={21} />
              </div>
            </div>

            <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
              <ArrowUpRight size={14} />
              {todaySales.length} iib maanta
            </div>
          </div>

          {/* Orders */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  Tirada iibabka maanta
                </p>

                <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
                  {todaySales.length}
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                <ShoppingCart size={20} />
              </div>
            </div>

            <p className="mt-4 text-xs font-medium text-slate-400">
              Total orders
            </p>
          </div>

          {/* Expenses */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  Kharashaadka maanta
                </p>

                <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
                  {money(expensesTodayTotal)}
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <Receipt size={20} />
              </div>
            </div>

            <p className="mt-4 text-xs font-medium text-slate-400">
              Today's expenses
            </p>
          </div>

          {/* Low Stock */}
          <div className="rounded-2xl border border-orange-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  Alaab low-stock ah
                </p>

                <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
                  {lowStockProducts.length}
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                <AlertTriangle size={20} />
              </div>
            </div>

            <p className="mt-4 text-xs font-semibold text-orange-600">
              Reorder needed
            </p>
          </div>

          {/* Receivables */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  Receivables
                </p>

                <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
                  {money(receivables)}
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-purple-100 text-purple-600">
                <Users size={20} />
              </div>
            </div>

            <p className="mt-4 text-xs font-medium text-slate-400">
              Customer debts
            </p>
          </div>
        </section>

        {/* =====================================================
            FINANCIAL SNAPSHOT
        ====================================================== */}
        <section className="mb-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-600">
              FINANCIAL OVERVIEW
            </p>

            <h2 className="mt-1 text-xl font-bold text-slate-900">
              Financial Snapshot
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 xl:grid-cols-4">

            <div className="border-b border-slate-100 p-6 sm:border-r xl:border-b-0">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <Package size={19} />
              </div>

              <p className="text-sm font-medium text-slate-500">
                Cost of Medicines Sold
              </p>

              <p className="mt-2 text-2xl font-bold text-slate-900">
                {money(cogs)}
              </p>

              <p className="mt-1 text-xs text-slate-400">
                COGS
              </p>
            </div>

            <div className="border-b border-emerald-200 bg-emerald-50/50 p-6 sm:border-r xl:border-b-0">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                <TrendingUp size={19} />
              </div>

              <p className="text-sm font-medium text-slate-500">
                Gross Profit
              </p>

              <p className="mt-2 text-2xl font-bold text-emerald-700">
                {money(grossProfit)}
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Sales - COGS
              </p>
            </div>

            <div className="border-b border-slate-100 p-6 sm:border-r xl:border-b-0">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                <Receipt size={19} />
              </div>

              <p className="text-sm font-medium text-slate-500">
                Expenses Today
              </p>

              <p className="mt-2 text-2xl font-bold text-slate-900">
                {money(expensesTodayTotal)}
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Operating expenses
              </p>
            </div>

            <div className="p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
                <Truck size={19} />
              </div>

              <p className="text-sm font-medium text-slate-500">
                Payables
              </p>

              <p className="mt-2 text-2xl font-bold text-slate-900">
                {money(payables)}
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Supplier balances
              </p>
            </div>
          </div>
        </section>

        {/* =====================================================
            ACTIVITY
        ====================================================== */}
        <section className="grid gap-6 xl:grid-cols-2">

          {/* Recent Sales */}
          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-600">
                  ACTIVITY
                </p>

                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  Iibka ugu dambeeyay
                </h2>
              </div>

              <Link
                to="/sales"
                className="text-sm font-semibold text-emerald-600 hover:text-emerald-700"
              >
                View all
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {recentSales.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <ShoppingCart
                    size={30}
                    className="mx-auto text-slate-300"
                  />

                  <p className="mt-3 text-sm text-slate-500">
                    Weli iib lama diiwaangelin.
                  </p>
                </div>
              ) : (
                recentSales.map((sale) => (
                  <div
                    key={sale.id}
                    className="flex items-center gap-4 px-6 py-4"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <ShoppingCart size={17} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {sale.invoice_number ||
                          sale.invoice_no ||
                          `Sale #${String(
                            sale.id
                          ).slice(0, 8)}`}
                      </p>

                      <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                        <Clock size={12} />

                        {sale.created_at
                          ? new Date(
                              sale.created_at
                            ).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-900">
                        {money(
                          sale.total ??
                            sale.grand_total ??
                            sale.amount
                        )}
                      </p>

                      <p className="mt-1 text-xs font-medium text-emerald-600">
                        Completed
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Purchase Orders */}
          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600">
                  PROCUREMENT
                </p>

                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  Purchase orders ugu dambeeyay
                </h2>
              </div>

              <Link
                to="/purchases"
                className="text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                View all
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {recentPurchases.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <Truck
                    size={30}
                    className="mx-auto text-slate-300"
                  />

                  <p className="mt-3 text-sm text-slate-500">
                    Weli purchase order lama diiwaangelin.
                  </p>
                </div>
              ) : (
                recentPurchases.map((purchase) => (
                  <div
                    key={purchase.id}
                    className="flex items-center gap-4 px-6 py-4"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                      <Truck size={17} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {purchase.order_number ||
                          purchase.invoice_number ||
                          `PO #${String(
                            purchase.id
                          ).slice(0, 8)}`}
                      </p>

                      <p className="mt-1 text-xs capitalize text-slate-400">
                        {purchase.status || "Pending"}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-900">
                        {money(
                          purchase.total ??
                            purchase.grand_total ??
                            purchase.amount
                        )}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        Purchase
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* =====================================================
            PROFIT NOTE
        ====================================================== */}
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
          <div className="flex gap-3">
            <AlertTriangle
              size={18}
              className="mt-0.5 shrink-0 text-amber-600"
            />

            <div>
              <p className="text-sm font-bold text-amber-800">
                Fiiro gaar ah — COGS
              </p>

              <p className="mt-1 text-xs leading-5 text-amber-700">
                Cost of Medicines Sold hadda waa $0.00 sababtoo ah
                schema-ga sale_items ma hayo unit cost. Sidaas darteed
                Gross Profit hadda waa sales minus $0.00. COGS sax ah
                waxaan ku dari karnaa marka stock-batch cost allocation
                la hirgeliyo.
              </p>
            </div>
          </div>
        </div>

        {/* Net Profit mini summary */}
        <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-900 p-6 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
              TODAY'S NET PROFIT
            </p>

            <p className="mt-1 text-sm text-slate-300">
              Gross profit minus operating expenses
            </p>
          </div>

          <div className="flex items-center gap-3">
            {netProfit >= 0 ? (
              <ArrowUpRight
                size={22}
                className="text-emerald-400"
              />
            ) : (
              <ArrowDownRight
                size={22}
                className="text-red-400"
              />
            )}

            <span className="text-3xl font-bold">
              {money(netProfit)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}