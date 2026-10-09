import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Banknote,
  CalendarDays,
  CreditCard,
  FileText,
  Loader2,
  Package,
  Smartphone,
  WalletCards,
} from "lucide-react";

import { supabase } from "../lib/supabaseClient.js";
import { useAuth } from "../lib/AuthContext.jsx";

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "evc_plus", label: "EVC Plus", icon: Smartphone },
  { value: "edahab", label: "eDahab", icon: Smartphone },
  { value: "bank", label: "Bank", icon: CreditCard },
  { value: "card", label: "Card", icon: WalletCards },
];

function formatMoney(value) {
  return Number(value || 0).toFixed(2);
}

function formatDate(value) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function paymentMethodLabel(method) {
  const found = PAYMENT_METHODS.find((item) => item.value === method);
  return found?.label || method || "—";
}

function statusLabel(status) {
  const labels = {
    pending: "Pending",
    received: "Received",
    cancelled: "Cancelled",
    completed: "Completed",
  };

  return labels[status] || status || "—";
}

export default function SupplierStatement() {
  const { id } = useParams();
  const { profile } = useAuth();

  const [supplier, setSupplier] = useState(null);
  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile?.organization_id && id) {
      load();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, profile?.organization_id]);

  async function load() {
    if (!profile?.organization_id || !id) return;

    setLoading(true);
    setError("");

    const organizationId = profile.organization_id;

    const [supplierRes, ordersRes, paymentsRes] = await Promise.all([
      supabase
        .from("suppliers")
        .select("*")
        .eq("id", id)
        .eq("organization_id", organizationId)
        .single(),

      supabase
        .from("purchase_orders")
        .select("id, status, total_amount, created_at")
        .eq("supplier_id", id)
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false }),

      supabase
        .from("payments")
        .select("id, amount, method, created_at")
        .eq("supplier_id", id)
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false }),
    ]);

    if (supplierRes.error) {
      setError(supplierRes.error.message);
      setSupplier(null);
    } else {
      setSupplier(supplierRes.data);
    }

    if (ordersRes.error) {
      setError(ordersRes.error.message);
    }

    if (paymentsRes.error) {
      setError(paymentsRes.error.message);
    }

    setOrders(ordersRes.data || []);
    setPayments(paymentsRes.data || []);

    setLoading(false);
  }

  async function handleRecordPayment(e) {
    e.preventDefault();
    setError("");

    if (!profile?.organization_id) {
      setError("Profile-kaaga wali lama xirin organization.");
      return;
    }

    const value = Number(amount);
    const currentBalance = Number(supplier?.balance || 0);

    if (!value || value <= 0) {
      setError("Fadlan geli lacag ka weyn eber.");
      return;
    }

    if (currentBalance <= 0) {
      setError("Supplier-kan hadda balance laguma laha.");
      return;
    }

    if (value > currentBalance) {
      setError(
        `Lacagta la bixinayo kama badnaan karto balance-ka ${formatMoney(
          currentBalance
        )}.`
      );
      return;
    }

    setSaving(true);

    const { error: paymentError } = await supabase
      .from("payments")
      .insert({
        organization_id: profile.organization_id,
        supplier_id: id,
        amount: value,
        method,
      });

    if (paymentError) {
      setError(paymentError.message);
      setSaving(false);
      return;
    }

    const newBalance = currentBalance - value;

    const { error: balanceError } = await supabase
      .from("suppliers")
      .update({
        balance: newBalance,
      })
      .eq("id", id)
      .eq("organization_id", profile.organization_id);

    if (balanceError) {
      setError(balanceError.message);
      setSaving(false);
      return;
    }

    setAmount("");
    setMethod("cash");
    setSaving(false);

    await load();
  }

  if (loading) {
    return (
      <div className="min-h-full bg-[#f2efe7] p-6">
        <div className="flex min-h-[320px] items-center justify-center">
          <div className="flex items-center gap-3 rounded-2xl border border-[#ded8ca] bg-[#fffdf8] px-6 py-4 text-[#53616b] shadow-sm">
            <Loader2 className="animate-spin" size={20} />
            <span>Supplier Statement waa la soo dejinayaa…</span>
          </div>
        </div>
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="min-h-full bg-[#f2efe7] p-6">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-2xl border border-red-200 bg-[#fffdf8] p-8 shadow-sm">
            <p className="mb-5 text-red-600">
              {error || "Supplier-kan lama helin."}
            </p>

            <Link
              to="/suppliers"
              className="inline-flex items-center gap-2 rounded-xl bg-[#13293d] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1d405d]"
            >
              <ArrowLeft size={16} />
              Suppliers
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const balance = Number(supplier.balance || 0);

  const totalPurchases = orders.reduce(
    (sum, order) => sum + Number(order.total_amount || 0),
    0
  );

  const totalPayments = payments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0
  );

  return (
    <div className="min-h-full bg-[#f2efe7] p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Back */}
        <Link
          to="/suppliers"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#53616b] transition hover:text-[#13293d]"
        >
          <ArrowLeft size={17} />
          Suppliers
        </Link>

        {/* Header */}
        <section className="overflow-hidden rounded-3xl border border-[#ded8ca] bg-[#fffdf8] shadow-sm">
          <div className="bg-[#13293d] px-6 py-7 md:px-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#d7b46a]">
                  <FileText size={15} />
                  Supplier Statement
                </div>

                <h1 className="text-2xl font-bold text-white md:text-3xl">
                  {supplier.name}
                </h1>

                <p className="mt-2 text-sm text-[#d7e1e6]">
                  {supplier.phone || "Telefoon ma jiro"}{" "}
                  <span className="mx-2 text-[#718895]">•</span>
                  {supplier.address || "Cinwaan ma jiro"}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/10 px-5 py-4 backdrop-blur">
                <div className="text-xs font-semibold uppercase tracking-wide text-[#cbd8de]">
                  Supplier
                </div>

                <div className="mt-1 flex items-center gap-2 text-sm font-bold text-white">
                  <Package size={16} className="text-[#d7b46a]" />
                  Vendor / Supplier
                </div>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="grid gap-4 p-5 md:grid-cols-3 md:p-6">
            <div className="rounded-2xl border border-[#e2dbcd] bg-[#f7f4ec] p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-[#7c858c]">
                Balance Hadda
              </p>

              <p
                className={`mt-2 text-2xl font-black ${
                  balance > 0 ? "text-[#b34a45]" : "text-[#2d7d68]"
                }`}
              >
                {formatMoney(balance)}
              </p>

              <p className="mt-1 text-xs text-[#7c858c]">
                {balance > 0
                  ? "Lacag ayaan supplier-ka ku leenahay"
                  : "Balance waa nadiif"}
              </p>
            </div>

            <div className="rounded-2xl border border-[#e2dbcd] bg-[#fffdf8] p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-[#7c858c]">
                Total Purchases
              </p>

              <p className="mt-2 text-2xl font-black text-[#13293d]">
                {formatMoney(totalPurchases)}
              </p>

              <p className="mt-1 text-xs text-[#7c858c]">
                {orders.length} purchase orders
              </p>
            </div>

            <div className="rounded-2xl border border-[#e2dbcd] bg-[#fffdf8] p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-[#7c858c]">
                Total Payments
              </p>

              <p className="mt-2 text-2xl font-black text-[#2d7d68]">
                {formatMoney(totalPayments)}
              </p>

              <p className="mt-1 text-xs text-[#7c858c]">
                {payments.length} payments
              </p>
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {/* Payment Form */}
        <section className="rounded-3xl border border-[#ded8ca] bg-[#fffdf8] p-5 shadow-sm md:p-6">
          <div className="mb-5">
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-[#e7f1f0] p-2 text-[#2d7d68]">
                <Banknote size={19} />
              </div>

              <div>
                <h2 className="font-bold text-[#13293d]">
                  Diiwaan geli lacag-bixin
                </h2>

                <p className="text-xs text-[#7c858c]">
                  Lacagta supplier-ka la siiyay ku qor statement-ka.
                </p>
              </div>
            </div>
          </div>

          {balance > 0 ? (
            <form
              onSubmit={handleRecordPayment}
              className="grid gap-4 md:grid-cols-[1fr_1fr_auto]"
            >
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#68757e]">
                  Lacagta la bixiyay
                </label>

                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={balance}
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className="w-full rounded-xl border border-[#d8d2c5] bg-white px-4 py-3 text-sm text-[#13293d] outline-none transition placeholder:text-[#a0a7aa] focus:border-[#48a6a7] focus:ring-2 focus:ring-[#48a6a7]/15"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#68757e]">
                  Habka lacag-bixinta
                </label>

                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="w-full rounded-xl border border-[#d8d2c5] bg-white px-4 py-3 text-sm text-[#13293d] outline-none transition focus:border-[#48a6a7] focus:ring-2 focus:ring-[#48a6a7]/15"
                >
                  {PAYMENT_METHODS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#13293d] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#1d405d] disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
                >
                  {saving ? (
                    <>
                      <Loader2 size={17} className="animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Banknote size={17} />
                      Diiwaan geli
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="rounded-2xl border border-[#cfe3dc] bg-[#eef8f4] px-5 py-4 text-sm font-medium text-[#2d7d68]">
              ✓ Hadda supplier-kan lacag laguma laha.
            </div>
          )}
        </section>

        {/* Purchase Orders */}
        <section className="rounded-3xl border border-[#ded8ca] bg-[#fffdf8] shadow-sm">
          <div className="flex items-center justify-between border-b border-[#e5dfd2] px-5 py-5 md:px-6">
            <div>
              <h2 className="font-bold text-[#13293d]">
                Purchase Orders
              </h2>

              <p className="mt-1 text-xs text-[#7c858c]">
                Dhammaan purchases ku xiran supplier-kan.
              </p>
            </div>

            <div className="rounded-full bg-[#edf3f4] px-3 py-1 text-xs font-bold text-[#13293d]">
              {orders.length} Orders
            </div>
          </div>

          {orders.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-[#7c858c]">
              Wali purchase order lagama samayn supplier-kan.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-[#e5dfd2] bg-[#f7f4ec] text-left">
                    <th className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-[#68757e]">
                      Status
                    </th>

                    <th className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-[#68757e]">
                      Total
                    </th>

                    <th className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-[#68757e]">
                      Taariikhda
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {orders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-[#eee9df] last:border-0 hover:bg-[#faf8f2]"
                    >
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                            order.status === "received"
                              ? "bg-[#e7f4ee] text-[#2d7d68]"
                              : order.status === "cancelled"
                              ? "bg-[#fbe9e8] text-[#b34a45]"
                              : "bg-[#fff1df] text-[#a76516]"
                          }`}
                        >
                          {statusLabel(order.status)}
                        </span>
                      </td>

                      <td className="px-5 py-4 font-bold text-[#13293d]">
                        {formatMoney(order.total_amount)}
                      </td>

                      <td className="px-5 py-4 text-sm text-[#68757e]">
                        <span className="inline-flex items-center gap-2">
                          <CalendarDays size={14} />
                          {formatDate(order.created_at)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Payments */}
        <section className="rounded-3xl border border-[#ded8ca] bg-[#fffdf8] shadow-sm">
          <div className="flex items-center justify-between border-b border-[#e5dfd2] px-5 py-5 md:px-6">
            <div>
              <h2 className="font-bold text-[#13293d]">
                Lacag-bixinnada (Payments)
              </h2>

              <p className="mt-1 text-xs text-[#7c858c]">
                Lacagihii supplier-kan hore loo siiyay.
              </p>
            </div>

            <div className="rounded-full bg-[#eaf5f2] px-3 py-1 text-xs font-bold text-[#2d7d68]">
              {payments.length} Payments
            </div>
          </div>

          {payments.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-[#7c858c]">
              Wali lacag lagama bixin supplier-kan.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-[#e5dfd2] bg-[#f7f4ec] text-left">
                    <th className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-[#68757e]">
                      Lacagta
                    </th>

                    <th className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-[#68757e]">
                      Habka
                    </th>

                    <th className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-[#68757e]">
                      Taariikhda
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {payments.map((payment) => (
                    <tr
                      key={payment.id}
                      className="border-b border-[#eee9df] last:border-0 hover:bg-[#faf8f2]"
                    >
                      <td className="px-5 py-4 font-bold text-[#2d7d68]">
                        -{formatMoney(payment.amount)}
                      </td>

                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-2 rounded-full bg-[#edf3f4] px-3 py-1 text-xs font-bold text-[#13293d]">
                          {paymentMethodLabel(payment.method)}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-sm text-[#68757e]">
                        <span className="inline-flex items-center gap-2">
                          <CalendarDays size={14} />
                          {formatDate(payment.created_at)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}