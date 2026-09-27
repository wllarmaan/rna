-- ============================================================================
-- MEDVORA — PAYMENTS: DIRECT CUSTOMER/SUPPLIER LINKS (Phase 1, add-on)
-- ============================================================================
-- payments hore waxay ku xirnayd oo keliya sale_id / purchase_order_id.
-- Taasi ma filnayn si loo dhiso "Customer/Supplier Statement" oo la isku
-- halayn karo (tusaale: lacag deyn ah oo aan hal sale gaar ah ku xirnayn).
-- Halkan waxaan ku darayaa laba column oo toos ah.
-- ============================================================================

alter table payments
  add column if not exists customer_id uuid references customers(id),
  add column if not exists supplier_id uuid references suppliers(id);

create index if not exists payments_customer_id_idx on payments (customer_id);
create index if not exists payments_supplier_id_idx on payments (supplier_id);

-- payments RLS ("payments: same org") horaad u shaqeynaysay organization_id,
-- taasi wax iska badalna kuma yeeshay columns-kan cusub — wax kale lama
-- baahna.