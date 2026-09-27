import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient.js";
import { useAuth } from "../lib/AuthContext.jsx";

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
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function load() {
    setLoading(true);
    const [supplierRes, ordersRes, paymentsRes] = await Promise.all([
      supabase.from("suppliers").select("*").eq("id", id).single(),
      supabase
        .from("purchase_orders")
        .select("id, status, total_amount, created_at")
        .eq("supplier_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("payments")
        .select("id, amount, method, created_at")
        .eq("supplier_id", id)
        .order("created_at", { ascending: false }),
    ]);
    if (supplierRes.error) setError(supplierRes.error.message);
    else setSupplier(supplierRes.data);
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
    if (!value || value <= 0) {
      setError("Fadlan geli lacag ka weyn eber.");
      return;
    }
    setSaving(true);

    const { error: paymentError } = await supabase.from("payments").insert({
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

    const newBalance = (Number(supplier?.balance) || 0) - value;
    const { error: balanceError } = await supabase
      .from("suppliers")
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

  if (!supplier) {
    return (
      <div className="page">
        <p className="auth-error">Supplier-kan lama helin.</p>
        <Link to="/suppliers" className="back-link">
          ← Suppliers
        </Link>
      </div>
    );
  }

  return (
    <div className="page">
      <Link to="/suppliers" className="back-link">
        ← Suppliers
      </Link>

      <header className="page-header">
        <p className="eyebrow-plain">Supplier Statement</p>
        <h1>{supplier.name}</h1>
        <p className="lede">
          {supplier.phone || "—"} · {supplier.address || "—"}
        </p>
      </header>

      <div style={{ marginBottom: 28 }}>
        <div className="eyebrow-plain">Balance hadda (aan ku leenahay)</div>
        <div className={`balance-hero ${Number(supplier.balance) > 0 ? "negative" : ""}`}>
          {Number(supplier.balance).toFixed(2)}
        </div>
      </div>

      {error && <p className="auth-error">{error}</p>}

      <form className="purchase-form-row" onSubmit={handleRecordPayment} style={{ marginBottom: 32 }}>
        <input
          type="number"
          step="0.01"
          placeholder="Lacagta la bixiyay"
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

      <h2 style={{ fontSize: 15, marginBottom: 10 }}>Purchase Orders</h2>
      {orders.length === 0 ? (
        <p className="lede">Wali purchase order lagama samayn supplier-kan.</p>
      ) : (
        <table className="data-table" style={{ marginBottom: 32 }}>
          <thead>
            <tr>
              <th>Status</th>
              <th>Total</th>
              <th>Taariikhda</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>{o.status}</td>
                <td>{Number(o.total_amount).toFixed(2)}</td>
                <td>{new Date(o.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 style={{ fontSize: 15, marginBottom: 10 }}>Lacag-bixinnada (Payments)</h2>
      {payments.length === 0 ? (
        <p className="lede">Wali lacag lagama bixin supplier-kan.</p>
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