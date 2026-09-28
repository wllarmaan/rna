// Hubi in role-kaaga (Owner/Admin) uu leeyahay 'team'
const ROLE_PERMISSIONS = {
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
    "team", // <-- Ku dar kan!
    "spec"
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
    "team" // <-- Ku dar kan!
  ],
  // ...
};

export function canAccess(role, key) {
  if (!role) return false;
  const allowedKeys = ROLE_PERMISSIONS[role] || [];
  return allowedKeys.includes(key);
}

export function moduleKeyForPath(pathname) {
  if (pathname.startsWith("/products")) return "products";
  if (pathname.startsWith("/team")) return "team"; // <-- Ku dar kan!
  // ...
  return null;
}