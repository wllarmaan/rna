import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  Plus,
  Trash2,
  FileText,
  Image as ImageIcon,
  Package,
  RefreshCw,
  X,
  Database,
} from "lucide-react";

import { supabase } from "../lib/supabaseClient.js";
import { useAuth } from "../lib/AuthContext.jsx";
import { uploadMedia, deleteMedia } from "../lib/storage.js";

function initialForm(fields) {
  const f = {};

  fields.forEach((field) => {
    f[field.name] =
      field.type === "checkbox" ? false : field.default ?? "";
  });

  return f;
}

function FieldInput({
  field,
  value,
  onChange,
  relationOptions,
}) {
  const commonClass =
    "w-full rounded-xl border border-[#d9d2c3] bg-white px-3.5 py-2.5 text-sm text-[#15314a] outline-none transition focus:border-[#48a6a7] focus:ring-2 focus:ring-[#48a6a7]/15";

  if (field.type === "select") {
    return (
      <select
        className={commonClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={field.required}
      >
        <option value="">
          {field.placeholder || `— ${field.label} —`}
        </option>

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
      <select
        className={commonClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={field.required}
      >
        <option value="">
          {field.placeholder || `— ${field.label} —`}
        </option>

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
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#d9d2c3] bg-white px-4 py-3 text-sm text-[#15314a]">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 accent-[#48a6a7]"
        />

        <span className="font-medium">
          {field.label}
        </span>
      </label>
    );
  }

  if (field.type === "textarea") {
    return (
      <textarea
        placeholder={field.placeholder || field.label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={field.required}
        rows={3}
        className={`${commonClass} min-h-[92px] resize-y`}
      />
    );
  }

  return (
    <input
      className={commonClass}
      type={field.type || "text"}
      step={field.step}
      placeholder={field.placeholder || field.label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={field.required}
    />
  );
}

function FieldWrapper({ field, children }) {
  if (field.type === "checkbox") {
    return (
      <div className="flex-1 min-w-[200px]">
        {children}
      </div>
    );
  }

  return (
    <div className="min-w-[190px] flex-1">
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.08em] text-[#6d7882]">
        {field.label}

        {field.required && (
          <span className="ml-1 text-[#b45b5b]">
            *
          </span>
        )}
      </label>

      {children}
    </div>
  );
}

/**
 * Generic list + add-form + delete page driven by
 * src/data/tables.js.
 *
 * Multi-tenant rules:
 * - Every main query is filtered by organization_id.
 * - Inserts always include organization_id.
 * - Deletes require organization_id.
 * - Relation tables can optionally be organization-scoped.
 */
export default function CrudPage({ config }) {
  const { profile } = useAuth();

  const {
    table,
    fields,
    title,
    description,
    orderBy,
    image,
    extraInsert,
    statementPath,
  } = config;

  const organizationId = profile?.organization_id;

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() =>
    initialForm(fields)
  );
  const [imageFile, setImageFile] = useState(null);
  const [relationOptions, setRelationOptions] =
    useState({});
  const [search, setSearch] = useState("");

  const columns = useMemo(
    () => fields.filter((f) => f.inTable !== false),
    [fields]
  );

  const relationFields = useMemo(
    () => fields.filter((f) => f.type === "relation"),
    [fields]
  );

  const formFields = useMemo(
    () => fields.filter((f) => f.inForm !== false),
    [fields]
  );

  useEffect(() => {
    if (!organizationId) {
      setRows([]);
      setRelationOptions({});
      setLoading(false);
      return;
    }

    load();
    loadRelationOptions();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, organizationId]);

  async function load() {
    if (!organizationId) return;

    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("organization_id", organizationId)
      .order(orderBy || "created_at", {
        ascending: !!orderBy,
      });

    if (error) {
      setError(error.message);
      setRows([]);
    } else {
      setRows(data || []);
    }

    setLoading(false);
  }

  async function loadRelationOptions() {
    if (!organizationId) return;

    const opts = {};

    for (const field of relationFields) {
      const relation = field.relation;

      if (!relation?.table || !relation?.labelField) {
        opts[field.name] = [];
        continue;
      }

      const {
        table: relTable,
        labelField,
        organizationScoped = false,
      } = relation;

      let query = supabase
        .from(relTable)
        .select(`id, ${labelField}`)
        .order(labelField);

      if (organizationScoped) {
        query = query.eq(
          "organization_id",
          organizationId
        );
      }

      const { data, error } = await query;

      if (!error) {
        opts[field.name] = (data || []).map((row) => ({
          id: row.id,
          label: row[labelField],
        }));
      } else {
        opts[field.name] = [];
      }
    }

    setRelationOptions(opts);
  }

  function relationLabel(field, id) {
    if (!id) return "—";

    const opt = (
      relationOptions[field.name] || []
    ).find((o) => o.id === id);

    return opt ? opt.label : "—";
  }

  function updateField(name, value) {
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleAdd(e) {
    e.preventDefault();

    if (!organizationId) {
      setError(
        "Profile-kaaga wali lama xirin organization."
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        organization_id: organizationId,
      };

      fields.forEach((field) => {
        let value = form[field.name];

        if (field.type === "number") {
          value =
            value === "" || value === null
              ? null
              : Number(value);

          if (Number.isNaN(value)) {
            value = null;
          }
        }

        if (field.type === "checkbox") {
          value = !!value;
        }

        if (value === "") {
          value =
            field.nullable === false
              ? value
              : null;
        }

        payload[field.name] = value;
      });

      if (image && imageFile) {
        const { url, path } = await uploadMedia(
          imageFile,
          organizationId,
          image.folder
        );

        payload[image.urlCol] = url;
        payload[image.pathCol] = path;
      }

      if (typeof extraInsert === "function") {
        Object.assign(
          payload,
          extraInsert(profile)
        );
      }

      const { error: insertError } =
        await supabase
          .from(table)
          .insert(payload);

      if (insertError) {
        throw insertError;
      }

      setForm(initialForm(fields));
      setImageFile(null);

      const fileInput =
        document.querySelector(
          'input[type="file"]'
        );

      if (fileInput) {
        fileInput.value = "";
      }

      await load();
    } catch (err) {
      setError(
        err?.message ||
          "Xogta lama kaydin."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row) {
    if (!organizationId) {
      setError(
        "Organization lama helin."
      );
      return;
    }

    const confirmed = window.confirm(
      "Ma hubtaa inaad tirtirayso xogtan?"
    );

    if (!confirmed) return;

    setError("");

    const { error } = await supabase
      .from(table)
      .delete()
      .eq("id", row.id)
      .eq(
        "organization_id",
        organizationId
      );

    if (error) {
      setError(error.message);
      return;
    }

    if (image && row[image.pathCol]) {
      try {
        await deleteMedia(
          row[image.pathCol]
        );
      } catch {
        // Database row is already deleted.
        // Storage cleanup failure should not
        // make the page appear unsuccessful.
      }
    }

    setRows((prev) =>
      prev.filter(
        (r) => r.id !== row.id
      )
    );
  }

  const filteredRows = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    if (!query) return rows;

    return rows.filter((row) => {
      return fields.some((field) => {
        let value =
          row[field.name];

        if (field.type === "relation") {
          value = relationLabel(
            field,
            value
          );
        }

        if (
          value === null ||
          value === undefined
        ) {
          return false;
        }

        return String(value)
          .toLowerCase()
          .includes(query);
      });
    });
  }, [
    rows,
    search,
    fields,
    relationOptions,
  ]);

  return (
    <div className="min-h-full bg-[#f2efe7] p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-[1600px]">

        {/* PAGE HEADER */}
        <header className="mb-6 overflow-hidden rounded-2xl border border-[#d9d2c3] bg-[#13293d] shadow-sm">
          <div className="relative px-5 py-6 md:px-7">
            <div className="absolute right-0 top-0 h-full w-40 bg-[#48a6a7]/10" />

            <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#48a6a7] text-white shadow-sm">
                    <Package size={18} />
                  </span>

                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#d7b46a]">
                    Medvora · Management
                  </span>
                </div>

                <h1 className="text-2xl font-extrabold tracking-tight text-white md:text-3xl">
                  {title}
                </h1>

                {description && (
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
                    {description}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 self-start rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/75 md:self-auto">
                <Database size={15} />
                <span>
                  Live · Supabase
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* ERROR */}
        {error && (
          <div className="mb-5 flex items-start justify-between gap-4 rounded-2xl border border-[#e7b7b7] bg-[#fff5f5] px-4 py-3 text-sm text-[#8e3d3d] shadow-sm">
            <div>
              <p className="font-bold">
                Waxaa dhacay qalad
              </p>

              <p className="mt-0.5">
                {error}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setError("")}
              className="rounded-lg p-1 text-[#8e3d3d] transition hover:bg-[#f3dede]"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* ADD FORM */}
        <section className="mb-6 overflow-hidden rounded-2xl border border-[#d9d2c3] bg-white shadow-sm">
          <div className="border-b border-[#e7e1d2] bg-[#faf8f3] px-5 py-4 md:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#48a6a7]/10 text-[#247b7c]">
                <Plus size={18} />
              </div>

              <div>
                <h2 className="text-sm font-extrabold text-[#15314a]">
                  Ku dar xog cusub
                </h2>

                <p className="mt-0.5 text-xs text-[#74808a]">
                  Buuxi xogta hoose kadibna kaydi.
                </p>
              </div>
            </div>
          </div>

          <form
            onSubmit={handleAdd}
            className="p-5 md:p-6"
          >
            <div className="flex flex-wrap gap-4">
              {formFields.map((field) => (
                <FieldWrapper
                  key={field.name}
                  field={field}
                >
                  <FieldInput
                    field={field}
                    value={form[field.name]}
                    onChange={(value) =>
                      updateField(
                        field.name,
                        value
                      )
                    }
                    relationOptions={
                      relationOptions
                    }
                  />
                </FieldWrapper>
              ))}

              {image && (
                <div className="min-w-[240px] flex-1">
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.08em] text-[#6d7882]">
                    {image.label}
                  </label>

                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-[#cfc6b5] bg-[#faf8f3] px-4 py-2.5 transition hover:border-[#48a6a7] hover:bg-[#f5fbfb]">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#48a6a7]/10 text-[#247b7c]">
                      <ImageIcon size={17} />
                    </span>

                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-[#15314a]">
                        {imageFile
                          ? imageFile.name
                          : "Dooro sawir"}
                      </span>

                      <span className="block text-[11px] text-[#7a858e]">
                        {image.accept ||
                          "PNG, JPG, WEBP"}
                      </span>
                    </span>

                    <input
                      type="file"
                      accept={
                        image.accept ||
                        "image/*"
                      }
                      onChange={(e) =>
                        setImageFile(
                          e.target.files?.[0] ||
                            null
                        )
                      }
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              <div className="flex min-w-[150px] items-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#48a6a7] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#398d8e] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <>
                      <RefreshCw
                        size={16}
                        className="animate-spin"
                      />
                      Kaydinaya...
                    </>
                  ) : (
                    <>
                      <Plus size={17} />
                      Ku dar
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </section>

        {/* LIST / TABLE */}
        <section className="overflow-hidden rounded-2xl border border-[#d9d2c3] bg-white shadow-sm">
          {/* TOOLBAR */}
          <div className="flex flex-col gap-4 border-b border-[#e7e1d2] bg-[#faf8f3] px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">
            <div>
              <h2 className="text-sm font-extrabold text-[#15314a]">
                Diiwaanka
              </h2>

              <p className="mt-1 text-xs text-[#7a858e]">
                {loading
                  ? "Soo dejinaya xogta..."
                  : `${filteredRows.length} xog ayaa muuqata`}
              </p>
            </div>

            <div className="flex w-full items-center gap-2 md:w-auto">
              <div className="relative w-full md:w-[300px]">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#87929b]"
                />

                <input
                  type="text"
                  value={search}
                  onChange={(e) =>
                    setSearch(e.target.value)
                  }
                  placeholder={`Raadi ${
                    title?.toLowerCase() ||
                    "xog"
                  }...`}
                  className="w-full rounded-xl border border-[#d9d2c3] bg-white py-2.5 pl-9 pr-9 text-sm text-[#15314a] outline-none transition focus:border-[#48a6a7] focus:ring-2 focus:ring-[#48a6a7]/15"
                />

                {search && (
                  <button
                    type="button"
                    onClick={() =>
                      setSearch("")
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-[#7d8991] hover:bg-[#f2efe7]"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={load}
                disabled={
                  loading ||
                  !organizationId
                }
                title="Cusboonaysii"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#d9d2c3] bg-white text-[#52616d] transition hover:border-[#48a6a7] hover:text-[#247b7c] disabled:opacity-50"
              >
                <RefreshCw
                  size={16}
                  className={
                    loading
                      ? "animate-spin"
                      : ""
                  }
                />
              </button>
            </div>
          </div>

          {/* LOADING */}
          {loading ? (
            <div className="flex min-h-[240px] flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#48a6a7]/10 text-[#247b7c]">
                <RefreshCw
                  size={22}
                  className="animate-spin"
                />
              </div>

              <p className="text-sm font-bold text-[#15314a]">
                Soo dejinaya...
              </p>

              <p className="mt-1 text-xs text-[#7a858e]">
                Fadlan sug wax yar.
              </p>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f2efe7] text-[#71808b]">
                {search ? (
                  <Search size={24} />
                ) : (
                  <Package size={24} />
                )}
              </div>

              <h3 className="text-sm font-extrabold text-[#15314a]">
                {search
                  ? "Wax natiijo ah lama helin"
                  : "Wali xog lama gelin"}
              </h3>

              <p className="mt-1 max-w-sm text-xs leading-5 text-[#7a858e]">
                {search
                  ? "Isku day eray kale ama ka saar search-ka."
                  : "Isticmaal foomka kore si aad xog cusub ugu darto."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] border-collapse">
                <thead>
                  <tr className="border-b border-[#e7e1d2] bg-[#f7f4ed]">
                    {image && (
                      <th className="px-5 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#6d7882]">
                        Sawir
                      </th>
                    )}

                    {columns.map((column) => (
                      <th
                        key={column.name}
                        className="px-5 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#6d7882]"
                      >
                        {column.label}
                      </th>
                    ))}

                    <th className="px-5 py-3 text-right text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#6d7882]">
                      Ficil
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-[#eee9df] transition hover:bg-[#faf9f5]"
                    >
                      {image && (
                        <td className="px-5 py-3.5">
                          {row[image.urlCol] ? (
                            <img
                              src={
                                row[image.urlCol]
                              }
                              alt=""
                              className="h-10 w-10 rounded-xl border border-[#e2dbcf] object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f2efe7] text-[#88939b]">
                              <ImageIcon
                                size={16}
                              />
                            </div>
                          )}
                        </td>
                      )}

                      {columns.map((column) => {
                        let displayValue =
                          row[column.name];

                        if (
                          column.type ===
                          "relation"
                        ) {
                          displayValue =
                            relationLabel(
                              column,
                              row[
                                column.name
                              ]
                            );
                        } else if (
                          column.type ===
                          "checkbox"
                        ) {
                          displayValue =
                            row[column.name]
                              ? "Haa"
                              : "Maya";
                        }

                        return (
                          <td
                            key={
                              column.name
                            }
                            className="px-5 py-3.5 text-sm text-[#354957]"
                          >
                            {displayValue ===
                              null ||
                            displayValue ===
                              undefined ||
                            displayValue ===
                              "" ? (
                              <span className="text-[#a1a8ad]">
                                —
                              </span>
                            ) : (
                              String(
                                displayValue
                              )
                            )}
                          </td>
                        );
                      })}

                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          {statementPath && (
                            <Link
                              to={`/${statementPath}/${row.id}`}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[#d9d2c3] bg-white px-3 py-1.5 text-xs font-bold text-[#52616d] transition hover:border-[#48a6a7] hover:bg-[#f4fbfb] hover:text-[#247b7c]"
                            >
                              <FileText
                                size={14}
                              />
                              Statement
                            </Link>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              handleDelete(
                                row
                              )
                            }
                            className="inline-flex items-center justify-center rounded-lg border border-[#e7caca] bg-white p-2 text-[#a04f4f] transition hover:border-[#c97878] hover:bg-[#fff5f5]"
                            title="Tirtir"
                          >
                            <Trash2
                              size={15}
                            />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* FOOTER */}
          {!loading &&
            filteredRows.length > 0 && (
              <div className="flex flex-col gap-2 border-t border-[#e7e1d2] bg-[#faf8f3] px-5 py-3 text-xs text-[#7a858e] md:flex-row md:items-center md:justify-between">
                <span>
                  Muujinaya{" "}
                  <strong className="text-[#15314a]">
                    {
                      filteredRows.length
                    }
                  </strong>{" "}
                  record
                  {filteredRows.length !==
                  1
                    ? "s"
                    : ""}
                </span>

                {search && (
                  <span>
                    Search:{" "}
                    <strong className="text-[#247b7c]">
                      "{search}"
                    </strong>
                  </span>
                )}
              </div>
            )}
        </section>
      </div>
    </div>
  );
}