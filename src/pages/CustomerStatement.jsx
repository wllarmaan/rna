import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient.js";
import { useAuth } from "../lib/AuthContext.jsx";

export default function CustomerStatement() {
  const { id } = useParams();
  const { profile } = useAuth();
  const [customer, setCustomer] = useState(null);
  const [sales, setSales] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function load() {
    setLoading(true);
    const [customerRes, salesRes, paymentsRes] = await Promise.all([
      supabase.from("customers").select("*").eq("id", id).single(),
      supabase
        .from("sales")
        .select("id, invoice_number, total, payment_status, created_at")
        .eq("customer_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("payments")
        .select("id, amount, method, created_at")
        .eq("customer_id", id)
        .order("created_at", { ascending: false }),
    ]);
    if (customerRes.error) setError(customerRes.error.message);
    else setCustomer(customerRes.data);
    setSales(salesRes.data || []);
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
    if (!value || value <= 0) {
      setError("Fadlan geli lacag ka weyn eber.");
      return;
    }
    setSaving(true);

    const { error: paymentError } = await supabase.from("payments").insert({
      organization_id: profile.organization_id,
      customer_id: id,
      amount: value,
      method,
    });
    if (paymentError) {
      setError(paymentError.message);
      setSaving(false);
      return;
    }

    const newBalance = (Number(customer?.balance) || 0) - value;
    const { error: balanceError } = await supabase
      .from("customers")
      .update({ balance: newBalance })
      .eq("id", id);
    setSaving(false);
    if (balanceError) {
      setError(balanceError.message);
      return;
    }

    setAmount("");
    load();
  }

  if (loading) {
    return (
      <div className="page">
        <p className="lede">Soo dejinaya…</p>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="page">
        <p className="auth-error">Macmiilkan lama helin.</p>
        <Link to="/customers" className="back-link">
          ← Customers
        </Link>
      </div>
    );
  }

  return (
    <div className="page">
      <Link to="/customers" className="back-link">
        ← Customers
      </Link>

      <header className="page-header">
        <p className="eyebrow-plain">Customer Statement</p>
        <h1>{customer.name}</h1>
        <p className="lede">
          {customer.phone || "—"} · {customer.address || "—"}
        </p>
      </header>

      <div style={{ marginBottom: 28 }}>
        <div className="eyebrow-plain">Balance hadda (wuu inagu leeyahay)</div>
        <div className={`balance-hero ${Number(customer.balance) > 0 ? "negative" : ""}`}>
          {Number(customer.balance).toFixed(2)}
        </div>
      </div>

      {error && <p className="auth-error">{error}</p>}

      <form className="purchase-form-row" onSubmit={handleRecordPayment} style={{ marginBottom: 32 }}>
        <input
          type="number"
          step="0.01"
          placeholder="Lacagta la helay"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
        <select value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="cash">Cash</option>
          <option value="evc_plus">EVC Plus</option>
          <option value="edahab">eDahab</option>
          <option value="bank">Bank</option>
          <option value="card">Card</option>
        </select>
        <button type="submit" disabled={saving}>
          {saving ? "…" : "Diiwaan geli lacag-bixin"}
        </button>
      </form>

      <h2 style={{ fontSize: 15, marginBottom: 10 }}>Iibabka (Sales)</h2>
      {sales.length === 0 ? (
        <p className="lede">Wali iib lama iibin macmiilkan.</p>
      ) : (
        <table className="data-table" style={{ marginBottom: 32 }}>
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Total</th>
              <th>Xaalada</th>
              <th>Taariikhda</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id}>
                <td>{s.invoice_number}</td>
                <td>{Number(s.total).toFixed(2)}</td>
                <td>{s.payment_status}</td>
                <td>{new Date(s.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 style={{ fontSize: 15, marginBottom: 10 }}>Lacag-bixinnada (Payments)</h2>
      {payments.length === 0 ? (
        <p className="lede">Wali lacag lagama bixin macmiilkan.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Lacagta</th>
              <th>Habka</th>
              <th>Taariikhda</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td>{Number(p.amount).toFixed(2)}</td>
                <td>{p.method}</td>
                <td>{new Date(p.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}