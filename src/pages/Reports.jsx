import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Calendar,
  CreditCard,
  PieChart,
  Receipt,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Trophy,
  WalletCards,
} from "lucide-react";

import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

const RANGES = [
  { key: "today", label: "Maanta" },
  { key: "week", label: "Toddobaadkan" },
  { key: "month", label: "Bishan" },
  { key: "all", label: "Dhammaan" },
];

function rangeStart(key) {
  const now = new Date();
  if (key === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (key === "week") {
    const d = new Date(now);
    const day = d.getDay(); // 0 = Sunday
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (key === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return null; // "all"
}

export default function Reports() {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id;

  const [range, setRange] = useState("month");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [sales, setSales] = useState([]);
  const [saleItems, setSaleItems] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [products, setProducts] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);

  const money = useCallback((v) => `$${Number(v || 0).toFixed(2)}`, []);

  const fetchAll = useCallback(async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError("");

      const [salesRes, itemsRes, expensesRes, productsRes, purchasesRes] = await Promise.all([
        supabase
          .from("sales")
          .select("*")
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: false })
          .limit(2000),
        supabase
          .from("sale_items")
          .select("id, sale_id, product_id, quantity, unit_price, discount, total")
          .limit(5000),
        supabase
          .from("expenses")
          .select("*")
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: false })
          .limit(1000),
        supabase.from("products").select("id, name, purchase_price").eq("organization_id", organizationId),
        supabase
          .from("purchase_orders")
          .select("*")
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: false })
          .limit(500),
      ]);

      const failed = [salesRes, itemsRes, expensesRes, productsRes, purchasesRes].find((r) => r.error);
      if (failed?.error) throw failed.error;

      setSales(salesRes.data || []);
      setSaleItems(itemsRes.data || []);
      setExpenses(expensesRes.data || []);
      setProducts(productsRes.data || []);
      setPurchaseOrders(purchasesRes.data || []);
    } catch (err) {
      setError(err?.message || "Reports-ka xogtiisa lama soo dejin karin.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const since = useMemo(() => rangeStart(range), [range]);

  const inRange = useCallback(
    (dateValue) => {
      if (!since) return true;
      const d = new Date(dateValue);
      if (Number.isNaN(d.getTime())) return false;
      return d >= since;
    },
    [since]
  );

  const filteredSales = useMemo(
    () => sales.filter((s) => inRange(s.created_at)),
    [sales, inRange]
  );
  const filteredExpenses = useMemo(
    () => expenses.filter((e) => inRange(e.created_at)),
    [expenses, inRange]
  );
  const filteredPurchases = useMemo(
    () => purchaseOrders.filter((p) => inRange(p.created_at)),
    [purchaseOrders, inRange]
  );

  const productById = useMemo(() => {
    const m = {};
    products.forEach((p) => (m[p.id] = p));
    return m;
  }, [products]);

  const filteredSaleIds = useMemo(() => new Set(filteredSales.map((s) => s.id)), [filteredSales]);
  const filteredItems = useMemo(
    () => saleItems.filter((it) => filteredSaleIds.has(it.sale_id)),
    [saleItems, filteredSaleIds]
  );

  const totalRevenue = useMemo(
    () => filteredSales.reduce((sum, s) => sum + Number(s.total || 0), 0),
    [filteredSales]
  );

  const cogs = useMemo(
    () =>
      filteredItems.reduce((sum, it) => {
        const cost = Number(productById[it.product_id]?.purchase_price || 0);
        return sum + cost * Number(it.quantity || 0);
      }, 0),
    [filteredItems, productById]
  );

  const grossProfit = totalRevenue - cogs;

  const totalExpenses = useMemo(
    () => filteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0),
    [filteredExpenses]
  );

  const netProfit = grossProfit - totalExpenses;

  const totalPurchases = useMemo(
    () => filteredPurchases.reduce((sum, p) => sum + Number(p.total_amount || 0), 0),
    [filteredPurchases]
  );

  const topProducts = useMemo(() => {
    const map = {};
    filteredItems.forEach((it) => {
      const id = it.product_id;
      if (!id) return;
      if (!map[id]) map[id] = { id, quantity: 0, revenue: 0 };
      map[id].quantity += Number(it.quantity || 0);
      map[id].revenue += Number(it.total || 0);
    });
    return Object.values(map)
      .map((row) => ({ ...row, name: productById[row.id]?.name || "—" }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [filteredItems, productById]);

  const byPaymentMethod = useMemo(() => {
    const map = {};
    filteredSales.forEach((s) => {
      const method = s.payment_method || "other";
      if (!map[method]) map[method] = { method, count: 0, total: 0 };
      map[method].count += 1;
      map[method].total += Number(s.total || 0);
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filteredSales]);

  const byExpenseCategory = useMemo(() => {
    const map = {};
    filteredExpenses.forEach((e) => {
      const cat = e.category || "other";
      if (!map[cat]) map[cat] = { category: cat, total: 0 };
      map[cat].total += Number(e.amount || 0);
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filteredExpenses]);

  if (loading) {
    return (
      <div className="px-5 py-10 sm:px-8">
        <p className="text-sm text-[#60777d]">Soo dejinaya…</p>
      </div>
    );
  }

  return (
    <div className="px-5 pb-16 pt-6 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 size={14} className="text-[#3f8f91]" />
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#3f8f91]">REPORTS</p>
            </div>
            <h1 className="mt-1 font-serif text-2xl font-bold text-[#15314a]">Reports</h1>
            <p className="mt-1 text-sm text-[#60777d]">
              Sales, purchases, expenses, iyo faa'iidada — isbeddel waqtiga si aad u aragto xog kale.
            </p>
          </div>

          <div className="flex gap-1 rounded-xl border border-[#d9e2df] bg-white p-1">
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={[
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                  range === r.key
                    ? "bg-[#15314a] text-white"
                    : "text-[#60777d] hover:bg-[#f1f4f2]",
                ].join(" ")}
              >
                {r.label}
              </button>
            ))}
          </div>
        </header>

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard icon={TrendingUp} label="Revenue" value={money(totalRevenue)} description={`${filteredSales.length} iib`} tone="teal" />
          <MetricCard icon={WalletCards} label="Gross Profit" value={money(grossProfit)} description="Revenue − COGS" tone="blue" />
          <MetricCard icon={TrendingDown} label="Expenses" value={money(totalExpenses)} description={`${filteredExpenses.length} qodob`} tone="orange" />
          <MetricCard icon={ShoppingCart} label="Purchases" value={money(totalPurchases)} description={`${filteredPurchases.length} order`} tone="purple" />
        </div>

        <section
          className={[
            "relative overflow-hidden rounded-3xl border px-5 py-6 sm:px-7",
            netProfit >= 0 ? "border-[#b8d8d5] bg-[#e7f4f3]" : "border-red-200 bg-red-50",
          ].join(" ")}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#3f8f91]">NET PROFIT</p>
              <h2 className="mt-1 font-serif text-2xl font-bold text-[#15314a]">
                {RANGES.find((r) => r.key === range)?.label}
              </h2>
            </div>
            <div className="text-left sm:text-right">
              <p className={["text-3xl font-bold tracking-tight", netProfit >= 0 ? "text-[#287d80]" : "text-red-700"].join(" ")}>
                {money(netProfit)}
              </p>
              <p className="mt-1 text-xs text-[#71878b]">
                Revenue {money(totalRevenue)} − COGS {money(cogs)} − Expenses {money(totalExpenses)}
              </p>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel title="Alaabta ugu iibsan badan" subtitle="Top 5" icon={Trophy}>
            {topProducts.length === 0 ? (
              <Empty icon={Trophy} title="Wali iib lama helin" description="Soo dooro muddo kale." />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#edf1ef] text-left text-[11px] uppercase text-[#8b9a9e]">
                    <th className="px-5 py-2">Alaabta</th>
                    <th className="px-5 py-2">Tirada</th>
                    <th className="px-5 py-2 text-right">Dakhliga</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((p) => (
                    <tr key={p.id} className="border-b border-[#f3f5f4] last:border-0">
                      <td className="px-5 py-3 font-medium text-[#15314a]">{p.name}</td>
                      <td className="px-5 py-3 text-[#60777d]">{p.quantity}</td>
                      <td className="px-5 py-3 text-right font-semibold text-[#15314a]">{money(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <Panel title="Lacag-bixinta (Payment Methods)" subtitle="Sales" icon={CreditCard}>
            {byPaymentMethod.length === 0 ? (
              <Empty icon={CreditCard} title="Wali iib lama helin" description="Soo dooro muddo kale." />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#edf1ef] text-left text-[11px] uppercase text-[#8b9a9e]">
                    <th className="px-5 py-2">Habka</th>
                    <th className="px-5 py-2">Tirada</th>
                    <th className="px-5 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {byPaymentMethod.map((row) => (
                    <tr key={row.method} className="border-b border-[#f3f5f4] last:border-0">
                      <td className="px-5 py-3 font-medium capitalize text-[#15314a]">{row.method}</td>
                      <td className="px-5 py-3 text-[#60777d]">{row.count}</td>
                      <td className="px-5 py-3 text-right font-semibold text-[#15314a]">{money(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <Panel title="Kharashaadka (by Category)" subtitle="Expenses" icon={Receipt}>
            {byExpenseCategory.length === 0 ? (
              <Empty icon={Receipt} title="Wali kharash lama gelin" description="Soo dooro muddo kale." />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#edf1ef] text-left text-[11px] uppercase text-[#8b9a9e]">
                    <th className="px-5 py-2">Nooca</th>
                    <th className="px-5 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {byExpenseCategory.map((row) => (
                    <tr key={row.category} className="border-b border-[#f3f5f4] last:border-0">
                      <td className="px-5 py-3 font-medium capitalize text-[#15314a]">{row.category}</td>
                      <td className="px-5 py-3 text-right font-semibold text-[#15314a]">{money(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <Panel title="Isbarbardhig" subtitle="Summary" icon={PieChart}>
            <div className="divide-y divide-[#f3f5f4] px-5">
              <SummaryRow label="Revenue" value={money(totalRevenue)} />
              <SummaryRow label="Cost of Medicines Sold" value={money(cogs)} />
              <SummaryRow label="Gross Profit" value={money(grossProfit)} strong />
              <SummaryRow label="Operating Expenses" value={money(totalExpenses)} />
              <SummaryRow label="Net Profit" value={money(netProfit)} strong highlight={netProfit >= 0} />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, description, tone = "teal" }) {
  const tones = {
    teal: "bg-[#e7f4f3] text-[#3f9597]",
    blue: "bg-[#e9f0f7] text-[#39749b]",
    gold: "bg-[#f5efdf] text-[#a17b30]",
    orange: "bg-[#fff0df] text-[#c17a25]",
    purple: "bg-[#eeeaf7] text-[#765a9d]",
  };
  return (
    <div className="rounded-2xl border border-[#d9e2df] bg-white p-5 shadow-[0_6px_24px_rgba(19,41,61,0.035)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(19,41,61,0.07)]">
      <div className="flex items-start gap-4">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
          <Icon size={19} strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[#718187]">{label}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-[#15314a]">{value}</p>
          <p className="mt-1 truncate text-[10px] font-medium text-[#8b9a9e]">{description}</p>
        </div>
      </div>
    </div>
  );
}

function Panel({ title, subtitle, icon: Icon, children }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-[#d9e2df] bg-white shadow-[0_8px_30px_rgba(19,41,61,0.045)]">
      <div className="flex items-center gap-3 border-b border-[#edf1ef] px-5 py-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e7f4f3] text-[#3f9597]">
          <Icon size={17} />
        </div>
        <div className="min-w-0">
          <p className="truncate font-serif text-xl font-bold text-[#15314a]">{title}</p>
          <p className="mt-1 text-[10px] text-[#8b9a9e]">{subtitle}</p>
        </div>
      </div>
      <div className="py-2">{children}</div>
    </div>
  );
}

function Empty({ icon: Icon, title, description }) {
  return (
    <div className="px-5 py-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f2f5f3] text-[#819298]">
        <Icon size={19} />
      </div>
      <p className="mt-3 text-sm font-bold text-[#15314a]">{title}</p>
      <p className="mt-1 text-xs text-[#8b9a9e]">{description}</p>
    </div>
  );
}

function SummaryRow({ label, value, strong, highlight }) {
  return (
    <div className="flex items-center justify-between py-3">
      <p className={strong ? "text-sm font-bold text-[#15314a]" : "text-sm text-[#60777d]"}>{label}</p>
      <p
        className={[
          strong ? "text-base font-bold" : "text-sm font-semibold",
          highlight ? "text-[#287d80]" : "text-[#15314a]",
        ].join(" ")}
      >
        {value}
      </p>
    </div>
  );
}