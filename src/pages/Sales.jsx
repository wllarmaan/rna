import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { useAuth } from "../lib/AuthContext.jsx";

const emptyLine = { product_id: "", quantity: "", unit_price: "" };

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "evc_plus", label: "EVC Plus" },
  { value: "edahab", label: "eDahab" },
  { value: "bank", label: "Bank" },
  { value: "card", label: "Card" },
  { value: "credit", label: "Credit (deyn)" },
];

export default function Sales() {
  const { profile } = useAuth();
  const [sales, setSales] = useState([]);
  const [branches, setBranches] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [stockLevels, setStockLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [branchId, setBranchId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [discount, setDiscount] = useState("0");
  const [tax, setTax] = useState("0");
  const [lines, setLines] = useState([{ ...emptyLine }]);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    const [salesRes, branchesRes, customersRes, productsRes, stockRes] = await Promise.all([
      supabase
        .from("sales")
        .select("*, customers(name), branches(name), sale_items(*, products(name))")
        .order("created_at", { ascending: false }),
      supabase.from("branches").select("id, name"),
      supabase.from("customers").select("id, name, balance"),
      supabase.from("products").select("id, name, selling_price"),
      supabase.from("stock_levels").select("branch_id, product_id, quantity_on_hand"),
    ]);

    if (salesRes.error) setError(salesRes.error.message);
    else setSales(salesRes.data);
    setBranches(branchesRes.data || []);
    setCustomers(customersRes.data || []);
    setProducts(productsRes.data || []);
    setStockLevels(stockRes.data || []);
    setLoading(false);
  }

  function availableStock(productId) {
    const row = stockLevels.find((s) => s.branch_id === branchId && s.product_id === productId);
    return row ? Number(row.quantity_on_hand) : 0;
  }

  function updateLine(index, key, value) {
    setLines((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      if (key === "product_id") {
        const product = products.find((p) => p.id === value);
        if (product) next[index].unit_price = product.selling_price;
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

  const subtotal = useMemo(
    () => lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0),
    [lines]
  );
  const total = subtotal - (Number(discount) || 0) + (Number(tax) || 0);

  async function handleCreateSale(e) {
    e.preventDefault();
    setError("");

    if (!profile?.organization_id) {
      setError("Profile-kaaga wali lama xirin organization.");
      return;
    }
    const validLines = lines.filter((l) => l.product_id && Number(l.quantity) > 0);
    if (!branchId || validLines.length === 0) {
      setError("Fadlan dooro branch iyo ugu yaraan hal alaab oo tiro leh.");
      return;
    }
    if (paymentMethod === "credit" && !customerId) {
      setError("Iibinta deynta (credit) waxay u baahan tahay inaad dooratid macmiil.");
      return;
    }

    setSaving(true);

    const invoiceNumber = `INV-${Date.now()}`;
    const paymentStatus = paymentMethod === "credit" ? "unpaid" : "paid";

    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .insert({
        organization_id: profile.organization_id,
        branch_id: branchId,
        customer_id: customerId || null,
        invoice_number: invoiceNumber,
        subtotal,
        discount: Number(discount) || 0,
        tax: Number(tax) || 0,
        total,
        payment_status: paymentStatus,
        payment_method: paymentMethod,
        status: "completed",
        cashier_id: profile.id,
      })
      .select()
      .single();

    if (saleError) {
      setError(saleError.message);
      setSaving(false);
      return;
    }

    try {
      const itemsPayload = validLines.map((l) => ({
        sale_id: sale.id,
        product_id: l.product_id,
        quantity: Number(l.quantity),
        unit_price: Number(l.unit_price) || 0,
        discount: 0,
        total: Number(l.quantity) * (Number(l.unit_price) || 0),
      }));
      const { error: itemsError } = await supabase.from("sale_items").insert(itemsPayload);
      if (itemsError) throw itemsError;

      // Deduct stock: a negative stock_batches entry per line (same pattern
      // as Purchasing's positive receive and Inventory's adjustments) plus
      // an audit row in stock_movements.
      for (const l of validLines) {
        const { data: batch, error: batchError } = await supabase
          .from("stock_batches")
          .insert({
            organization_id: profile.organization_id,
            branch_id: branchId,
            product_id: l.product_id,
            quantity: -Number(l.quantity),
          })
          .select()
          .single();
        if (batchError) throw batchError;

        const { error: moveError } = await supabase.from("stock_movements").insert({
          organization_id: profile.organization_id,
          branch_id: branchId,
          product_id: l.product_id,
          batch_id: batch.id,
          movement_type: "sale",
          quantity: -Number(l.quantity),
          reference_type: "sale",
          reference_id: sale.id,
          created_by: profile.id,
        });
        if (moveError) throw moveError;
      }

      if (paymentMethod === "credit") {
        const customer = customers.find((c) => c.id === customerId);
        const newBalance = (Number(customer?.balance) || 0) + total;
        const { error: balanceError } = await supabase
          .from("customers")
          .update({ balance: newBalance })
          .eq("id", customerId);
        if (balanceError) throw balanceError;
      } else {
        const { error: paymentError } = await supabase.from("payments").insert({
          organization_id: profile.organization_id,
          sale_id: sale.id,
          amount: total,
          method: paymentMethod,
        });
        if (paymentError) throw paymentError;
      }

      setBranchId("");
      setCustomerId("");
      setPaymentMethod("cash");
      setDiscount("0");
      setTax("0");
      setLines([{ ...emptyLine }]);
      loadAll();
    } catch (err) {
      setError(
        `Sale-ka waa la abuuray (${invoiceNumber}) laakiin qaybo ka mid ah (stock/payment) way fashilantay: ${err.message}. Fadlan hubi Inventory bogga.`
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow-plain">Live data · Supabase</p>
        <h1>Sales / POS</h1>
        <p className="lede">
          Marka aad iibiso, stock-ku si otomaatig ah ayuu uga dhimmayaa Inventory-ga, oo
          haddii deyn la iibiyo, macmiilka balance-kiisa wuu kordhayaa.
        </p>
      </header>

      <form className="purchase-form" onSubmit={handleCreateSale}>
        <div className="purchase-form-row">
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} required>
            <option value="">— Branch —</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">— Macmiil (ikhtiyaari) —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div className="purchase-lines">
          {lines.map((line, i) => {
            const avail = branchId && line.product_id ? availableStock(line.product_id) : null;
            const over = avail !== null && Number(line.quantity) > avail;
            return (
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
                  style={over ? { borderColor: "#a5312a" } : undefined}
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Qiimaha halkii"
                  value={line.unit_price}
                  onChange={(e) => updateLine(i, "unit_price", e.target.value)}
                />
                {avail !== null && (
                  <span className="stock-hint" style={over ? { color: "#a5312a" } : undefined}>
                    Haysta: {avail}
                  </span>
                )}
                {lines.length > 1 && (
                  <button type="button" className="row-delete" onClick={() => removeLine(i)}>
                    Ka saar
                  </button>
                )}
              </div>
            );
          })}
          <button type="button" className="add-line-btn" onClick={addLine}>
            + Ku dar alaab kale
          </button>
        </div>

        <div className="purchase-form-row" style={{ marginTop: 4 }}>
          <input
            type="number"
            step="0.01"
            placeholder="Discount"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
          />
          <input
            type="number"
            step="0.01"
            placeholder="Tax"
            value={tax}
            onChange={(e) => setTax(e.target.value)}
          />
        </div>

        <div className="purchase-form-footer">
          <span className="purchase-total">Total: {total.toFixed(2)}</span>
          <button type="submit" disabled={saving}>
            {saving ? "…" : "Samee Iibka (Sale)"}
          </button>
        </div>
      </form>

      {error && <p className="auth-error">{error}</p>}

      {loading ? (
        <p className="lede">Soo dejinaya…</p>
      ) : sales.length === 0 ? (
        <p className="lede">Wali iib lama samayn.</p>
      ) : (
        <div className="order-list">
          {sales.map((sale) => (
            <div className="order-card" key={sale.id}>
              <div className="order-card-head">
                <div>
                  <strong>{sale.invoice_number}</strong>
                  <span className="order-branch">
                    {" "}
                    · {sale.branches?.name || "—"}
                    {sale.customers?.name ? ` · ${sale.customers.name}` : ""}
                  </span>
                </div>
                <span
                  className={
                    sale.payment_status === "paid"
                      ? "order-status order-status-received"
                      : "order-status order-status-pending"
                  }
                >
                  {sale.payment_status} · {sale.payment_method}
                </span>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Alaabta</th>
                    <th>Tirada</th>
                    <th>Qiimaha halkii</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.sale_items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.products?.name || "—"}</td>
                      <td>{item.quantity}</td>
                      <td>{Number(item.unit_price).toFixed(2)}</td>
                      <td>{Number(item.total).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="order-card-foot">
                <span>Total: {Number(sale.total).toFixed(2)}</span>
                <span className="lede" style={{ margin: 0 }}>
                  {new Date(sale.created_at).toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}