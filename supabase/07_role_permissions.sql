-- ============================================================================
-- MEDVORA — ROLE-BASED ACCESS (RLS) (Phase 1, add-on)
-- ============================================================================
-- Ku shub KADIB 01–06.
--
-- Hore: qof kasta oo ku jira organization-ka wuxuu arki karay oo wax ka
-- bedeli karay dhammaan xogta. Hadda: mid kasta wuxuu helayaa kaliya waxa
-- doorkiisu ogol yahay — xitaa haddii uu API-ga si toos ah u wacdo.
--
-- Furaha (codes):  O=owner  M=manager  P=pharmacist  T=pharmacy technician
--                  C=cashier  A=accountant
-- (lab_technician, nurse, doctor, staff: weli ma laha xog-tables; waxay arkaan
--  kaliya products/categories/branches ee aan la xannibin.)
--
-- Jadwal kasta:      akhri (select) | ku dar (insert) | beddel (update) | tirtir (delete)
--   products         ALL org        | OMPT           | OMPT            | OMPT
--   categories       ALL org        | OMPT           | OMPT            | OMPT
--   branches         ALL org        | OM             | OM              | OM
--   customers        OMPTCA         | OMPTCA         | OMPTCA          | OM
--   suppliers        OMPA           | OMPA           | OMPA            | OM
--   purchase_orders  OMPA           | OMP            | OMP             | OM
--   purchase_items   OMPA           | OMP            | OMP             | OM
--   stock_batches    OMPTC          | OMPTC          | OM              | OM
--   stock_movements  OMPTC          | OMPTC          | OM              | OM
--   sales            OMPTCA         | OMPTC          | OM              | OM
--   sale_items       OMPTCA         | OMPTC          | OM              | OM
--   payments         OMPTCA         | OMPTCA         | OMA             | OMA
--   expenses         OMA            | OMA            | OMA             | OMA
--
-- Waa isla matrix-kii src/lib/permissions.js (UI-ga).
--
-- OGEYSIIS: RLS wuxuu xakameeyaa SAFAFKA (rows), ma aha COLUMNS. Cashier-ku
-- wuxuu arki karaa products.purchase_price (qiimaha iibsiga). Haddii aad rabto
-- inuu qarsoonaado, mustaqbalka waxaa la dhisi karaa view aan ku jirin column-kaas.
-- ============================================================================

create or replace function role_in(roles text[])
returns boolean
language sql stable
as $$
  select coalesce(auth_role(), '') = any(roles) or auth_role() = 'super_admin'
$$;

create or replace function org_ok(org uuid)
returns boolean
language sql stable
as $$
  select org = auth_organization_id() or auth_role() = 'super_admin'
$$;

-- 'OMPT' -> {organization_owner, manager, pharmacist, pharmacy_technician}
create or replace function _r(codes text)
returns text[]
language sql immutable
as $$
  select array_agg(case c
    when 'O' then 'organization_owner'
    when 'M' then 'manager'
    when 'P' then 'pharmacist'
    when 'T' then 'pharmacy_technician'
    when 'C' then 'cashier'
    when 'A' then 'accountant'
  end)
  from unnest(string_to_array(codes, null)) as c
$$;

-- Jadwallada organization_id leh
create or replace function _apply_role_policies(
  tbl text, read_roles text[], insert_roles text[], update_roles text[], delete_roles text[]
)
returns void
language plpgsql
as $$
declare
  pol record;
begin
  -- Tirtir dhammaan policies-kii hore (oo ay ku jiraan kuwa "same org" ee 02)
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = tbl loop
    execute format('drop policy %I on public.%I', pol.policyname, tbl);
  end loop;

  execute format('alter table public.%I enable row level security', tbl);

  execute format(
    'create policy %I on public.%I for select using (org_ok(organization_id) and (%L::text[] is null or role_in(%L::text[])))',
    tbl || ': select', tbl, read_roles, read_roles);

  execute format(
    'create policy %I on public.%I for insert with check (org_ok(organization_id) and role_in(%L::text[]))',
    tbl || ': insert', tbl, insert_roles);

  execute format(
    'create policy %I on public.%I for update using (org_ok(organization_id) and role_in(%L::text[])) with check (org_ok(organization_id) and role_in(%L::text[]))',
    tbl || ': update', tbl, update_roles, update_roles);

  execute format(
    'create policy %I on public.%I for delete using (org_ok(organization_id) and role_in(%L::text[]))',
    tbl || ': delete', tbl, delete_roles);
