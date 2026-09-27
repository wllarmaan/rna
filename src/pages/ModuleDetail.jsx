import React, { useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { modules } from "../data/modules.js";

export default function ModuleDetail() {
  const { id } = useParams();
  const index = modules.findIndex((m) => m.id === id);
  const module = modules[index];
  const prev = modules[index - 1];
  const next = modules[index + 1];

  // Local, in-memory only — resets on reload. Lets you tick off items
  // while reviewing the spec; not persisted anywhere.
  const [checked, setChecked] = useState(() => new Set());

  if (!module) return <Navigate to="/spec" replace />;

  function toggle(item) {
    setChecked((prevSet) => {
      const next = new Set(prevSet);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  }

  return (
    <div className="page">
      <Link to="/spec" className="back-link">
        ← Dhammaan modules-ka
      </Link>

      <header className="page-header">
        <p className="eyebrow-plain">Module {String(module.number).padStart(2, "0")}</p>
        <h1>{module.title}</h1>
        <p className="lede">
          {checked.size} / {module.items.length} la calaamadeeyay
        </p>
      </header>

      <ul className="item-list">
        {module.items.map((item) => (
          <li key={item}>
            <label className="item-row">
              <input
                type="checkbox"
                checked={checked.has(item)}
                onChange={() => toggle(item)}
              />
              <span className={checked.has(item) ? "item-checked" : ""}>{item}</span>
            </label>
          </li>
        ))}
      </ul>

      <nav className="module-pager">
        {prev ? (
          <Link to={`/module/${prev.id}`} className="pager-link">
            ← {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link to={`/module/${next.id}`} className="pager-link pager-link-next">
            {next.title} →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}