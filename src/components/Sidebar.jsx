import React, { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { modules } from "../data/modules.js";
import { groups, groupFor } from "../data/groups.js";
import { useAuth } from "../lib/AuthContext.jsx";
import { canAccess } from "../lib/permissions.js";

export default function Sidebar() {
  const [query, setQuery] = useState("");
  const { profile, signOut } = useAuth();
  const role = profile?.role;
  const canSpec = canAccess(role, "spec");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return modules;
    return modules.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.items.some((it) => it.toLowerCase().includes(q))
    );
  }, [query]);

  const byGroup = useMemo(() => {
    const map = new Map();
    for (const g of groups) map.set(g.label, []);
    for (const m of filtered) {
      const g = groupFor(m.number);
      if (!map.has(g)) map.set(g, []);
      map.get(g).push(m);
    }
    return map;
  }, [filtered]);

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-mark">M</span>
        <div>
          <div className="brand-name">Medvora</div>
          <div className="brand-sub">Master Specification</div>
        </div>
      </div>

      {canSpec && (
        <input
          className="sidebar-search"
          type="text"
          placeholder="Raadi module ama feature…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Raadi modules"
        />
      )}

      <nav className="sidebar-nav">
        <div className="nav-group">
          <div className="nav-group-label">Overview</div>
          <ul>
            <li>
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  "nav-link" + (isActive ? " nav-link-active" : "")
                }
              >
                <span className="nav-number">◆</span>
                <span className="nav-title">Dashboard</span>
              </NavLink>
            </li>
            {canSpec && (
              <li>
                <NavLink
                  to="/spec"
                  className={({ isActive }) =>
                    "nav-link" + (isActive ? " nav-link-active" : "")
                  }
                >
                  <span className="nav-number">◆</span>
                  <span className="nav-title">Master Specification</span>
                </NavLink>
              </li>
            )}
          </ul>
        </div>

        <div className="nav-group">
          <div className="nav-group-label">Live data</div>
          <ul>
            {[
              { to: "/products", key: "products", label: "Products / Medicines" },
              { to: "/purchases", key: "purchases", label: "Purchasing & Stock" },
              { to: "/sales", key: "sales", label: "Sales / POS" },
              { to: "/inventory", key: "inventory", label: "Inventory" },
              { to: "/categories", key: "categories", label: "Categories" },
              { to: "/customers", key: "customers", label: "Customers" },
              { to: "/suppliers", key: "suppliers", label: "Suppliers" },
              { to: "/branches", key: "branches", label: "Branches" },
              { to: "/expenses", key: "expenses", label: "Expenses" },
              { to: "/team", key: "team", label: "Team / Users" },
            ]
              .filter((item) => canAccess(role, item.key))
              .map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    "nav-link" + (isActive ? " nav-link-active" : "")
                  }
                >
                  <span className="nav-number">●</span>
                  <span className="nav-title">{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>

        {canSpec &&
          [...byGroup.entries()].map(([label, mods]) =>
          mods.length ? (
            <div className="nav-group" key={label}>
              <div className="nav-group-label">{label}</div>
              <ul>
                {mods.map((m) => (
                  <li key={m.id}>
                    <NavLink
                      to={`/module/${m.id}`}
                      className={({ isActive }) =>
                        "nav-link" + (isActive ? " nav-link-active" : "")
                      }
                    >
                      <span className="nav-number">{String(m.number).padStart(2, "0")}</span>
                      <span className="nav-title">{m.title}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ) : null
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-user-name">{profile?.full_name || "…"}</div>
          <div className="sidebar-user-org">
            {profile?.organizations?.name || "Ma xirna organization"}
          </div>
        </div>
        <button className="sidebar-signout" onClick={signOut}>
          Ka bax
        </button>
      </div>
    </aside>
  );
}