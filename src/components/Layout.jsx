import React from "react";
import { Outlet, useLocation, Link } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import { useAuth } from "../lib/AuthContext.jsx";
import { canAccess, moduleKeyForPath } from "../lib/permissions.js";

export default function Layout() {
  const { profile } = useAuth();
  const { pathname } = useLocation();
  const allowed = canAccess(profile?.role, moduleKeyForPath(pathname));

  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        {allowed ? (
          <Outlet />
        ) : (
          <div className="page">
            <header className="page-header">
              <p className="eyebrow-plain">Ogolaansho la'aan</p>
              <h1>Ma haysatid ogolaansho</h1>
              <p className="lede">
                Doorkaaga hadda ({profile?.role}) uma ogola inaad gasho bogganan. Haddii aad
                u malaynayso inay khalad tahay, la xiriir owner-ka organization-kaaga.
              </p>
            </header>
            <Link to="/" className="back-link">
              ← Ku noqo Dashboard
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}