end;
$$;

-- Jadwallada ka dhaxla organization_id parent-kooda (purchase_items, sale_items)
create or replace function _apply_child_policies(
  tbl text, parent_tbl text, fk_col text,
  read_roles text[], insert_roles text[], update_roles text[], delete_roles text[]
)
returns void
language plpgsql
as $$
declare
  pol record;
  parent_ok text;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = tbl loop
    execute format('drop policy %I on public.%I', pol.policyname, tbl);
  end loop;

  execute format('alter table public.%I enable row level security', tbl);

  parent_ok := format(
    'exists (select 1 from public.%I p where p.id = %I.%I and org_ok(p.organization_id))',
    parent_tbl, tbl, fk_col);

  execute format('create policy %I on public.%I for select using (%s and role_in(%L::text[]))',
    tbl || ': select', tbl, parent_ok, read_roles);
  execute format('create policy %I on public.%I for insert with check (%s and role_in(%L::text[]))',
    tbl || ': insert', tbl, parent_ok, insert_roles);
  execute format('create policy %I on public.%I for update using (%s and role_in(%L::text[])) with check (%s and role_in(%L::text[]))',
    tbl || ': update', tbl, parent_ok, update_roles, parent_ok, update_roles);
  execute format('create policy %I on public.%I for delete using (%s and role_in(%L::text[]))',
    tbl || ': delete', tbl, parent_ok, delete_roles);
end;
$$;

--                              table              read           insert         update         delete
select _apply_role_policies('products',        null,          _r('OMPT'),    _r('OMPT'),    _r('OMPT'));
select _apply_role_policies('categories',      null,          _r('OMPT'),    _r('OMPT'),    _r('OMPT'));
select _apply_role_policies('branches',        null,          _r('OM'),      _r('OM'),      _r('OM'));
select _apply_role_policies('customers',       _r('OMPTCA'),  _r('OMPTCA'),  _r('OMPTCA'),  _r('OM'));
select _apply_role_policies('suppliers',       _r('OMPA'),    _r('OMPA'),    _r('OMPA'),    _r('OM'));
select _apply_role_policies('purchase_orders', _r('OMPA'),    _r('OMP'),     _r('OMP'),     _r('OM'));
select _apply_role_policies('stock_batches',   _r('OMPTC'),   _r('OMPTC'),   _r('OM'),      _r('OM'));
select _apply_role_policies('stock_movements', _r('OMPTC'),   _r('OMPTC'),   _r('OM'),      _r('OM'));
select _apply_role_policies('sales',           _r('OMPTCA'),  _r('OMPTC'),   _r('OM'),      _r('OM'));
select _apply_role_policies('payments',        _r('OMPTCA'),  _r('OMPTCA'),  _r('OMA'),     _r('OMA'));
select _apply_role_policies('expenses',        _r('OMA'),     _r('OMA'),     _r('OMA'),     _r('OMA'));

--                              child table   parent            fk               read          insert       update       delete
select _apply_child_policies('purchase_items', 'purchase_orders', 'purchase_order_id', _r('OMPA'),   _r('OMP'),   _r('OMP'),   _r('OM'));
select _apply_child_policies('sale_items',     'sales',           'sale_id',           _r('OMPTCA'), _r('OMPTC'), _r('OM'),    _r('OM'));

-- Nadiifin: functions-ka dhismaha ah looma baahna mar dambe
drop function if exists _apply_role_policies(text, text[], text[], text[], text[]);
drop function if exists _apply_child_policies(text, text, text, text[], text[], text[], text[]);
drop function if exists _r(text);

-- Hubi natiijada: waa inaad aragtaa 4 policy (select/insert/update/delete) jadwal kasta
-- select tablename, count(*) from pg_policies where schemaname = 'public' group by 1 order by 1;