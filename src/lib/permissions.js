const ROLE_PERMISSIONS = {
  organization_owner: [
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
  ],
};

export function canAccess(role, key) {
  if (!role) return false;
  const allowedKeys = ROLE_PERMISSIONS[role] || [];
  return allowedKeys.includes(key);
}

export function moduleKeyForPath(pathname) {
  if (pathname.startsWith("/products")) return "products";
  if (pathname.startsWith("/purchases")) return "purchases";
  if (pathname.startsWith("/sales")) return "sales";
  if (pathname.startsWith("/inventory")) return "inventory";
  if (pathname.startsWith("/categories")) return "categories";
  if (pathname.startsWith("/customers")) return "customers";
  if (pathname.startsWith("/suppliers")) return "suppliers";
  if (pathname.startsWith("/branches")) return "branches";
  if (pathname.startsWith("/expenses")) return "expenses";
  if (pathname.startsWith("/team")) return "team";
  if (pathname.startsWith("/spec")) return "spec";
  return null;
}