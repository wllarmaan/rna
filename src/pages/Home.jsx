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
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    const since = startOfTodayISO();

    const [
      todaySalesRes,
      todayExpensesRes,
      stockRes,
      customersRes,
      suppliersRes,
      recentSalesRes,
      recentPurchasesRes,
    ] = await Promise.all([
      supabase.from("sales").select("total, created_at").gte("created_at", since),
      supabase.from("expenses").select("amount, created_at").gte("created_at", since),
      supabase.from("stock_levels").select("quantity_on_hand, reorder_level"),
      supabase.from("customers").select("balance"),
      supabase.from("suppliers").select("balance"),
      supabase
        .from("sales")
        .select("id, invoice_number, total, payment_status, created_at, customers(name), branches(name)")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("purchase_orders")
        .select("id, status, total_amount, created_at, suppliers(name), branches(name)")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    if (todaySalesRes.error) setError(todaySalesRes.error.message);

    const salesToday = todaySalesRes.data || [];
    setTodaySalesTotal(salesToday.reduce((sum, s) => sum + Number(s.total), 0));
    setTodaySalesCount(salesToday.length);

    const expensesToday = todayExpensesRes.data || [];
    setTodayExpensesTotal(expensesToday.reduce((sum, e) => sum + Number(e.amount), 0));

    const stock = stockRes.data || [];
    setLowStockCount(
      stock.filter((s) => s.reorder_level != null && Number(s.quantity_on_hand) <= s.reorder_level)
        .length
    );

    setReceivables((customersRes.data || []).reduce((sum, c) => sum + Number(c.balance || 0), 0));
    setPayables((suppliersRes.data || []).reduce((sum, s) => sum + Number(s.balance || 0), 0));

    setRecentSales(recentSalesRes.data || []);
    setRecentPurchases(recentPurchasesRes.data || []);

    setLoading(false);
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
        <p className="eyebrow-plain">{profile?.organizations?.name || "Medvora"}</p>
        <h1>Dashboard</h1>
        <p className="lede">Xaalada ganacsigaaga maanta — xogtan waa mid nool (live).</p>
      </header>

      {error && <p className="auth-error">{error}</p>}

      <dl className="stat-row" style={{ flexWrap: "wrap", rowGap: 20 }}>
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
            <dd style={lowStockCount > 0 ? { color: "#a5312a" } : undefined}>{lowStockCount}</dd>
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
                    <span className="ledger-number">{s.payment_status === "paid" ? "✓" : "…"}</span>
                    <span className="ledger-title">
                      {s.invoice_number} — {s.customers?.name || s.branches?.name || "—"}
                    </span>
                    <span className="ledger-count">{Number(s.total).toFixed(2)}</span>
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
            <p className="lede">Wali purchase order lama samayn.</p>
          ) : (
            <ol className="ledger-list">
              {recentPurchases.map((p) => (
                <li key={p.id}>
                  <Link to="/purchases">
                    <span className="ledger-number">{p.status === "received" ? "✓" : "…"}</span>
                    <span className="ledger-title">{p.suppliers?.name || "—"}</span>
                    <span className="ledger-count">{Number(p.total_amount).toFixed(2)}</span>
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