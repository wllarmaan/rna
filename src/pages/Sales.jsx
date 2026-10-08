import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { useAuth } from "../lib/AuthContext.jsx";

const emptyLine = {
  product_id: "",
  quantity: "",
  unit_price: "",
};

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
    if (profile?.organization_id) {
      loadAll();
    }
  }, [profile?.organization_id]);

  async function loadAll() {
    if (!profile?.organization_id) return;

    setLoading(true);
    setError("");

    const organizationId = profile.organization_id;

    const [
      salesRes,
      branchesRes,
      customersRes,
      productsRes,
      stockRes,
    ] = await Promise.all([
      supabase
        .from("sales")
        .select(
          "*, customers(name), branches(name), sale_items(*, products(name))"
        )
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false }),

      supabase
        .from("branches")
        .select("id, name")
        .eq("organization_id", organizationId)
        .order("name"),

      supabase
        .from("customers")
        .select("id, name, balance")
        .eq("organization_id", organizationId)
        .order("name"),

      supabase
        .from("products")
        .select("id, name, selling_price")
        .eq("organization_id", organizationId)
        .order("name"),

      supabase
        .from("stock_batches")
        .select("branch_id, product_id, quantity")
        .eq("organization_id", organizationId),
    ]);

    if (salesRes.error) {
      setError(salesRes.error.message);
      setLoading(false);
      return;
    }

    if (branchesRes.error) {
      setError(branchesRes.error.message);
      setLoading(false);
      return;
    }

    if (customersRes.error) {
      setError(customersRes.error.message);
      setLoading(false);
      return;
    }

    if (productsRes.error) {
      setError(productsRes.error.message);
      setLoading(false);
      return;
    }

    if (stockRes.error) {
      setError(stockRes.error.message);
      setLoading(false);
      return;
    }

    /*
     * stock_batches wuxuu leeyahay batch kasta.
     *
     * Halkan waxaan isku geyneynaa:
     * branch_id + product_id
     *
     * si aan u helno stock-ga hadda jira.
     */
    const stockMap = {};

    (stockRes.data || []).forEach((batch) => {
      const key = `${batch.branch_id}-${batch.product_id}`;

      if (!stockMap[key]) {
        stockMap[key] = 0;
      }

      stockMap[key] += Number(batch.quantity || 0);
    });

    const stockRows = Object.entries(stockMap).map(
      ([key, quantity]) => {
        const [branch_id, product_id] = key.split("-");

        return {
          branch_id,
          product_id,
          quantity_on_hand: quantity,
        };
      }
    );

    setSales(salesRes.data || []);
    setBranches(branchesRes.data || []);
    setCustomers(customersRes.data || []);
    setProducts(productsRes.data || []);
    setStockLevels(stockRows);

    setLoading(false);
  }

  function availableStock(productId) {
    if (!branchId || !productId) {
      return 0;
    }

    const row = stockLevels.find(
      (stock) =>
        stock.branch_id === branchId &&
        stock.product_id === productId
    );

    return row ? Number(row.quantity_on_hand) : 0;
  }

  function updateLine(index, key, value) {
    setLines((prev) => {
      const next = [...prev];

      next[index] = {
        ...next[index],
        [key]: value,
      };

      if (key === "product_id") {
        const product = products.find(
          (p) => p.id === value
        );

        if (product) {
          next[index].unit_price =
            product.selling_price ?? "";
        }
      }

      return next;
    });
  }

  function addLine() {
    setLines((prev) => [
      ...prev,
      { ...emptyLine },
    ]);
  }

  function removeLine(index) {
    setLines((prev) =>
      prev.filter((_, i) => i !== index)
    );
  }

  const subtotal = useMemo(
    () =>
      lines.reduce(
        (sum, line) =>
          sum +
          (Number(line.quantity) || 0) *
            (Number(line.unit_price) || 0),
        0
      ),
    [lines]
  );

  const total =
    subtotal -
    (Number(discount) || 0) +
    (Number(tax) || 0);

  async function handleCreateSale(e) {
    e.preventDefault();

    setError("");

    if (!profile?.organization_id) {
      setError(
        "Profile-kaaga wali lama xirin organization."
      );
      return;
    }

    const validLines = lines.filter(
      (line) =>
        line.product_id &&
        Number(line.quantity) > 0
    );

    if (!branchId || validLines.length === 0) {
      setError(
        "Fadlan dooro branch iyo ugu yaraan hal alaab oo tiro leh."
      );
      return;
    }

    if (
      paymentMethod === "credit" &&
      !customerId
    ) {
      setError(
        "Iibinta deynta (credit) waxay u baahan tahay inaad dooratid macmiil."
      );
      return;
    }

    /*
     * Hubinta stock ka hor inta aan Sale la abuurin.
     */
    for (const line of validLines) {
      const available = availableStock(
        line.product_id
      );

      if (Number(line.quantity) > available) {
        const product = products.find(
          (p) => p.id === line.product_id
        );

        setError(
          `Stock kuma filna: ${
            product?.name || "Alaabta"
          }. Hadda waxaa jira ${available}, waxaad rabtaa ${line.quantity}.`
        );

        return;
      }
    }

    setSaving(true);

    const invoiceNumber = `INV-${Date.now()}`;

    const paymentStatus =
      paymentMethod === "credit"
        ? "unpaid"
        : "paid";

    const { data: sale, error: saleError } =
      await supabase
        .from("sales")
        .insert({
          organization_id:
            profile.organization_id,
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
      /*
       * Sale items
       */
      const itemsPayload = validLines.map(
        (line) => ({
          sale_id: sale.id,
          product_id: line.product_id,
          quantity: Number(line.quantity),
          unit_price:
            Number(line.unit_price) || 0,
          discount: 0,
          total:
            Number(line.quantity) *
            (Number(line.unit_price) || 0),
        })
      );

      const { error: itemsError } =
        await supabase
          .from("sale_items")
          .insert(itemsPayload);

      if (itemsError) {
        throw itemsError;
      }

      /*
       * Deduct stock.
       *
       * stock_batches waxaa loo isticmaalaa
       * source-ka inventory-ga.
       *
       * Sale kasta wuxuu abuuraa movement
       * negative quantity ah.
       */
      for (const line of validLines) {
        const { data: batch, error: batchError } =
          await supabase
            .from("stock_batches")
            .insert({
              organization_id:
                profile.organization_id,
              branch_id: branchId,
              product_id: line.product_id,
              quantity: -Number(line.quantity),
              received_at:
                new Date().toISOString(),
            })
            .select()
            .single();

        if (batchError) {
          throw batchError;
        }

        const { error: moveError } =
          await supabase
            .from("stock_movements")
            .insert({
              organization_id:
                profile.organization_id,
              branch_id: branchId,
              product_id: line.product_id,
              batch_id: batch.id,
              movement_type: "sale",
              quantity:
                -Number(line.quantity),
              reference_type: "sale",
              reference_id: sale.id,
              created_by: profile.id,
            });

        if (moveError) {
          throw moveError;
        }
      }

      /*
       * Credit sale
       */
      if (paymentMethod === "credit") {
        const customer = customers.find(
          (customerItem) =>
            customerItem.id === customerId
        );

        const newBalance =
          (Number(customer?.balance) || 0) +
          total;

        const { error: balanceError } =
          await supabase
            .from("customers")
            .update({
              balance: newBalance,
            })
            .eq("id", customerId)
            .eq(
              "organization_id",
              profile.organization_id
            );

        if (balanceError) {
          throw balanceError;
        }
      } else {
        /*
         * Cash / EVC / eDahab / Bank / Card
         */
        const { error: paymentError } =
          await supabase
            .from("payments")
            .insert({
              organization_id:
                profile.organization_id,
              sale_id: sale.id,
              customer_id:
                customerId || null,
              amount: total,
              method: paymentMethod,
            });

        if (paymentError) {
          throw paymentError;
        }
      }

      /*
       * Reset form
       */
      setBranchId("");
      setCustomerId("");
      setPaymentMethod("cash");
      setDiscount("0");
      setTax("0");
      setLines([{ ...emptyLine }]);

      await loadAll();
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
        <p className="eyebrow-plain">
          Live data · Supabase
        </p>

        <h1>Sales / POS</h1>

        <p className="lede">
          Marka aad iibiso, stock-ku si otomaatig ah
          ayuu uga dhimmayaa Inventory-ga, oo haddii
          deyn la iibiyo, macmiilka balance-kiisa wuu
          kordhayaa.
        </p>
      </header>

      <form
        className="purchase-form"
        onSubmit={handleCreateSale}
      >
        <div className="purchase-form-row">
          <select
            value={branchId}
            onChange={(e) =>
              setBranchId(e.target.value)
            }
            required
          >
            <option value="">
              — Branch —
            </option>

            {branches.map((branch) => (
              <option
                key={branch.id}
                value={branch.id}
              >
                {branch.name}
              </option>
            ))}
          </select>

          <select
            value={customerId}
            onChange={(e) =>
              setCustomerId(e.target.value)
            }
          >
            <option value="">
              — Macmiil (ikhtiyaari) —
            </option>

            {customers.map((customer) => (
              <option
                key={customer.id}
                value={customer.id}
              >
                {customer.name}
              </option>
            ))}
          </select>

          <select
            value={paymentMethod}
            onChange={(e) =>
              setPaymentMethod(e.target.value)
            }
          >
            {PAYMENT_METHODS.map((method) => (
              <option
                key={method.value}
                value={method.value}
              >
                {method.label}
              </option>
            ))}
          </select>
        </div>

        <div className="purchase-lines">
          {lines.map((line, index) => {
            const available =
              branchId && line.product_id
                ? availableStock(
                    line.product_id
                  )
                : null;

            const over =
              available !== null &&
              Number(line.quantity) >
                available;

            return (
              <div
                className="purchase-line"
                key={index}
              >
                <select
                  value={line.product_id}
                  onChange={(e) =>
                    updateLine(
                      index,
                      "product_id",
                      e.target.value
                    )
                  }
                >
                  <option value="">
                    — Alaabta —
                  </option>

                  {products.map((product) => (
                    <option
                      key={product.id}
                      value={product.id}
                    >
                      {product.name}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  step="0.01"
                  placeholder="Tirada"
                  value={line.quantity}
                  onChange={(e) =>
                    updateLine(
                      index,
                      "quantity",
                      e.target.value
                    )
                  }
                  style={
                    over
                      ? {
                          borderColor:
                            "#a5312a",
                        }
                      : undefined
                  }
                />

                <input
                  type="number"
                  step="0.01"
                  placeholder="Qiimaha halkii"
                  value={line.unit_price}
                  onChange={(e) =>
                    updateLine(
                      index,
                      "unit_price",
                      e.target.value
                    )
                  }
                />

                {available !== null && (
                  <span
                    className="stock-hint"
                    style={
                      over
                        ? {
                            color: "#a5312a",
                          }
                        : undefined
                    }
                  >
                    Haysta: {available}
                  </span>
                )}

                {lines.length > 1 && (
                  <button
                    type="button"
                    className="row-delete"
                    onClick={() =>
                      removeLine(index)
                    }
                  >
                    Ka saar
                  </button>
                )}
              </div>
            );
          })}

          <button
            type="button"
            className="add-line-btn"
            onClick={addLine}
          >
            + Ku dar alaab kale
          </button>
        </div>

        <div
          className="purchase-form-row"
          style={{ marginTop: 4 }}
        >
          <input
            type="number"
            step="0.01"
            placeholder="Discount"
            value={discount}
            onChange={(e) =>
              setDiscount(e.target.value)
            }
          />

          <input
            type="number"
            step="0.01"
            placeholder="Tax"
            value={tax}
            onChange={(e) =>
              setTax(e.target.value)
            }
          />
        </div>

        <div className="purchase-form-footer">
          <span className="purchase-total">
            Total: {total.toFixed(2)}
          </span>

          <button
            type="submit"
            disabled={saving}
          >
            {saving
              ? "…"
              : "Samee Iibka (Sale)"}
          </button>
        </div>
      </form>

      {error && (
        <p className="auth-error">{error}</p>
      )}

      {loading ? (
        <p className="lede">
          Soo dejinaya…
        </p>
      ) : sales.length === 0 ? (
        <p className="lede">
          Wali iib lama samayn.
        </p>
      ) : (
        <div className="order-list">
          {sales.map((sale) => (
            <div
              className="order-card"
              key={sale.id}
            >
              <div className="order-card-head">
                <div>
                  <strong>
                    {sale.invoice_number}
                  </strong>

                  <span className="order-branch">
                    {" "}
                    ·{" "}
                    {sale.branches?.name ||
                      "—"}

                    {sale.customers?.name
                      ? ` · ${sale.customers.name}`
                      : ""}
                  </span>
                </div>

                <span
                  className={
                    sale.payment_status ===
                    "paid"
                      ? "order-status order-status-received"
                      : "order-status order-status-pending"
                  }
                >
                  {sale.payment_status} ·{" "}
                  {sale.payment_method}
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
                  {(sale.sale_items || []).map(
                    (item) => (
                      <tr key={item.id}>
                        <td>
                          {item.products?.name ||
                            "—"}
                        </td>

                        <td>
                          {item.quantity}
                        </td>

                        <td>
                          {Number(
                            item.unit_price || 0
                          ).toFixed(2)}
                        </td>

                        <td>
                          {Number(
                            item.total || 0
                          ).toFixed(2)}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>

              <div className="order-card-foot">
                <span>
                  Total:{" "}
                  {Number(
                    sale.total || 0
                  ).toFixed(2)}
                </span>

                <span
                  className="lede"
                  style={{ margin: 0 }}
                >
                  {new Date(
                    sale.created_at
                  ).toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}