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
    if (profile?.organization_id) {
      loadAll();
    }
  }, [profile?.organization_id]);

  async function loadAll() {
    if (!profile?.organization_id) return;

    setLoading(true);
    setError("");

    const organizationId = profile.organization_id;

    const [stockRes, branchesRes, productsRes] = await Promise.all([
      supabase
        .from("stock_batches")
        .select(
          "id, branch_id, product_id, quantity, expiry_date, batch_number, received_at"
        )
        .eq("organization_id", organizationId)
        .order("expiry_date", { ascending: true, nullsFirst: false }),

      supabase
        .from("branches")
        .select("id, name")
        .eq("organization_id", organizationId)
        .order("name"),

      supabase
        .from("products")
        .select(
          "id, name, unit, reorder_level, status"
        )
        .eq("organization_id", organizationId)
        .order("name"),
    ]);

    if (stockRes.error) {
      setError(stockRes.error.message);
      setLoading(false);
      return;
    }

    if (branchesRes.error) {
      setError(branchesRes.error.message);
      setLoading(false);
      return;
    }

    if (productsRes.error) {
      setError(productsRes.error.message);
      setLoading(false);
      return;
    }

    const branchMap = {};
    (branchesRes.data || []).forEach((branch) => {
      branchMap[branch.id] = branch;
    });

    const productMap = {};
    (productsRes.data || []).forEach((product) => {
      productMap[product.id] = product;
    });

    /*
     * stock_batches wuxuu leeyahay row kasta oo batch ah.
     * Waxaan halkan ku ururinaynaa:
     *
     * branch + product
     *
     * si Inventory-ku u muujiyo hal row oo leh
     * wadarta stock-ga iyo expiry-ga ugu dhow.
     */
    const grouped = {};

    (stockRes.data || []).forEach((batch) => {
      const product = productMap[batch.product_id];
      const branch = branchMap[batch.branch_id];

      if (!product || !branch) return;

      const key = `${batch.branch_id}-${batch.product_id}`;

      if (!grouped[key]) {
        grouped[key] = {
          branch_id: batch.branch_id,
          branch_name: branch.name,
          product_id: batch.product_id,
          product_name: product.name,
          unit: product.unit,
          reorder_level: product.reorder_level,
          quantity_on_hand: 0,
          nearest_expiry: null,
        };
      }

      grouped[key].quantity_on_hand += Number(batch.quantity || 0);

      if (batch.expiry_date) {
        const currentExpiry = grouped[key].nearest_expiry;

        if (
          !currentExpiry ||
          new Date(batch.expiry_date) < new Date(currentExpiry)
        ) {
          grouped[key].nearest_expiry = batch.expiry_date;
        }
      }
    });

    setLevels(Object.values(grouped));
    setBranches(branchesRes.data || []);
    setProducts(productsRes.data || []);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return levels.filter((level) => {
      if (branchFilter && level.branch_id !== branchFilter) {
        return false;
      }

      if (
        q &&
        !String(level.product_name || "")
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }

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
      setError(
        "Fadlan dooro branch, alaab, iyo geli tiro aan eber ahayn."
      );
      return;
    }

    setSaving(true);

    const quantity = Number(adjQty);

    /*
     * Adjustment waxaa loo kaydinayaa batch cusub.
     * Tiro positive = stock kordhin
     * Tiro negative = stock dhimis
     */
    const { data: batch, error: batchError } = await supabase
      .from("stock_batches")
      .insert({
        organization_id: profile.organization_id,
        branch_id: adjBranch,
        product_id: adjProduct,
        quantity,
        received_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (batchError) {
      setError(batchError.message);
      setSaving(false);
      return;
    }

    const { error: moveError } = await supabase
      .from("stock_movements")
      .insert({
        organization_id: profile.organization_id,
        branch_id: adjBranch,
        product_id: adjProduct,
        batch_id: batch.id,
        movement_type: "adjustment",
        quantity,
        reference_type: "manual",
        created_by: profile.id,
      });

    if (moveError) {
      setError(moveError.message);
      setSaving(false);
      return;
    }

    setAdjBranch("");
    setAdjProduct("");
    setAdjQty("");

    await loadAll();

    setSaving(false);
  }

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow-plain">Live data · Supabase</p>

        <h1>Inventory</h1>

        <p className="lede">
          Tirada hadda ah ee alaabta branch kasta — stock-ga waxaa laga
          xisaabiyaa stock batches-ka jira.
        </p>
      </header>

      <div className="inventory-filters">
        <select
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
        >
          <option value="">Dhammaan branches</option>

          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
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
        <p className="lede">
          Wali stock lama helin — samee Purchase Order oo Receive gareey.
        </p>
      ) : (
        <table
          className="data-table"
          style={{ marginBottom: 32 }}
        >
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
            {filtered.map((level) => {
              const low =
                level.reorder_level != null &&
                Number(level.quantity_on_hand) <=
                  Number(level.reorder_level);

              return (
                <tr
                  key={`${level.branch_id}-${level.product_id}`}
                >
                  <td>{level.product_name}</td>

                  <td>{level.branch_name}</td>

                  <td>
                    {Number(level.quantity_on_hand || 0).toFixed(2)}
                  </td>

                  <td>{level.unit || "—"}</td>

                  <td>
                    {level.reorder_level ?? "—"}
                  </td>

                  <td>
                    <span
                      className={
                        low
                          ? "order-status order-status-pending"
                          : "order-status order-status-received"
                      }
                    >
                      {low ? "Low stock" : "OK"}
                    </span>
                  </td>

                  <td>
                    {level.nearest_expiry
                      ? new Date(
                          level.nearest_expiry
                        ).toLocaleDateString()
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <h2
        style={{
          fontSize: 15,
          marginBottom: 12,
        }}
      >
        Stock Adjustment (saxid gacanta)
      </h2>

      <p
        className="lede"
        style={{
          marginTop: 0,
          marginBottom: 14,
        }}
      >
        Isticmaal marka stock-ku aanu isku waafaqsanayn xisaabta
        (tusaale: alaab dhimatay ama khalad la sameeyay). Geli tiro
        togan si aad u kordhiso, ama tiro taban (-5) si aad u dhimo.
      </p>

      <form
        className="purchase-form-row"
        onSubmit={handleAdjust}
        style={{
          borderBottom: "none",
          marginBottom: 24,
        }}
      >
        <select
          value={adjBranch}
          onChange={(e) => setAdjBranch(e.target.value)}
          required
        >
          <option value="">— Branch —</option>

          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>

        <select
          value={adjProduct}
          onChange={(e) => setAdjProduct(e.target.value)}
          required
        >
          <option value="">— Alaabta —</option>

          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
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

        <button
          type="submit"
          disabled={saving}
        >
          {saving ? "…" : "Sax stock-ka"}
        </button>
      </form>
    </div>
  );
}