-- ============================================================================
-- MEDVORA — USERS & ROLES / TEAM (Phase 1, add-on)
-- ============================================================================
-- Ku shub KADIB 01–05.
--
-- Habka: owner/manager wuxuu sameeyaa INVITATION (email + role + branch).
-- Marka qofkaas isdiiwaan geliyo (Sign up) email-kaas, ama uu soo galo
-- Onboarding, si otomaatig ah ayuu ugu biiraa organization-ka.
-- Isbeddellada role/organization waxaa sameeya function-yo SECURITY DEFINER
-- oo hubiya xuquuqda — client-ku si toos ah ma beddeli karo.
-- ============================================================================

-- 1) profiles: ku dar email si liiska shaqaalaha loo muujiyo
alter table profiles add column if not exists email text;

update profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is null;

-- 2) invitations
create table if not exists invitations (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  role text not null check (
    role in ('manager','pharmacist','pharmacy_technician','cashier',
             'lab_technician','nurse','doctor','accountant','staff')
  ),
  branch_id uuid references branches(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','accepted')),
  invited_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create unique index if not exists invitations_pending_email_idx
  on invitations (organization_id, lower(email)) where status = 'pending';

alter table invitations enable row level security;

create policy "invitations: read (owner/manager)" on invitations
  for select using (
    organization_id = auth_organization_id()
    and auth_role() in ('organization_owner','manager')
  );

-- manager ma casuumi karo manager kale — kaliya owner
create policy "invitations: insert (owner/manager)" on invitations
  for insert with check (
    organization_id = auth_organization_id()
    and auth_role() in ('organization_owner','manager')
    and (auth_role() = 'organization_owner' or role <> 'manager')
  );

create policy "invitations: delete (owner/manager)" on invitations
  for delete using (
    organization_id = auth_organization_id()
    and auth_role() in ('organization_owner','manager')
  );

-- 3) Signup trigger: haddii invitation jirto, si toos ah ugu xir organization-ka
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  inv invitations%rowtype;
begin
  select * into inv
  from invitations
  where lower(email) = lower(new.email) and status = 'pending'
  order by created_at desc
  limit 1;

  if found then
    insert into profiles (id, full_name, email, role, organization_id, branch_id)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'full_name', new.email),
      new.email,
      inv.role,
      inv.organization_id,
      inv.branch_id
    );
    update invitations set status = 'accepted' where id = inv.id;
  else
    insert into profiles (id, full_name, email, role)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'full_name', new.email),
      new.email,
      'staff'
    );
  end if;

  return new;
end;
$$;

-- 4) Qof horeba u diiwaan gashay, oo la casuumay kadib
create or replace function claim_invitation()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  inv invitations%rowtype;
  caller_email text;
  existing_org uuid;
begin
  select organization_id into existing_org from profiles where id = auth.uid();
  if existing_org is not null then
    return false;
  end if;

  caller_email := lower(auth.jwt() ->> 'email');

  select * into inv
  from invitations
  where lower(email) = caller_email and status = 'pending'
  order by created_at desc
  limit 1;

  if not found then
    return false;
  end if;

  perform set_config('app.bypass_privilege_check', 'true', true);

  update profiles
  set organization_id = inv.organization_id,
      role = inv.role,
      branch_id = inv.branch_id
  where id = auth.uid();

  update invitations set status = 'accepted' where id = inv.id;
  return true;
end;
$$;

-- 5) Beddel role-ka xubin
create or replace function update_member_role(member_id uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_org uuid := auth_organization_id();
  caller_role text := auth_role();
  target profiles%rowtype;
begin
  if caller_role not in ('organization_owner','manager') then
    raise exception 'Ma haysatid ogolaansho aad ku beddesho role';
  end if;

  if new_role not in ('manager','pharmacist','pharmacy_technician','cashier',
                      'lab_technician','nurse','doctor','accountant','staff') then
    raise exception 'Role aan ansax ahayn';
  end if;

  select * into target from profiles
  where id = member_id and organization_id = caller_org;

  if not found then
    raise exception 'Xubinta lama helin';
  end if;

  if target.role = 'organization_owner' then
    raise exception 'Role-ka owner-ka lama beddeli karo';
  end if;

  if caller_role = 'manager' and (target.role = 'manager' or new_role = 'manager') then
    raise exception 'Kaliya owner-ka ayaa maamuli kara managers';
  end if;

  perform set_config('app.bypass_privilege_check', 'true', true);
  update profiles set role = new_role where id = member_id;
end;
$$;

-- 6) Ka saar xubin organization-ka
create or replace function remove_member(member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_org uuid := auth_organization_id();
  caller_role text := auth_role();
  target profiles%rowtype;
begin
  if caller_role not in ('organization_owner','manager') then
    raise exception 'Ma haysatid ogolaansho aad ku saarto xubin';
  end if;

  if member_id = auth.uid() then
    raise exception 'Naftaada ma saari kartid';
  end if;

  select * into target from profiles
  where id = member_id and organization_id = caller_org;

  if not found then
    raise exception 'Xubinta lama helin';
  end if;

  if target.role = 'organization_owner' then
    raise exception 'Owner-ka lama saari karo';
  end if;

  if caller_role = 'manager' and target.role = 'manager' then
    raise exception 'Kaliya owner-ka ayaa saari kara manager';
  end if;

  perform set_config('app.bypass_privilege_check', 'true', true);
  update profiles
  set organization_id = null, branch_id = null, role = 'staff'
  where id = member_id;
end;
$$;

grant execute on function claim_invitation() to authenticated;
grant execute on function update_member_role(uuid, text) to authenticated;
grant execute on function remove_member(uuid) to authenticated;