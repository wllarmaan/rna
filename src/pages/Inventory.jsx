import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { useAuth } from "../lib/AuthContext.jsx";

export default function Inventory() {
  const { profile } = useAuth();
  const [levels, setLevels] = useState([]);
  const [branches, setBranches] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [query, setQuery] = useState("");

  const [adjBranch, setAdjBranch] = useState("");
  const [adjProduct, setAdjProduct] = useState("");
  const [adjQty, setAdjQty] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    const [levelsRes, branchesRes, productsRes] = await Promise.all([
      supabase.from("stock_levels").select("*").order("product_name"),
      supabase.from("branches").select("id, name"),
      supabase.from("products").select("id, name"),
    ]);
    if (levelsRes.error) setError(levelsRes.error.message);
    else setLevels(levelsRes.data);
    setBranches(branchesRes.data || []);
    setProducts(productsRes.data || []);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return levels.filter((l) => {
      if (branchFilter && l.branch_id !== branchFilter) return false;
      if (q && !l.product_name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [levels, branchFilter, query]);

  async function handleAdjust(e) {
    e.preventDefault();
    setError("");
    if (!profile?.organization_id) {
      setError("Profile-kaaga wali lama xirin organization.");
      return;
    }
    if (!adjBranch || !adjProduct || !adjQty || Number(adjQty) === 0) {
      setError("Fadlan dooro branch, alaab, iyo geli tiro aan eber ahayn.");
      return;
    }
    setSaving(true);

    const { data: batch, error: batchError } = await supabase
      .from("stock_batches")
      .insert({
        organization_id: profile.organization_id,
        branch_id: adjBranch,
        product_id: adjProduct,
        quantity: Number(adjQty),
      })
      .select()
      .single();

    if (batchError) {
      setError(batchError.message);
      setSaving(false);
      return;
    }

    const { error: moveError } = await supabase.from("stock_movements").insert({
      organization_id: profile.organization_id,
      branch_id: adjBranch,
      product_id: adjProduct,
      batch_id: batch.id,
      movement_type: "adjustment",
      quantity: Number(adjQty),
      reference_type: "manual",
      created_by: profile.id,
    });

    setSaving(false);
    if (moveError) {
      setError(moveError.message);
      return;
    }

    setAdjBranch("");
    setAdjProduct("");
    setAdjQty("");
    loadAll();
  }

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow-plain">Live data · Supabase</p>
        <h1>Inventory</h1>
        <p className="lede">
          Tirada hadda ah ee alaabta branch kasta — waxay si otomaatig ah isu
          geeyaan marka aad "Receive" gareyso Purchasing.
        </p>
      </header>

      <div className="inventory-filters">
        <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
          <option value="">Dhammaan branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Raadi alaab…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {error && <p className="auth-error">{error}</p>}

      {loading ? (
        <p className="lede">Soo dejinaya…</p>
      ) : filtered.length === 0 ? (
        <p className="lede">Wali stock lama helin — samee Purchase Order oo Receive gareey.</p>
      ) : (
        <table className="data-table" style={{ marginBottom: 32 }}>
          <thead>
            <tr>
              <th>Alaabta</th>
              <th>Branch</th>
              <th>Hadda haysta</th>
              <th>Unit</th>
              <th>Reorder level</th>
              <th>Xaalada</th>
              <th>Expiry ugu dhow</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => {
              const low = l.reorder_level != null && l.quantity_on_hand <= l.reorder_level;
              return (
                <tr key={`${l.branch_id}-${l.product_id}`}>
                  <td>{l.product_name}</td>
                  <td>{l.branch_name}</td>
                  <td>{Number(l.quantity_on_hand).toFixed(2)}</td>
                  <td>{l.unit}</td>
                  <td>{l.reorder_level ?? "—"}</td>
                  <td>
                    <span className={low ? "order-status order-status-pending" : "order-status order-status-received"}>
                      {low ? "Low stock" : "OK"}
                    </span>
                  </td>
                  <td>{l.nearest_expiry ? new Date(l.nearest_expiry).toLocaleDateString() : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <h2 style={{ fontSize: 15, marginBottom: 12 }}>Stock Adjustment (saxid gacanta)</h2>
      <p className="lede" style={{ marginTop: 0, marginBottom: 14 }}>
        Isticmaal marka stock-ku aanu isku waafaqsanayn xisaabta (tusaale: alaab dhimatay,
        khalad la sameeyay). Geli tiro togan si aad u kordhiso, ama tiro taban (-5) si aad u dhimo.
      </p>
      <form className="purchase-form-row" onSubmit={handleAdjust} style={{ borderBottom: "none", marginBottom: 24 }}>
        <select value={adjBranch} onChange={(e) => setAdjBranch(e.target.value)} required>
          <option value="">— Branch —</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select value={adjProduct} onChange={(e) => setAdjProduct(e.target.value)} required>
          <option value="">— Alaabta —</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          type="number"
          step="0.01"
          placeholder="Tiro (+/-)"
          value={adjQty}
          onChange={(e) => setAdjQty(e.target.value)}
          required
        />
        <button type="submit" disabled={saving}>
          {saving ? "…" : "Sax stock-ka"}
        </button>
      </form>
    </div>
  );
}