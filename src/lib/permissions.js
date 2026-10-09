const ROLE_PERMISSIONS = {
  organization_owner: [
    "",
    "dashboard",
    "products",
    "purchases",
    "sales",
    "inventory",
    "categories",
    "customers",
    "suppliers",
    "branches",
    "expenses",
    "team",
    "spec",
  ],

  owner: [
    "",
    "dashboard",
    "products",
    "purchases",
    "sales",
    "inventory",
    "categories",
    "customers",
    "suppliers",
    "branches",
    "expenses",
    "team",
    "spec",
  ],

  admin: [
    "",
    "dashboard",
    "products",
    "purchases",
    "sales",
    "inventory",
    "categories",
    "customers",
    "suppliers",
    "branches",
    "expenses",
    "team",
    "spec",
  ],

  manager: [
    "",
    "dashboard",
    "products",
    "purchases",
    "sales",
    "inventory",
    "categories",
    "customers",
    "suppliers",
    "branches",
    "expenses",
    "team",
    "spec",
  ],

  pharmacist: [
    "dashboard",
    "products",
    "categories",
    "purchases",
    "sales",
    "inventory",
    "customers",
    "suppliers",
  ],

  pharmacy_technician: [
    "dashboard",
    "products",
    "categories",
    "sales",
    "inventory",
    "customers",
  ],

  cashier: [
    "dashboard",
    "sales",
    "customers",
  ],

  accountant: [
    "dashboard",
    "customers",
    "suppliers",
    "expenses",
  ],

  lab_technician: [
    "dashboard",
  ],

  nurse: [
    "dashboard",
  ],

  doctor: [
    "dashboard",
  ],

  staff: [
    "dashboard",
  ],
};

export function canAccess(role, key) {
  if (!role || !key) {
    return false;
  }

  const normalizedRole = String(role).trim().toLowerCase();
  const normalizedKey = String(key).trim().toLowerCase();

  const allowedKeys = ROLE_PERMISSIONS[normalizedRole] || [];

  return allowedKeys.includes(normalizedKey);
}

export function moduleKeyForPath(pathname) {
  if (!pathname || pathname === "/") {
    return "dashboard";
  }

  const path = pathname.toLowerCase();

  if (path.startsWith("/dashboard")) {
    return "dashboard";
  }

  if (path.startsWith("/module")) {
    return "spec";
  }

  if (path.startsWith("/products")) {
    return "products";
  }

  if (path.startsWith("/purchases")) {
    return "purchases";
  }

  if (path.startsWith("/sales")) {
    return "sales";
  }

  if (path.startsWith("/inventory")) {
    return "inventory";
  }

  if (path.startsWith("/categories")) {
    return "categories";
  }

  if (path.startsWith("/customers")) {
    return "customers";
  }

  if (path.startsWith("/suppliers")) {
    return "suppliers";
  }

  if (path.startsWith("/branches")) {
    return "branches";
  }

  if (path.startsWith("/expenses")) {
    return "expenses";
  }

  if (path.startsWith("/team")) {
    return "team";
  }

  if (path.startsWith("/spec")) {
    return "spec";
  }

  return null;
}