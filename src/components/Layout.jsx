import React from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import {
  LayoutDashboard,
  Pill,
  ShoppingCart,
  Package,
  Tags,
  Users,
  Truck,
  Building2,
  Receipt,
  UserRound,
  LogOut,
  ChevronRight,
} from "lucide-react";

import { useAuth } from "../lib/AuthContext.jsx";
import { canAccess, moduleKeyForPath } from "../lib/permissions.js";

const navigation = [
  {
    title: "OVERVIEW",
    items: [
      {
        label: "Dashboard",
        to: "/dashboard",
        key: "dashboard",
        icon: LayoutDashboard,
      },
    ],
  },

  {
    title: "OPERATIONS",
    items: [
      {
        label: "Products / Medicines",
        to: "/products",
        key: "products",
        icon: Pill,
      },
      {
        label: "Sales / POS",
        to: "/sales",
        key: "sales",
        icon: ShoppingCart,
      },
      {
        label: "Inventory",
        to: "/inventory",
        key: "inventory",
        icon: Package,
      },
      {
        label: "Categories",
        to: "/categories",
        key: "categories",
        icon: Tags,
      },
    ],
  },

  {
    title: "CUSTOMERS & SUPPLIERS",
    items: [
      {
        label: "Customers",
        to: "/customers",
        key: "customers",
        icon: Users,
      },
      {
        label: "Suppliers",
        to: "/suppliers",
        key: "suppliers",
        icon: Truck,
      },
    ],
  },

  {
    title: "MANAGEMENT",
    items: [
      {
        label: "Branches",
        to: "/branches",
        key: "branches",
        icon: Building2,
      },
      {
        label: "Expenses",
        to: "/expenses",
        key: "expenses",
        icon: Receipt,
      },
      {
        label: "Team / Users",
        to: "/team",
        key: "team",
        icon: UserRound,
      },
    ],
  },
];

function Layout() {
  const { profile, signOut } = useAuth();
  const location = useLocation();

  const currentModule = moduleKeyForPath(location.pathname);

  const allowed = canAccess(
    profile?.role,
    currentModule
  );

  const fullName =
    profile?.full_name ||
    profile?.fullName ||
    "Abdirahmaan Aadan Osman";

  const role =
    profile?.role?.replaceAll("_", " ") ||
    "organization owner";

  const branch =
    profile?.branch?.name ||
    profile?.branch_name ||
    "Alaqsa";

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f8f7f4] text-slate-900">

      {/* =========================================================
          SIDEBAR
      ========================================================== */}

      <aside
        className="
          sticky
          top-0
          z-20
          flex
          h-screen
          w-64
          min-w-64
          shrink-0
          flex-col
          overflow-hidden
          bg-[#0f172a]
          text-white
          shadow-xl
        "
      >

        {/* Brand */}
        <div className="shrink-0 border-b border-white/10 px-5 py-6">
          <div className="flex items-center gap-3">

            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-xl font-bold text-white shadow-lg shadow-emerald-900/30">
              M
            </div>

            <div className="min-w-0">
              <div className="text-lg font-bold tracking-tight">
                Medvora
              </div>

              <div className="truncate text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
                Pharmacy Management
              </div>
            </div>

          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-5">

          <div className="space-y-6">

            {navigation.map((section) => {

              const visibleItems = section.items.filter((item) =>
                canAccess(profile?.role, item.key)
              );

              if (!visibleItems.length) {
                return null;
              }

              return (
                <div key={section.title}>

                  <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                    {section.title}
                  </p>

                  <div className="space-y-1">

                    {visibleItems.map((item) => {

                      const Icon = item.icon;

                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          className={({ isActive }) =>
                            [
                              "group flex w-full min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",

                              isActive
                                ? "bg-emerald-500 text-white shadow-md shadow-emerald-950/30"
                                : "text-slate-300 hover:bg-white/10 hover:text-white",
                            ].join(" ")
                          }
                        >
                          {({ isActive }) => (
                            <>
                              {/* Icon */}
                              <Icon
                                size={18}
                                strokeWidth={isActive ? 2.5 : 2}
                                className={
                                  isActive
                                    ? "shrink-0 text-white"
                                    : "shrink-0 text-slate-400 group-hover:text-emerald-300"
                                }
                              />

                              {/* Menu text */}
                              <span
                                className="
                                  min-w-0
                                  flex-1
                                  truncate
                                  whitespace-nowrap
                                "
                              >
                                {item.label}
                              </span>

                              {/* Active arrow */}
                              {isActive && (
                                <ChevronRight
                                  size={15}
                                  className="shrink-0 text-white/80"
                                />
                              )}
                            </>
                          )}
                        </NavLink>
                      );
                    })}

                  </div>
                </div>
              );
            })}

          </div>
        </nav>

        {/* User Card */}
        <div className="shrink-0 border-t border-white/10 p-3">

          <div className="rounded-2xl bg-white/5 p-3">

            <div className="flex items-center gap-3">

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 font-bold text-white">
                {fullName.charAt(0).toUpperCase()}
              </div>

              <div className="min-w-0 flex-1">

                <p className="truncate text-sm font-semibold text-white">
                  {fullName}
                </p>

                <p className="truncate text-xs capitalize text-slate-400">
                  {role}
                </p>

                <p className="truncate text-[11px] text-slate-500">
                  {branch}
                </p>

              </div>

            </div>

            <button
              type="button"
              onClick={signOut}
              className="
                mt-3
                flex
                w-full
                items-center
                justify-center
                gap-2
                rounded-xl
                border
                border-white/10
                px-3
                py-2
                text-xs
                font-semibold
                text-slate-300
                transition
                hover:bg-red-500/10
                hover:text-red-300
              "
            >
              <LogOut size={15} />
              Ka bax
            </button>

          </div>
        </div>

      </aside>

      {/* =========================================================
          MAIN CONTENT
      ========================================================== */}

      <main
        className="
          relative
          z-10
          min-w-0
          flex-1
          h-screen
          overflow-y-auto
          overflow-x-hidden
        "
      >

        <div className="min-h-full w-full px-6 py-6 lg:px-8">

          {allowed ? (
            <Outlet />
          ) : (

            <div className="flex min-h-[calc(100vh-3rem)] items-center justify-center p-8">

              <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">

                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-xl text-red-500">
                  !
                </div>

                <h1 className="text-2xl font-bold text-slate-900">
                  Ma haysatid ogolaansho
                </h1>

                <p className="mt-3 leading-7 text-slate-500">
                  Doorkaaga hadda{" "}
                  <strong className="text-slate-700">
                    {profile?.role}
                  </strong>{" "}
                  uma ogola inuu galo boggan.
                </p>

                <NavLink
                  to="/dashboard"
                  className="mt-6 inline-flex rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
                >
                  Ku noqo Dashboard
                </NavLink>

              </div>
            </div>

          )}

        </div>

      </main>

    </div>
    );
}


export default Layout;