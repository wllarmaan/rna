// Role → modules the UI shows / allows.
//
// MUHIIM: kani waa lakabka UI-ga (fududaynta isticmaalka). Amniga dhabta ah
// waa RLS-ka database-ka (supabase/07_role_permissions.sql) — labadaba
// waa in ay isku waafaqsanaadaan. Haddii aad halkan wax ka beddesho, ka
// beddel sidoo kale 07_role_permissions.sql.

const ALL = "*";

export const ROLE_ACCESS = {
  organization_owner: ALL,
  super_admin: ALL,
  manager: ALL,

  pharmacist: ["dashboard", "products", "categories", "purchases", "sales", "inventory", "customers", "suppliers",
    "sales_summary", "stock_summary"],

  pharmacy_technician: ["dashboard", "products", "categories", "sales", "inventory", "customers",
    "sales_summary", "stock_summary"],

  cashier: ["dashboard", "sales", "customers", "sales_summary"],

  accountant: ["dashboard", "customers", "suppliers", "expenses",
    "sales_summary", "expenses_summary", "balances_summary"],

  // Clinical roles — modules-kooda weli lama dhisin
  lab_technician: ["dashboard"],
  nurse: ["dashboard"],
  doctor: ["dashboard"],

  // Default (qof cusub oo aan weli role la siin)
  staff: ["dashboard"],
};

// Bogag aan halkan lagu qeexin (tusaale /settings) waxaa arki kara oo
// keliya owner/manager (ALL).
export function canAccess(role, key) {
  const allowed = ROLE_ACCESS[role];
  if (!allowed) return false;
  if (allowed === ALL) return true;
  return allowed.includes(key);
}

// URL path → module key
export function moduleKeyForPath(pathname) {
  const seg = pathname.split("/")[1] || "dashboard";
  if (seg === "module") return "spec";
  return seg;
}