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
  Sparkles,
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

  // ============================================================
  // CURRENT ROUTE / PERMISSION
  // ============================================================

  const currentModule = moduleKeyForPath(location.pathname);

  const allowed = canAccess(
    profile?.role,
    currentModule
  );

  // ============================================================
  // USER INFORMATION
  // ============================================================

  const fullName =
    profile?.full_name ||
    profile?.fullName ||
    "User";

  const role =
    profile?.role
      ? profile.role.replaceAll("_", " ")
      : "User";

  const branch =
    profile?.branch?.name ||
    profile?.branch_name ||
    "Branch lama dooran";

  const organizationName =
    profile?.organizations?.name ||
    "Organization";

  const subscriptionPlan =
    profile?.organizations?.subscription_plan ||
    "Plan";

  // ============================================================
  // INITIAL
  // ============================================================

  const userInitial =
    fullName.trim().charAt(0).toUpperCase() || "U";

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f2efe7] text-[#273b4b]">

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
          w-72
          min-w-72
          shrink-0
          flex-col
          overflow-hidden
          bg-[#13293d]
          text-white
          shadow-2xl
        "
      >

        {/* =====================================================
            BRAND
        ====================================================== */}

        <div className="shrink-0 border-b border-white/10 px-5 py-6">

          <div className="flex items-center gap-3">

            <div
              className="
                flex
                h-11
                w-11
                shrink-0
                items-center
                justify-center
                rounded-2xl
                bg-[#48a6a7]
                text-xl
                font-extrabold
                text-white
                shadow-lg
                shadow-black/20
              "
            >
              M
            </div>

            <div className="min-w-0">

              <div className="flex items-center gap-2">

                <span className="text-lg font-bold tracking-tight text-white">
                  Medvora
                </span>

                <Sparkles
                  size={14}
                  className="text-[#d7b46a]"
                />

              </div>

              <div className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a9bac6]">
                Pharmacy Management
              </div>

            </div>

          </div>

        </div>

        {/* =====================================================
            NAVIGATION
        ====================================================== */}

        <nav
          className="
            sidebar-scroll
            min-h-0
            flex-1
            overflow-y-auto
            overflow-x-hidden
            px-3
            py-5
          "
        >

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

                  <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#7f96a8]">
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
                                ? "bg-[#48a6a7] text-white shadow-md shadow-black/20"
                                : "text-[#c6d1d9] hover:bg-white/10 hover:text-white",
                            ].join(" ")
                          }
                        >
                          {({ isActive }) => (
                            <>
                              <Icon
                                size={18}
                                strokeWidth={isActive ? 2.5 : 2}
                                className={
                                  isActive
                                    ? "shrink-0 text-white"
                                    : "shrink-0 text-[#8ea5b5] group-hover:text-[#d7b46a]"
                                }
                              />

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

        {/* =====================================================
            ORGANIZATION
        ====================================================== */}

        {profile?.organizations && (
          <div className="shrink-0 px-3 pb-2">

            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5">

              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7f96a8]">
                Organization
              </p>

              <p className="mt-1 truncate text-sm font-semibold text-white">
                {organizationName}
              </p>

              <p className="mt-0.5 text-[11px] capitalize text-[#9eb0bd]">
                {subscriptionPlan}
              </p>

            </div>

          </div>
        )}

        {/* =====================================================
            USER CARD
        ====================================================== */}

        <div className="shrink-0 border-t border-white/10 p-3">

          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">

            <div className="flex items-center gap-3">

              <div
                className="
                  flex
                  h-10
                  w-10
                  shrink-0
                  items-center
                  justify-center
                  rounded-full
                  bg-[#d7b46a]
                  font-bold
                  text-[#13293d]
                "
              >
                {userInitial}
              </div>

              <div className="min-w-0 flex-1">

                <p className="truncate text-sm font-semibold text-white">
                  {fullName}
                </p>

                <p className="truncate text-xs capitalize text-[#a9bac6]">
                  {role}
                </p>

                <p className="truncate text-[11px] text-[#7f96a8]">
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
                text-[#c6d1d9]
                transition
                hover:border-red-300/20
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
          bg-[#f2efe7]
        "
      >

        <div
          className="
            min-h-full
            w-full
            px-5
            py-5
            sm:px-6
            lg:px-8
            lg:py-6
          "
        >

          {allowed ? (
            <Outlet />
          ) : (

            <div className="flex min-h-[calc(100vh-3rem)] items-center justify-center p-8">

              <div
                className="
                  w-full
                  max-w-lg
                  rounded-3xl
                  border
                  border-[#e2dccf]
                  bg-[#fffdf8]
                  p-10
                  text-center
                  shadow-sm
                "
              >

                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f8eaea] text-xl font-bold text-[#b94a48]">
                  !
                </div>

                <h1 className="text-2xl font-bold text-[#13293d]">
                  Ma haysatid ogolaansho
                </h1>

                <p className="mt-3 leading-7 text-[#7c858c]">

                  Doorkaaga hadda{" "}

                  <strong className="capitalize text-[#273b4b]">
                    {role}
                  </strong>{" "}

                  uma ogola inuu galo boggan.

                </p>

                <NavLink
                  to="/dashboard"
                  className="
                    mt-6
                    inline-flex
                    items-center
                    justify-center
                    rounded-xl
                    bg-[#13293d]
                    px-5
                    py-3
                    text-sm
                    font-semibold
                    text-white
                    transition
                    hover:bg-[#1d3a55]
                  "
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