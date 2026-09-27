import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { useAuth } from "../lib/AuthContext.jsx";

const emptyLine = { product_id: "", quantity: "", unit_cost: "" };

export default function Purchases() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [receivingId, setReceivingId] = useState(null);

  const [supplierId, setSupplierId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [lines, setLines] = useState([{ ...emptyLine }]);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    const [ordersRes, suppliersRes, branchesRes, productsRes] = await Promise.all([
      supabase
        .from("purchase_orders")
        .select("*, suppliers(name), branches(name), purchase_items(*, products(name))")
        .order("created_at", { ascending: false }),
      supabase.from("suppliers").select("id, name"),
      supabase.from("branches").select("id, name"),
      supabase.from("products").select("id, name, purchase_price"),
    ]);

    if (ordersRes.error) setError(ordersRes.error.message);
    else setOrders(ordersRes.data);
    setSuppliers(suppliersRes.data || []);
    setBranches(branchesRes.data || []);
    setProducts(productsRes.data || []);
    setLoading(false);
  }

  function updateLine(index, key, value) {
    setLines((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      // auto-fill unit cost from the product's purchase price when a product is chosen
      if (key === "product_id") {
        const product = products.find((p) => p.id === value);
        if (product) next[index].unit_cost = product.purchase_price;
      }
      return next;
    });
  }

  function addLine() {
    setLines((prev) => [...prev, { ...emptyLine }]);
  }

  function removeLine(index) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  const total = lines.reduce(
    (sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unit_cost) || 0),
    0
  );

  async function handleCreateOrder(e) {
    e.preventDefault();
    setError("");

    if (!profile?.organization_id) {
      setError("Profile-kaaga wali lama xirin organization.");
      return;
    }
    const validLines = lines.filter((l) => l.product_id && Number(l.quantity) > 0);
    if (!supplierId || !branchId || validLines.length === 0) {
      setError("Fadlan dooro supplier, branch, iyo ugu yaraan hal alaab oo tiro leh.");
      return;
    }

    setSaving(true);

    const { data: order, error: orderError } = await supabase
      .from("purchase_orders")
      .insert({
        organization_id: profile.organization_id,
        supplier_id: supplierId,
        branch_id: branchId,
        status: "pending",
        total_amount: total,
        created_by: profile.id,
      })
      .select()
      .single();

    if (orderError) {
      setError(orderError.message);
      setSaving(false);
      return;
    }

    const itemsPayload = validLines.map((l) => ({
      purchase_order_id: order.id,
      product_id: l.product_id,
      quantity: Number(l.quantity),
      unit_cost: Number(l.unit_cost) || 0,
    }));

    const { error: itemsError } = await supabase.from("purchase_items").insert(itemsPayload);

    setSaving(false);

    if (itemsError) {
      setError(itemsError.message);
      return;
    }

    setSupplierId("");
    setBranchId("");
    setLines([{ ...emptyLine }]);
    loadAll();
  }

  // Marks a pending order as fully received: creates one stock batch + one
  // stock movement per line item, then flips the order to "received".
  // (Phase 2 note: for true atomicity this should become a single Postgres
  // RPC transaction — today it runs as sequential client calls.)
  async function handleReceive(order) {
    setReceivingId(order.id);
    setError("");

    try {
      for (const item of order.purchase_items) {
        const { data: batch, error: batchError } = await supabase
          .from("stock_batches")
          .insert({
            organization_id: profile.organization_id,
            branch_id: order.branch_id,
            product_id: item.product_id,
            quantity: item.quantity,
          })
          .select()
          .single();
        if (batchError) throw batchError;

        const { error: moveError } = await supabase.from("stock_movements").insert({
          organization_id: profile.organization_id,
          branch_id: order.branch_id,
          product_id: item.product_id,
          batch_id: batch.id,
          movement_type: "purchase",
          quantity: item.quantity,
          reference_type: "purchase_order",
          reference_id: order.id,
          created_by: profile.id,
        });
        if (moveError) throw moveError;

        const { error: itemUpdateError } = await supabase
          .from("purchase_items")
          .update({ received_quantity: item.quantity })
          .eq("id", item.id);
        if (itemUpdateError) throw itemUpdateError;
      }

      const { error: orderUpdateError } = await supabase
        .from("purchase_orders")
        .update({ status: "received" })
        .eq("id", order.id);
      if (orderUpdateError) throw orderUpdateError;

      loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setReceivingId(null);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow-plain">Live data · Supabase</p>
        <h1>Purchasing &amp; Stock</h1>
        <p className="lede">
          Samee purchase order, kaddibna riix "Receive" markay alaabtu timaado si ay
          stock-ka ugu darsanto.
        </p>
      </header>

      <form className="purchase-form" onSubmit={handleCreateOrder}>
        <div className="purchase-form-row">
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required>
            <option value="">— Supplier —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} required>
            <option value="">— Branch —</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div className="purchase-lines">
          {lines.map((line, i) => (
            <div className="purchase-line" key={i}>
              <select
                value={line.product_id}
                onChange={(e) => updateLine(i, "product_id", e.target.value)}
              >
                <option value="">— Alaabta —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Tirada"
                value={line.quantity}
                onChange={(e) => updateLine(i, "quantity", e.target.value)}
              />
              <input
                type="number"
                step="0.01"
                placeholder="Qiimaha halkii"
                value={line.unit_cost}
                onChange={(e) => updateLine(i, "unit_cost", e.target.value)}
              />
              {lines.length > 1 && (
                <button type="button" className="row-delete" onClick={() => removeLine(i)}>
                  Ka saar
                </button>
              )}
            </div>
          ))}
          <button type="button" className="add-line-btn" onClick={addLine}>
            + Ku dar alaab kale
          </button>
        </div>

        <div className="purchase-form-footer">
          <span className="purchase-total">Total: {total.toFixed(2)}</span>
          <button type="submit" disabled={saving}>
            {saving ? "…" : "Samee Purchase Order"}
          </button>
        </div>
      </form>

      {error && <p className="auth-error">{error}</p>}

      {loading ? (
        <p className="lede">Soo dejinaya…</p>
      ) : orders.length === 0 ? (
        <p className="lede">Wali purchase order lama samayn.</p>
      ) : (
        <div className="order-list">
          {orders.map((order) => (
            <div className="order-card" key={order.id}>
              <div className="order-card-head">
                <div>
                  <strong>{order.suppliers?.name || "—"}</strong>
                  <span className="order-branch"> · {order.branches?.name || "—"}</span>
                </div>
                <span className={`order-status order-status-${order.status}`}>
                  {order.status}
                </span>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Alaabta</th>
                    <th>Tirada</th>
                    <th>Qiimaha halkii</th>
                    <th>La helay</th>
                  </tr>
                </thead>
                <tbody>
                  {order.purchase_items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.products?.name || "—"}</td>
                      <td>{item.quantity}</td>
                      <td>{Number(item.unit_cost).toFixed(2)}</td>
                      <td>{item.received_quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="order-card-foot">
                <span>Total: {Number(order.total_amount).toFixed(2)}</span>
                {order.status !== "received" && (
                  <button
                    className="auth-submit order-receive-btn"
                    onClick={() => handleReceive(order)}
                    disabled={receivingId === order.id}
                  >
                    {receivingId === order.id ? "…" : "Receive (ku dar stock-ka)"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}