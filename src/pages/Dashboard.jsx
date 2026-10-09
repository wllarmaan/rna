import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  AlertTriangle,
  BarChart3,
  Boxes,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Package,
  ShoppingCart,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";

import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

export default function Dashboard() {
  const { profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [sales, setSales] = useState([]);
  const [saleItems, setSaleItems] = useState([]);
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
    "Your Organization";

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
        saleItemsResult,
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
          .from("sale_items")
          .select(`
            id,
            sale_id,
            product_id,
            batch_id,
            quantity,
            unit_price,
            discount,
            total
          `)
          .limit(1000),

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
        saleItemsResult,
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
      setSaleItems(saleItemsResult.data || []);
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
    if (organizationId) {
      fetchDashboard();
    }
  }, [organizationId, fetchDashboard]);

  /* ============================================================
     SALES
  ============================================================ */

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

  /* ============================================================
     EXPENSES
  ============================================================ */

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

  /* ============================================================
     STOCK
  ============================================================ */

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

  /* ============================================================
     RECEIVABLES / PAYABLES
  ============================================================ */

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

  /* ============================================================
     COGS
  ============================================================ */

  const stockBatchCostMap = useMemo(() => {
    const map = {};

    stockBatches.forEach((batch) => {
      if (!batch.id) return;

      map[batch.id] = Number(
        batch.unit_cost || 0
      );
    });

    return map;
  }, [stockBatches]);

  const saleMap = useMemo(() => {
    const map = {};

    sales.forEach((sale) => {
      if (!sale.id) return;

      map[sale.id] = sale;
    });

    return map;
  }, [sales]);

  const todaySaleItems = useMemo(() => {
    return saleItems.filter((item) => {
      const sale = saleMap[item.sale_id];

      if (!sale) return false;

      return isToday(
        sale.created_at ||
          sale.sale_date ||
          sale.date ||
          sale.transaction_date
      );
    });
  }, [saleItems, saleMap, isToday]);

  const cogs = useMemo(() => {
    return todaySaleItems.reduce((sum, item) => {
      const quantity = Number(item.quantity || 0);

      if (quantity <= 0) return sum;

      const unitCost = Number(
        stockBatchCostMap[item.batch_id] || 0
      );

      return sum + quantity * unitCost;
    }, 0);
  }, [todaySaleItems, stockBatchCostMap]);

  const grossProfit = totalTodaySales - cogs;

  const netProfit =
    grossProfit - totalTodayExpenses;

  /* ============================================================
     HELPERS
  ============================================================ */

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
      purchase.total_amount ??
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

  /* ============================================================
     LOADING
  ============================================================ */

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f2efe7] p-4 sm:p-6">
        <div className="mx-auto max-w-[1500px] animate-pulse space-y-6">

          <div className="h-40 rounded-3xl border border-[#d9e2df] bg-white" />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="h-32 rounded-2xl border border-[#d9e2df] bg-white"
              />
            ))}
          </div>

          <div className="h-8 w-64 rounded-lg bg-[#dfe7e2]" />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-32 rounded-2xl border border-[#d9e2df] bg-white"
              />
            ))}
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f2efe7] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">

      <div className="mx-auto max-w-[1500px] space-y-7">

        {/* ======================================================
            HEADER
        ======================================================= */}

        <header
          className="
            relative
            overflow-hidden
            rounded-[28px]
            border
            border-[#23455b]
            bg-[#13293d]
            px-6
            py-7
            text-white
            shadow-[0_18px_50px_rgba(19,41,61,0.14)]
            sm:px-8
            sm:py-8
          "
        >

          <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[#48a6a7]/10 blur-2xl" />

          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-[#d7b46a]/10 blur-3xl" />

          <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">

            <div>

              <div className="mb-3 flex items-center gap-2">

                <span className="h-2 w-2 rounded-full bg-[#48a6a7]" />

                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#9acbd0]">
                  MEDVORA • {organizationName}
                </p>

              </div>

              <h1 className="font-serif text-4xl font-bold tracking-tight text-[#f3f7f5] sm:text-5xl">
                Dashboard
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#b8cccf] sm:text-base">
                Xaalada ganacsigaaga maanta — xogtan waa
                mid nool (live).
              </p>

            </div>

            <div className="flex flex-wrap gap-3">

              <Link
                to="/products"
                className="
                  inline-flex
                  h-11
                  items-center
                  justify-center
                  gap-2
                  rounded-xl
                  border
                  border-white/10
                  bg-white/[0.07]
                  px-5
                  text-sm
                  font-semibold
                  text-[#eaf4f3]
                  transition
                  hover:bg-white/[0.12]
                "
              >
                <Package size={16} />
                Add Medicine
              </Link>

              <Link
                to="/sales"
                className="
                  inline-flex
                  h-11
                  items-center
                  justify-center
                  gap-2
                  rounded-xl
                  bg-[#48a6a7]
                  px-5
                  text-sm
                  font-semibold
                  text-white
                  shadow-lg
                  shadow-black/15
                  transition
                  hover:bg-[#3b9294]
                "
              >
                <ShoppingCart size={16} />
                New Sale
              </Link>

            </div>

          </div>

        </header>

        {/* ======================================================
            ERROR
        ======================================================= */}

        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">

            <AlertTriangle
              size={18}
              className="mt-0.5 shrink-0"
            />

            <span>{error}</span>

          </div>
        )}

        {/* ======================================================
            PRIMARY METRICS
        ======================================================= */}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">

          <MetricCard
            icon={CircleDollarSign}
            label="Iibka maanta"
            value={money(totalTodaySales)}
            description={`${todaySales.length} iib maanta`}
            tone="teal"
          />

          <MetricCard
            icon={ShoppingCart}
            label="Tirada iibabka maanta"
            value={todaySales.length}
            description="Total orders"
            tone="blue"
          />

          <MetricCard
            icon={WalletCards}
            label="Kharashaadka maanta"
            value={money(totalTodayExpenses)}
            description="Today's expenses"
            tone="gold"
          />

          <MetricCard
            icon={AlertTriangle}
            label="Alaab low-stock ah"
            value={lowStockProducts.length}
            description="Reorder needed"
            tone="orange"
          />

          <MetricCard
            icon={CreditCard}
            label="Receivables"
            value={money(receivables)}
            description="Customer debts"
            tone="purple"
          />

        </section>

        {/* ======================================================
            FINANCIAL OVERVIEW
        ======================================================= */}

        <section>

          <SectionHeading
            eyebrow="FINANCIAL OVERVIEW"
            title="Financial Snapshot"
            icon={BarChart3}
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">

            <FinanceCard
              title="Cost of Medicines Sold"
              value={money(cogs)}
              description="COGS"
              icon={Boxes}
            />

            <FinanceCard
              title="Gross Profit"
              value={money(grossProfit)}
              description="Sales - COGS"
              icon={TrendingUp}
              highlighted
            />

            <FinanceCard
              title="Expenses Today"
              value={money(totalTodayExpenses)}
              description="Operating expenses"
              icon={WalletCards}
            />

            <FinanceCard
              title="Payables"
              value={money(payables)}
              description="Supplier balances"
              icon={CreditCard}
            />

          </div>

        </section>

        {/* ======================================================
            RECENT TRANSACTIONS
        ======================================================= */}

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">

          <DashboardPanel
            title="Iibka ugu dambeeyay"
            subtitle="Recent sales activity"
            link="/sales"
            linkText="View all"
            icon={ShoppingCart}
          >

            {sales.length === 0 ? (
              <EmptyState
                icon={ShoppingCart}
                title="No recent sales"
                description="Iib cusub ayaa halkan kasoo muuqan doona."
              />
            ) : (
              <div className="divide-y divide-[#edf1ef]">

                {sales.slice(0, 6).map((sale) => (

                  <div
                    key={sale.id}
                    className="
                      flex
                      items-center
                      justify-between
                      gap-4
                      px-5
                      py-4
                      transition
                      hover:bg-[#f7f9f7]
                    "
                  >

                    <div className="flex min-w-0 items-center gap-3">

                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e7f4f3] text-[#3f9597]">
                        <ShoppingCart size={17} />
                      </div>

                      <div className="min-w-0">

                        <p className="truncate text-sm font-bold text-[#15314a]">
                          {getSaleNumber(sale)}
                        </p>

                        <p className="truncate text-xs text-[#60727c]">
                          {getSaleCustomer(sale)}
                        </p>

                        <p className="mt-0.5 flex items-center gap-1 text-[10px] text-[#8b9a9e]">
                          <Clock3 size={10} />

                          {formatDate(
                            sale.created_at ||
                              sale.sale_date ||
                              sale.date
                          )}

                          {formatTime(sale.created_at) &&
                            ` • ${formatTime(
                              sale.created_at
                            )}`}
                        </p>

                      </div>

                    </div>

                    <strong className="shrink-0 text-sm font-bold text-[#15314a]">
                      {money(getSaleTotal(sale))}
                    </strong>

                  </div>

                ))}

              </div>
            )}

          </DashboardPanel>

          <DashboardPanel
            title="Purchase orders ugu dambeeyay"
            subtitle="Recent purchasing activity"
            link="/purchases"
            linkText="View all"
            icon={Package}
          >

            {purchaseOrders.length === 0 ? (
              <EmptyState
                icon={Package}
                title="No purchase orders"
                description="Purchase orders-ka cusub halkan ayay kasoo muuqan doonaan."
              />
            ) : (
              <div className="divide-y divide-[#edf1ef]">

                {purchaseOrders.slice(0, 6).map((purchase) => (

                  <div
                    key={purchase.id}
                    className="
                      flex
                      items-center
                      justify-between
                      gap-4
                      px-5
                      py-4
                      transition
                      hover:bg-[#f7f9f7]
                    "
                  >

                    <div className="flex min-w-0 items-center gap-3">

                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f2eee2] text-[#a78647]">
                        <Package size={17} />
                      </div>

                      <div className="min-w-0">

                        <p className="truncate text-sm font-bold text-[#15314a]">
                          {getPurchaseNumber(purchase)}
                        </p>

                        <p className="mt-1 text-xs text-[#8b9a9e]">
                          {formatDate(
                            purchase.created_at ||
                              purchase.order_date ||
                              purchase.date
                          )}
                        </p>

                      </div>

                    </div>

                    <strong className="shrink-0 text-sm font-bold text-[#15314a]">
                      {money(getPurchaseTotal(purchase))}
                    </strong>

                  </div>

                ))}

              </div>
            )}

          </DashboardPanel>

        </section>

        {/* ======================================================
            LOW STOCK
        ======================================================= */}

        <section className="overflow-hidden rounded-3xl border border-[#d9e2df] bg-white shadow-[0_8px_30px_rgba(19,41,61,0.045)]">

          <div className="flex flex-col gap-3 border-b border-[#edf1ef] px-5 py-5 sm:flex-row sm:items-center sm:justify-between">

            <SectionHeading
              eyebrow="INVENTORY ALERT"
              title="Low Stock"
              subtitle="Alaabta u baahan reorder"
              icon={AlertTriangle}
              compact
            />

            <Link
              to="/inventory"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#3f8f91] transition hover:text-[#276c6e]"
            >
              Open Inventory
              <ArrowRight size={14} />
            </Link>

          </div>

          {lowStockProducts.length === 0 ? (
            <div className="px-5 py-12 text-center">

              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e7f4f3] text-[#3f9597]">
                <Package size={20} />
              </div>

              <p className="mt-3 text-sm font-bold text-[#15314a]">
                Stock-ku waa hagaagsan yahay
              </p>

              <p className="mt-1 text-xs text-[#8b9a9e]">
                No low-stock products.
              </p>

            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full min-w-[650px]">

                <thead>

                  <tr className="border-b border-[#edf1ef] bg-[#f8faf8]">

                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-[#849399]">
                      Product
                    </th>

                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-[#849399]">
                      Stock
                    </th>

                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-[#849399]">
                      Reorder Level
                    </th>

                    <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-[0.12em] text-[#849399]">
                      Status
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {lowStockProducts
                    .slice(0, 8)
                    .map((product) => (

                      <tr
                        key={product.id}
                        className="border-b border-[#f0f3f1] last:border-0"
                      >

                        <td className="px-5 py-4">

                          <p className="text-sm font-bold text-[#15314a]">
                            {product.name ||
                              product.product_name ||
                              "Unnamed product"}
                          </p>

                          {product.sku && (
                            <p className="mt-1 text-xs text-[#8b9a9e]">
                              SKU: {product.sku}
                            </p>
                          )}

                        </td>

                        <td className="px-5 py-4 text-sm font-bold text-[#15314a]">
                          {product.quantity_on_hand}
                        </td>

                        <td className="px-5 py-4 text-sm text-[#64767d]">
                          {product.reorderLevel}
                        </td>

                        <td className="px-5 py-4 text-right">

                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fff4df] px-3 py-1.5 text-[10px] font-bold text-[#9b6d18]">
                            <AlertTriangle size={11} />
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

        {/* ======================================================
            NET PROFIT
        ======================================================= */}

        <section
          className="
            relative
            overflow-hidden
            rounded-3xl
            border
            border-[#b8d8d5]
            bg-[#e7f4f3]
            px-5
            py-6
            sm:px-7
          "
        >

          <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-[#48a6a7]/10 blur-3xl" />

          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

            <div>

              <div className="flex items-center gap-2">

                <TrendingUp
                  size={15}
                  className="text-[#3f8f91]"
                />

                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#3f8f91]">
                  TODAY'S PERFORMANCE
                </p>

              </div>

              <h2 className="mt-1 font-serif text-2xl font-bold text-[#15314a]">
                Net Profit Today
              </h2>

              <p className="mt-1 text-sm text-[#60777d]">
                Gross profit minus operating expenses.
              </p>

            </div>

            <div className="text-left sm:text-right">

              <p className="text-3xl font-bold tracking-tight text-[#287d80]">
                {money(netProfit)}
              </p>

              <p className="mt-1 text-xs text-[#71878b]">
                Sales {money(totalTodaySales)} − COGS{" "}
                {money(cogs)} − Expenses{" "}
                {money(totalTodayExpenses)}
              </p>

            </div>

          </div>

        </section>

      </div>

    </div>
  );
}

/* ================================================================
   REUSABLE DASHBOARD COMPONENTS
================================================================ */

function MetricCard({
  icon: Icon,
  label,
  value,
  description,
  tone = "teal",
}) {
  const tones = {
    teal: {
      icon: "bg-[#e7f4f3] text-[#3f9597]",
    },
    blue: {
      icon: "bg-[#e9f0f7] text-[#39749b]",
    },
    gold: {
      icon: "bg-[#f5efdf] text-[#a17b30]",
    },
    orange: {
      icon: "bg-[#fff0df] text-[#c17a25]",
    },
    purple: {
      icon: "bg-[#eeeaf7] text-[#765a9d]",
    },
  };

  return (
    <div
      className="
        rounded-2xl
        border
        border-[#d9e2df]
        bg-white
        p-5
        shadow-[0_6px_24px_rgba(19,41,61,0.035)]
        transition
        duration-200
        hover:-translate-y-0.5
        hover:shadow-[0_10px_30px_rgba(19,41,61,0.07)]
      "
    >

      <div className="flex items-start gap-4">

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tones[tone].icon}`}
        >
          <Icon size={19} strokeWidth={2} />
        </div>

        <div className="min-w-0">

          <p className="text-xs font-semibold text-[#718187]">
            {label}
          </p>

          <p className="mt-1 text-2xl font-bold tracking-tight text-[#15314a]">
            {value}
          </p>

          <p className="mt-1 truncate text-[10px] font-medium text-[#8b9a9e]">
            {description}
          </p>

        </div>

      </div>

    </div>
  );
}

function FinanceCard({
  title,
  value,
  description,
  icon: Icon,
  highlighted = false,
}) {
  return (
    <div
      className={[
        "rounded-2xl bg-white p-5 shadow-[0_6px_24px_rgba(19,41,61,0.035)]",
        highlighted
          ? "border-2 border-[#48a6a7]"
          : "border border-[#d9e2df]",
      ].join(" ")}
    >

      <div className="flex items-start justify-between gap-4">

        <div>

          <p className="text-sm font-semibold text-[#435c67]">
            {title}
          </p>

          <p
            className={[
              "mt-3 text-2xl font-bold",
              highlighted
                ? "text-[#287d80]"
                : "text-[#15314a]",
            ].join(" ")}
          >
            {value}
          </p>

          <p className="mt-1 text-xs text-[#8b9a9e]">
            {description}
          </p>

        </div>

        <div
          className={[
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            highlighted
              ? "bg-[#e7f4f3] text-[#3f9597]"
              : "bg-[#f1f4f2] text-[#6e838a]",
          ].join(" ")}
        >
          <Icon size={17} />
        </div>

      </div>

    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  subtitle,
  icon: Icon,
  compact = false,
}) {
  return (
    <div className={compact ? "" : "mb-4"}>

      <div className="flex items-center gap-2">

        {Icon && (
          <Icon
            size={14}
            className="text-[#3f8f91]"
          />
        )}

        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#3f8f91]">
          {eyebrow}
        </p>

      </div>

      <h2
        className={[
          "font-serif font-bold text-[#15314a]",
          compact
            ? "mt-1 text-xl"
            : "mt-1 text-2xl",
        ].join(" ")}
      >
        {title}
      </h2>

      {subtitle && (
        <p className="mt-1 text-xs text-[#8b9a9e]">
          {subtitle}
        </p>
      )}

    </div>
  );
}

function DashboardPanel({
  title,
  subtitle,
  link,
  linkText,
  icon: Icon,
  children,
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-[#d9e2df] bg-white shadow-[0_8px_30px_rgba(19,41,61,0.045)]">

      <div className="flex items-center justify-between gap-4 border-b border-[#edf1ef] px-5 py-5">

        <div className="flex min-w-0 items-center gap-3">

          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e7f4f3] text-[#3f9597]">
            <Icon size={17} />
          </div>

          <div className="min-w-0">

            <p className="truncate font-serif text-xl font-bold text-[#15314a]">
              {title}
            </p>

            <p className="mt-1 text-[10px] text-[#8b9a9e]">
              {subtitle}
            </p>

          </div>

        </div>

        <Link
          to={link}
          className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-[#3f8f91] transition hover:text-[#276c6e]"
        >
          {linkText}
          <ArrowRight size={13} />
        </Link>

      </div>

      {children}

    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}) {
  return (
    <div className="px-5 py-12 text-center">

      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f2f5f3] text-[#819298]">
        <Icon size={19} />
      </div>

      <p className="mt-3 text-sm font-bold text-[#15314a]">
        {title}
      </p>

      <p className="mt-1 text-xs text-[#8b9a9e]">
        {description}
      </p>

    </div>
  );
}