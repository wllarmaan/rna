import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient.js";
import { useAuth } from "../lib/AuthContext.jsx";
import { uploadMedia, deleteMedia } from "../lib/storage.js";

```js
function initialForm(fields = []) {
  const f = {};
  fields.forEach((field) => {
    f[field.name] = field.type === "checkbox" ? false : field.default ?? "";
  });
  return f;
}
```

function FieldInput({ field, value, onChange, relationOptions }) {
  if (field.type === "select") {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} required={field.required}>
        <option value="">{field.placeholder || `— ${field.label} —`}</option>
        {(field.options || []).map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }
  if (field.type === "relation") {
    const options = relationOptions?.[field.name] || [];
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} required={field.required}>
        <option value="">{field.placeholder || `— ${field.label} —`}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
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
  if (field.type === "textarea") {
    return (
      <textarea
        placeholder={field.label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={field.required}
        rows={3}
        style={{
          flex: "1 1 100%",
          padding: "9px 10px",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius)",
          fontSize: 13.5,
          background: "var(--paper-dim)",
          color: "var(--ink)",
          fontFamily: "inherit",
        }}
      />
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
 * Generic list + add-form + delete page driven entirely by a config object
 * from src/data/tables.js. See that file for the shape of `config`.
 */
export default function CrudPage({ config }) {
  const { profile } = useAuth();
  const { table, fields, title, description, orderBy, image, extraInsert, statementPath } = config;

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => initialForm(fields));
  const [imageFile, setImageFile] = useState(null);
  const [relationOptions, setRelationOptions] = useState({});

  const columns = useMemo(() => fields.filter((f) => f.inTable !== false), [fields]);
  const relationFields = useMemo(() => fields.filter((f) => f.type === "relation"), [fields]);

  useEffect(() => {
    load();
    loadRelationOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order(orderBy || "created_at", { ascending: !!orderBy });
    if (error) setError(error.message);
    else setRows(data);
    setLoading(false);
  }

  async function loadRelationOptions() {
    const opts = {};
    for (const field of relationFields) {
      const { table: relTable, labelField } = field.relation;
      const { data, error } = await supabase.from(relTable).select(`id, ${labelField}`).order(labelField);
      if (!error) {
        opts[field.name] = data.map((row) => ({ id: row.id, label: row[labelField] }));
      }
    }
    setRelationOptions(opts);
  }

  function relationLabel(field, id) {
    if (!id) return "—";
    const opt = (relationOptions[field.name] || []).find((o) => o.id === id);
    return opt ? opt.label : "—";
  }

  function updateField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!profile?.organization_id) {
      setError("Profile-kaaga wali lama xirin organization.");
      return;
    }
    setSaving(true);
    setError("");

    try {
      const payload = { organization_id: profile.organization_id };
      fields.forEach((field) => {
        let value = form[field.name];
        if (field.type === "number") value = value === "" ? null : Number(value);
        if (field.type === "checkbox") value = !!value;
        if (value === "") value = field.nullable === false ? value : null;
        payload[field.name] = value;
      });

      if (image && imageFile) {
        const { url, path } = await uploadMedia(imageFile, profile.organization_id, image.folder);
        payload[image.urlCol] = url;
        payload[image.pathCol] = path;
      }

      if (typeof extraInsert === "function") {
        Object.assign(payload, extraInsert(profile));
      }

      const { error: insertError } = await supabase.from(table).insert(payload);
      if (insertError) throw insertError;

      setForm(initialForm(fields));
      setImageFile(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row) {
    const { error } = await supabase.from(table).delete().eq("id", row.id);
    if (error) {
      setError(error.message);
      return;
    }
    if (image && row[image.pathCol]) {
      deleteMedia(row[image.pathCol]);
    }
    setRows((prev) => prev.filter((r) => r.id !== row.id));
  }

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow-plain">Live data · Supabase</p>
        <h1>{title}</h1>
        {description && <p className="lede">{description}</p>}
      </header>

      <form className="product-form" onSubmit={handleAdd}>
        {fields
          .filter((f) => f.inForm !== false)
          .map((field) => (
            <FieldInput
              key={field.name}
              field={field}
              value={form[field.name]}
              onChange={(v) => updateField(field.name, v)}
              relationOptions={relationOptions}
            />
          ))}
        {image && (
          <label className="checkbox-field" style={{ flex: "1 1 220px" }}>
            {image.label}:
            <input
              type="file"
              accept={image.accept || "image/*"}
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              style={{ marginLeft: 8 }}
            />
          </label>
        )}
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
                {image && <th></th>}
                {columns.map((c) => (
                  <th key={c.name}>{c.label}</th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  {image && (
                    <td>
                      {row[image.urlCol] ? (
                        <img
                          src={row[image.urlCol]}
                          alt=""
                          style={{ width: 36, height: 36, objectFit: "cover", borderRadius: "var(--radius)" }}
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                  )}
                  {columns.map((c) => (
                    <td key={c.name}>
                      {c.type === "relation"
                        ? relationLabel(c, row[c.name])
                        : c.type === "checkbox"
                        ? row[c.name]
                          ? "Haa"
                          : "Maya"
                        : row[c.name] ?? "—"}
                    </td>
                  ))}
                  <td>
                    {statementPath && (
                      <Link to={`/${statementPath}/${row.id}`} className="row-statement-link">
                        Statement
                      </Link>
                    )}
                    <button className="row-delete" onClick={() => handleDelete(row)}>
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