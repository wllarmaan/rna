import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient.js";
import { useAuth } from "../lib/AuthContext.jsx";
import { canAccess } from "../lib/permissions.js";

function startOfTodayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export default function Home() {
  const { profile } = useAuth();
  const role = profile?.role;
  const organizationId = profile?.organization_id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [todaySalesTotal, setTodaySalesTotal] = useState(0);
  const [todaySalesCount, setTodaySalesCount] = useState(0);
  const [todayExpensesTotal, setTodayExpensesTotal] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [receivables, setReceivables] = useState(0);
  const [payables, setPayables] = useState(0);
  const [recentSales, setRecentSales] = useState([]);
  const [recentPurchases, setRecentPurchases] = useState([]);

  useEffect(() => {
    if (organizationId) {
      load();
    }
  }, [organizationId]);

  async function load() {
    setLoading(true);
    setError("");

    const since = startOfTodayISO();

    try {
      const [
        todaySalesRes,
        todayExpensesRes,
        productsRes,
        stockBatchesRes,
        customersRes,
        suppliersRes,
        recentSalesRes,
        recentPurchasesRes,
      ] = await Promise.all([
        supabase
          .from("sales")
          .select("total, created_at")
          .eq("organization_id", organizationId)
          .gte("created_at", since),

        supabase
          .from("expenses")
          .select("amount, created_at")
          .eq("organization_id", organizationId)
          .gte("created_at", since),

        supabase
          .from("products")
          .select("id, reorder_level, status")
          .eq("organization_id", organizationId)
          .eq("status", "active"),

        supabase
          .from("stock_batches")
          .select("product_id, quantity")
          .eq("organization_id", organizationId),

        supabase
          .from("customers")
          .select("balance")
          .eq("organization_id", organizationId),

        supabase
          .from("suppliers")
          .select("balance")
          .eq("organization_id", organizationId),

        supabase
          .from("sales")
          .select(
            "id, invoice_number, total, payment_status, created_at, customers(name), branches(name)"
          )
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: false })
          .limit(5),

        supabase
          .from("purchase_orders")
          .select(
            "id, status, total_amount, created_at, suppliers(name), branches(name)"
          )
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      if (todaySalesRes.error) {
        throw new Error(todaySalesRes.error.message);
      }

      if (todayExpensesRes.error) {
        throw new Error(todayExpensesRes.error.message);
      }

      if (productsRes.error) {
        throw new Error(productsRes.error.message);
      }

      if (stockBatchesRes.error) {
        throw new Error(stockBatchesRes.error.message);
      }

      if (customersRes.error) {
        throw new Error(customersRes.error.message);
      }

      if (suppliersRes.error) {
        throw new Error(suppliersRes.error.message);
      }

      if (recentSalesRes.error) {
        throw new Error(recentSalesRes.error.message);
      }

      if (recentPurchasesRes.error) {
        throw new Error(recentPurchasesRes.error.message);
      }

      // -----------------------------
      // Today's sales
      // -----------------------------
      const salesToday = todaySalesRes.data || [];

      setTodaySalesTotal(
        salesToday.reduce(
          (sum, sale) => sum + Number(sale.total || 0),
          0
        )
      );

      setTodaySalesCount(salesToday.length);

      // -----------------------------
      // Today's expenses
      // -----------------------------
      const expensesToday = todayExpensesRes.data || [];

      setTodayExpensesTotal(
        expensesToday.reduce(
          (sum, expense) => sum + Number(expense.amount || 0),
          0
        )
      );

      // -----------------------------
      // Low stock
      // products + stock_batches
      // -----------------------------
      const products = productsRes.data || [];
      const stockBatches = stockBatchesRes.data || [];

      const stockByProduct = {};

      for (const batch of stockBatches) {
        const productId = batch.product_id;

        if (!stockByProduct[productId]) {
          stockByProduct[productId] = 0;
        }

        stockByProduct[productId] += Number(batch.quantity || 0);
      }

      const lowStockProducts = products.filter((product) => {
        if (product.reorder_level == null) {
          return false;
        }

        const currentQuantity = stockByProduct[product.id] || 0;

        return currentQuantity <= Number(product.reorder_level);
      });

      setLowStockCount(lowStockProducts.length);

      // -----------------------------
      // Customer balances
      // -----------------------------
      setReceivables(
        (customersRes.data || []).reduce(
          (sum, customer) => sum + Number(customer.balance || 0),
          0
        )
      );

      // -----------------------------
      // Supplier balances
      // -----------------------------
      setPayables(
        (suppliersRes.data || []).reduce(
          (sum, supplier) => sum + Number(supplier.balance || 0),
          0
        )
      );

      // -----------------------------
      // Recent sales
      // -----------------------------
      setRecentSales(recentSalesRes.data || []);

      // -----------------------------
      // Recent purchases
      // -----------------------------
      setRecentPurchases(recentPurchasesRes.data || []);
    } catch (err) {
      console.error("Home dashboard error:", err);
      setError(err?.message || "Xogta dashboard-ka lama soo dejin karin.");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <p className="lede">Soo dejinaya…</p>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow-plain">
          {profile?.organizations?.name || "Medvora"}
        </p>

        <h1>Dashboard</h1>

        <p className="lede">
          Xaalada ganacsigaaga maanta — xogtan waa mid nool (live).
        </p>
      </header>

      {error && <p className="auth-error">{error}</p>}

      <dl
        className="stat-row"
        style={{ flexWrap: "wrap", rowGap: 20 }}
      >
        {canAccess(role, "sales_summary") && (
          <>
            <div className="stat">
              <dt>Iibka maanta</dt>
              <dd>{todaySalesTotal.toFixed(2)}</dd>
            </div>

            <div className="stat">
              <dt>Tirada iibabka maanta</dt>
              <dd>{todaySalesCount}</dd>
            </div>
          </>
        )}

        {canAccess(role, "expenses_summary") && (
          <div className="stat">
            <dt>Kharashaadka maanta</dt>
            <dd>{todayExpensesTotal.toFixed(2)}</dd>
          </div>
        )}

        {canAccess(role, "stock_summary") && (
          <div className="stat">
            <dt>Alaab low-stock ah</dt>
            <dd
              style={
                lowStockCount > 0
                  ? { color: "#a5312a" }
                  : undefined
              }
            >
              {lowStockCount}
            </dd>
          </div>
        )}

        {canAccess(role, "balances_summary") && (
          <>
            <div className="stat">
              <dt>Receivables (macaamiisha nagu leeyihiin)</dt>
              <dd>{receivables.toFixed(2)}</dd>
            </div>

            <div className="stat">
              <dt>Payables (aan ku leenahay suppliers)</dt>
              <dd>{payables.toFixed(2)}</dd>
            </div>
          </>
        )}
      </dl>

      <div className="ledger" style={{ marginTop: 12 }}>
        {canAccess(role, "sales") && (
          <section className="ledger-group">
            <h2>Iibabka ugu dambeeyay</h2>

            {recentSales.length === 0 ? (
              <p className="lede">Wali iib lama samayn.</p>
            ) : (
              <ol className="ledger-list">
                {recentSales.map((s) => (
                  <li key={s.id}>
                    <Link to="/sales">
                      <span className="ledger-number">
                        {s.payment_status === "paid" ? "✓" : "…"}
                      </span>

                      <span className="ledger-title">
                        {s.invoice_number} —{" "}
                        {s.customers?.name ||
                          s.branches?.name ||
                          "—"}
                      </span>

                      <span className="ledger-count">
                        {Number(s.total || 0).toFixed(2)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}

        {canAccess(role, "purchases") && (
          <section className="ledger-group">
            <h2>Purchase orders ugu dambeeyay</h2>

            {recentPurchases.length === 0 ? (
              <p className="lede">
                Wali purchase order lama samayn.
              </p>
            ) : (
              <ol className="ledger-list">
                {recentPurchases.map((p) => (
                  <li key={p.id}>
                    <Link to="/purchases">
                      <span className="ledger-number">
                        {p.status === "received" ? "✓" : "…"}
                      </span>

                      <span className="ledger-title">
                        {p.suppliers?.name || "—"}
                      </span>

                      <span className="ledger-count">
                        {Number(p.total_amount || 0).toFixed(2)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}
      </div>
    </div>
  );
}