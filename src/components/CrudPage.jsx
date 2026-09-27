import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { useAuth } from "../lib/AuthContext.jsx";

function initialForm(fields) {
  const f = {};
  fields.forEach((field) => {
    f[field.key] = field.type === "checkbox" ? false : "";
  });
  return f;
}

function FieldInput({ field, value, onChange, options }) {
  if (field.type === "select") {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} required={field.required}>
        <option value="">{field.placeholder || `— ${field.label} —`}</option>
        {(options || []).map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }
  if (field.type === "checkbox") {
    return (
      <label className="checkbox-field">
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
        {field.label}
      </label>
    );
  }
  return (
    <input
      type={field.type || "text"}
      step={field.step}
      placeholder={field.label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={field.required}
    />
  );
}

/**
 * Generic list + add-form + delete page wired directly to one Supabase table.
 *
 * fields:  what the "add" form collects. type: text | number | select | checkbox | time
 *          select fields can use a static `options` array or a dynamic
 *          `optionsTable` (+ optional `optionsLabelKey`, default "name").
 * columns: what the table below shows. optional `format(value)` per column.
 */
export default function CrudPage({ title, subtitle, table, fields, columns, rowActions }) {
  const { profile } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => initialForm(fields));
  const [dynamicOptions, setDynamicOptions] = useState({});

  useEffect(() => {
    load();
    loadDynamicOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setRows(data);
    setLoading(false);
  }

  async function loadDynamicOptions() {
    const opts = {};
    for (const field of fields) {
      if (field.type === "select" && field.optionsTable) {
        const labelKey = field.optionsLabelKey || "name";
        const { data, error } = await supabase.from(field.optionsTable).select(`id, ${labelKey}`);
        if (!error) {
          opts[field.key] = data.map((row) => ({ value: row.id, label: row[labelKey] }));
        }
      }
    }
    setDynamicOptions(opts);
  }

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!profile?.organization_id) {
      setError("Profile-kaaga wali lama xirin organization.");
      return;
    }
    setSaving(true);
    setError("");

    const payload = { organization_id: profile.organization_id };
    fields.forEach((field) => {
      let value = form[field.key];
      if (field.type === "number") value = value === "" ? null : Number(value);
      if (field.type === "checkbox") value = !!value;
      if (value === "") value = null;
      payload[field.key] = value;
    });

    const { error } = await supabase.from(table).insert(payload);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setForm(initialForm(fields));
    load();
  }

  async function handleDelete(id) {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) setError(error.message);
    else setRows((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow-plain">Live data · Supabase</p>
        <h1>{title}</h1>
        {subtitle && <p className="lede">{subtitle}</p>}
      </header>

      <form className="product-form" onSubmit={handleAdd}>
        {fields.map((field) => (
          <FieldInput
            key={field.key}
            field={field}
            value={form[field.key]}
            onChange={(v) => updateField(field.key, v)}
            options={dynamicOptions[field.key] || field.options}
          />
        ))}
        <button type="submit" disabled={saving}>
          {saving ? "…" : "Ku dar"}
        </button>
      </form>

      {error && <p className="auth-error">{error}</p>}

      {loading ? (
        <p className="lede">Soo dejinaya…</p>
      ) : rows.length === 0 ? (
        <p className="lede">Wali xog lama gelin. Isticmaal foomka kore.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  {columns.map((c) => (
                    <td key={c.key}>
                      {c.format ? c.format(row[c.key], row) : row[c.key] ?? "—"}
                    </td>
                  ))}
                  <td>
                    {rowActions && rowActions(row)}
                    <button className="row-delete" onClick={() => handleDelete(row.id)}>
                      Tirtir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}