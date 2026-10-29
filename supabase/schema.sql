-- EyeKart live inventory schema.
-- Apply only to the new EyeKart Supabase project after verifying the organization/project.
-- This initializes only the screenshot-verified branch starting balances; no demo orders/movements are imported.

create table if not exists public.app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  role text not null check (role in ('ADMIN','RECEPTIONIST','BRANCH_USER')),
  assigned_branch_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.branches (
  id text primary key,
  srn integer not null unique,
  name text not null,
  original_name text not null,
  has_name_anomaly boolean not null default false,
  anomaly_reason text,
  is_verified boolean not null default true,
  remarks text not null default '',
  min_threshold integer not null default 50 check (min_threshold >= 0),
  is_active boolean not null default true,
  male_on_hand integer not null default 0 check (male_on_hand >= 0),
  female_on_hand integer not null default 0 check (female_on_hand >= 0),
  kids_on_hand integer not null default 0 check (kids_on_hand >= 0),
  total_on_hand integer generated always as (male_on_hand + female_on_hand + kids_on_hand) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  branch_id text not null references public.branches(id),
  branch_name text not null,
  movement_type text not null,
  category text not null check (category in ('male','female','kids','all')),
  previous_on_hand integer not null,
  quantity_changed integer not null,
  resulting_on_hand integer not null check (resulting_on_hand >= 0),
  previous_category_on_hand jsonb not null,
  resulting_category_on_hand jsonb not null,
  actor_user_id uuid not null references public.app_users(id),
  actor_name text not null,
  reason text not null,
  timestamp timestamptz not null default now()
);
create index if not exists stock_movements_branch_time_idx
  on public.stock_movements(branch_id, timestamp desc);

create table if not exists public.orders (
  id text primary key,
  order_number text not null unique,
  branch_id text not null references public.branches(id),
  status text not null check (status in ('DRAFT','SUBMITTED','APPROVED','DISPATCHED','RECEIVED','REJECTED','CANCELLED')),
  requested_items jsonb not null,
  approved_items jsonb,
  dispatched_items jsonb,
  received_items jsonb,
  requested_by text not null,
  requested_by_role text not null,
  requested_by_user_id uuid not null references public.app_users(id),
  approved_by text,
  dispatched_by text,
  received_by text,
  rejected_by text,
  rejection_reason text,
  cancellation_reason text,
  courier_ref text,
  remarks text,
  timeline jsonb not null default '[]'::jsonb,
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_branch_updated_idx on public.orders(branch_id, updated_at desc);

create table if not exists public.stock_alerts (
  id text primary key,
  branch_id text not null unique references public.branches(id),
  branch_name text not null,
  current_stock integer not null,
  min_threshold integer not null,
  shortage_amount integer not null,
  male_balance integer not null,
  female_balance integer not null,
  kids_balance integer not null,
  severity text not null check (severity in ('CRITICAL_ZERO','LOW_STOCK')),
  detected_at timestamptz not null default now(),
  acknowledged boolean not null default false,
  acknowledged_by text,
  acknowledged_at timestamptz,
  recommended_action text not null
);

create table if not exists public.warehouse_inventory (
  id text primary key default 'central' check (id = 'central'),
  male_on_hand integer not null default 0 check (male_on_hand >= 0),
  female_on_hand integer not null default 0 check (female_on_hand >= 0),
  kids_on_hand integer not null default 0 check (kids_on_hand >= 0),
  last_restocked_at timestamptz,
  updated_at timestamptz not null default now()
);
-- Deliberately do not seed warehouse_inventory: the source screenshot contains branch stock only.

-- Seed the 35 screenshot rows idempotently. Current JSON test movements/orders are deliberately excluded.
insert into public.branches
  (id, srn, name, original_name, has_name_anomaly, anomaly_reason, is_verified, remarks, min_threshold,
   male_on_hand, female_on_hand, kids_on_hand, is_active)
values
  ('br-001', 1, 'Bliss BusiaB3:D27', 'Bliss BusiaB3:D27', true, 'Spreadsheet cell contains accidental range/formula text ''B3:D27''', false, 'MIX Metals &Plast', 50, 40, 50, 10, false),
  ('br-002', 2, 'Bliss Diani', 'Bliss Diani', false, NULL, true, 'MIX Metals &Plast', 50, 0, 0, 0, true),
  ('br-004', 4, 'Bliss Eldama Ravine', 'Bliss Eldama Ravine', false, NULL, true, 'MIX Metals &Plast', 50, 40, 50, 10, false),
  ('br-005', 5, 'Bliss Eldoret Zion mall', 'Bliss Eldoret Zion mall', false, NULL, true, 'MIX Metals &Plast', 50, 60, 70, 20, false),
  ('br-006', 6, 'Bliss Embakasi', 'Bliss Embakasi', false, NULL, true, 'MIX Metals &Plast', 50, 40, 50, 10, false),
  ('br-007', 7, 'Bliss Embu', 'Bliss Embu', false, NULL, true, 'MIX Metals &Plast', 50, 40, 50, 10, false),
  ('br-008', 8, 'Bliss Githurai', 'Bliss Githurai', false, NULL, true, 'MIX Metals &Plast', 50, 40, 50, 10, false),
  ('br-009', 9, 'Bliss Homabay', 'Bliss Homabay', false, NULL, true, 'MIX Metals &Plast', 50, 40, 50, 10, false),
  ('br-010', 10, 'Bliss Iten', 'Bliss Iten', false, NULL, true, 'MIX Metals &Plast', 50, 0, 0, 0, true),
  ('br-011', 11, 'Bliss Kakamega', 'Bliss Kakamega', false, NULL, true, 'MIX Metals &Plast', 50, 60, 70, 20, false),
  ('br-012', 12, 'Bliss Kapenguria', 'Bliss Kapenguria', false, NULL, true, 'MIX Metals &Plast', 50, 60, 70, 20, false),
  ('br-013', 13, 'Bliss Kapsabet', 'Bliss Kapsabet', false, NULL, true, 'MIX Metals &Plast', 50, 40, 50, 10, false),
  ('br-014', 14, 'Bliss Kericho', 'Bliss Kericho', false, NULL, true, 'MIX Metals &Plast', 50, 40, 50, 10, false),
  ('br-015', 15, 'Bliss Kimilili', 'Bliss Kimilili', false, NULL, true, 'MIX Metals &Plast', 50, 60, 70, 20, false),
  ('br-016', 16, 'Bliss Kisii 1', 'Bliss Kisii 1', false, NULL, true, 'MIX Metals &Plast', 50, 60, 70, 20, false),
  ('br-017', 17, 'Bliss Kisumu Mega Plaza', 'Bliss Kisumu Mega Plaza', false, NULL, true, 'MIX Metals &Plast', 50, 60, 70, 20, false),
  ('br-018', 18, 'Bliss Kitale', 'Bliss Kitale', false, NULL, true, 'MIX Metals &Plast', 50, 60, 70, 20, false),
  ('br-019', 19, 'Bliss Langata', 'Bliss Langata', false, NULL, true, 'MIX Metals &Plast', 50, 40, 50, 10, false),
  ('br-020', 20, 'Bliss Machakos', 'Bliss Machakos', false, NULL, true, 'MIX Metals &Plast', 50, 60, 70, 20, false),
  ('br-021', 21, 'Bliss Maralal', 'Bliss Maralal', false, NULL, true, 'MIX Metals &Plast', 50, 40, 50, 10, false),
  ('br-022', 22, 'Bliss Mbale', 'Bliss Mbale', false, NULL, true, 'MIX Metals &Plast', 50, 40, 50, 10, false),
  ('br-023', 23, 'Bliss Moi Avenue', 'Bliss Moi Avenue', false, NULL, true, 'MIX Metals &Plast', 50, 80, 100, 20, false),
  ('br-024', 24, 'Bliss Mtwapa', 'Bliss Mtwapa', false, NULL, true, 'MIX Metals &Plast', 50, 40, 50, 10, false),
  ('br-025', 25, 'Bliss Muranga', 'Bliss Muranga', false, NULL, true, 'MIX Metals &Plast', 50, 80, 100, 20, false),
  ('br-026', 26, 'Bliss Naivasha', 'Bliss Naivasha', false, NULL, true, 'MIX Metals &Plast', 50, 40, 50, 10, false),
  ('br-027', 27, 'Bliss Nanyuki', 'Bliss Nanyuki', false, NULL, true, 'MIX Metals &Plast', 50, 40, 50, 10, false),
  ('br-028', 28, 'Bliss Ol Kalou', 'Bliss Ol Kalou', false, NULL, true, 'MIX Metals &Plast', 50, 0, 0, 0, true),
  ('br-029', 29, 'Bliss Rongai', 'Bliss Rongai', false, NULL, true, 'MIX Metals &Plast', 50, 0, 0, 0, true),
  ('br-030', 30, 'Bliss Siaya', 'Bliss Siaya', false, NULL, true, 'MIX Metals &Plast', 50, 40, 50, 0, false),
  ('br-031', 31, 'Bliss Thika', 'Bliss Thika', false, NULL, true, 'MIX Metals &Plast', 50, 40, 50, 10, false),
  ('br-032', 32, 'Bliss Umoja', 'Bliss Umoja', false, NULL, true, 'MIX Metals &Plast', 50, 40, 50, 10, false),
  ('br-033', 33, 'Bliss Wote', 'Bliss Wote', false, NULL, true, 'MIX Metals &Plast', 50, 60, 70, 20, false),
  ('br-034', 34, 'Clinix Haille Selasie', 'Clinix Haille Selasie', false, NULL, true, 'MIX Metals &Plast', 50, 40, 50, 10, false),
  ('br-036', 36, 'Medicross Nakuru', 'Medicross Nakuru', false, NULL, true, 'MIX Metals &Plast', 50, 40, 50, 10, false),
  ('br-037', 37, 'Medicross Narok', 'Medicross Narok', false, NULL, true, 'MIX Metals &Plast', 50, 40, 50, 10, false)
on conflict (id) do nothing;

-- Build alert snapshots only for source rows with stock below the default threshold.
insert into public.stock_alerts
  (id, branch_id, branch_name, current_stock, min_threshold, shortage_amount,
   male_balance, female_balance, kids_balance, severity, recommended_action)
select
  'alt-' || b.id, b.id, b.name, b.total_on_hand, b.min_threshold, b.min_threshold - b.total_on_hand,
  b.male_on_hand, b.female_on_hand, b.kids_on_hand,
  case when b.total_on_hand = 0 then 'CRITICAL_ZERO' else 'LOW_STOCK' end,
  'Snapshot baseline alert. Verify physical stock before operational action.'
from public.branches b
where b.is_active and b.total_on_hand < b.min_threshold
on conflict (branch_id) do nothing;

-- Atomic, audited stock save: all quantities and their audit rows commit in one transaction.
create or replace function public.adjust_branch_stock(
  p_branch_id text,
  p_male integer,
  p_female integer,
  p_kids integer,
  p_note text,
  p_actor_user_id uuid,
  p_actor_name text,
  p_expected_updated_at timestamptz default null
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_branch public.branches%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_total integer;
begin
  if p_male is null or p_female is null or p_kids is null
     or p_male < 0 or p_female < 0 or p_kids < 0
     or p_male > 1000000 or p_female > 1000000 or p_kids > 1000000 then
    raise exception using errcode = '22023', message = 'Quantities must be whole numbers between 0 and 1,000,000.';
  end if;
  if p_note is null or length(trim(p_note)) < 3 then
    raise exception using errcode = '22023', message = 'Please provide a reason of at least 3 characters for the audit trail.';
  end if;
  if not exists (select 1 from public.app_users u where u.id = p_actor_user_id and u.is_active) then
    raise exception using errcode = '42501', message = 'The authenticated EyeKart user is not active.';
  end if;

  select * into v_branch from public.branches where id = p_branch_id and is_active for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Active branch not found.';
  end if;
  if p_expected_updated_at is not null and v_branch.updated_at <> p_expected_updated_at then
    raise exception using errcode = '40001', message = 'Stock changed since this counter was opened. Refresh it and review the latest values before saving.';
  end if;

  v_before := jsonb_build_object('male',v_branch.male_on_hand,'female',v_branch.female_on_hand,'kids',v_branch.kids_on_hand);
  v_total := p_male + p_female + p_kids;

  update public.branches
  set male_on_hand = p_male, female_on_hand = p_female, kids_on_hand = p_kids, updated_at = now()
  where id = p_branch_id
  returning * into v_branch;

  v_after := jsonb_build_object('male',v_branch.male_on_hand,'female',v_branch.female_on_hand,'kids',v_branch.kids_on_hand);

  if v_before->>'male' <> v_after->>'male' then
    insert into public.stock_movements(branch_id,branch_name,movement_type,category,previous_on_hand,quantity_changed,resulting_on_hand,previous_category_on_hand,resulting_category_on_hand,actor_user_id,actor_name,reason)
    values(p_branch_id,v_branch.name,'MANUAL_ADJUSTMENT','male',(v_before->>'male')::int,p_male-(v_before->>'male')::int,p_male,v_before,v_after,p_actor_user_id,p_actor_name,trim(p_note));
  end if;
  if v_before->>'female' <> v_after->>'female' then
    insert into public.stock_movements(branch_id,branch_name,movement_type,category,previous_on_hand,quantity_changed,resulting_on_hand,previous_category_on_hand,resulting_category_on_hand,actor_user_id,actor_name,reason)
    values(p_branch_id,v_branch.name,'MANUAL_ADJUSTMENT','female',(v_before->>'female')::int,p_female-(v_before->>'female')::int,p_female,v_before,v_after,p_actor_user_id,p_actor_name,trim(p_note));
  end if;
  if v_before->>'kids' <> v_after->>'kids' then
    insert into public.stock_movements(branch_id,branch_name,movement_type,category,previous_on_hand,quantity_changed,resulting_on_hand,previous_category_on_hand,resulting_category_on_hand,actor_user_id,actor_name,reason)
    values(p_branch_id,v_branch.name,'MANUAL_ADJUSTMENT','kids',(v_before->>'kids')::int,p_kids-(v_before->>'kids')::int,p_kids,v_before,v_after,p_actor_user_id,p_actor_name,trim(p_note));
  end if;

  if v_branch.total_on_hand < v_branch.min_threshold then
    insert into public.stock_alerts(id,branch_id,branch_name,current_stock,min_threshold,shortage_amount,male_balance,female_balance,kids_balance,severity,acknowledged,recommended_action)
    values('alt-'||v_branch.id,v_branch.id,v_branch.name,v_branch.total_on_hand,v_branch.min_threshold,v_branch.min_threshold-v_branch.total_on_hand,v_branch.male_on_hand,v_branch.female_on_hand,v_branch.kids_on_hand,case when v_branch.total_on_hand=0 then 'CRITICAL_ZERO' else 'LOW_STOCK' end,false,'Re-check physical stock and arrange replenishment if required.')
    on conflict (branch_id) do update set
      branch_name=excluded.branch_name,current_stock=excluded.current_stock,min_threshold=excluded.min_threshold,
      shortage_amount=excluded.shortage_amount,male_balance=excluded.male_balance,female_balance=excluded.female_balance,
      kids_balance=excluded.kids_balance,severity=excluded.severity,detected_at=now(),acknowledged=false,
      acknowledged_by=null,acknowledged_at=null,recommended_action=excluded.recommended_action;
  else
    delete from public.stock_alerts where branch_id=v_branch.id;
  end if;

  return to_jsonb(v_branch);
end;
$$;

-- Only the trusted Edge Function service client may call this privileged, audited RPC.
revoke all on function public.adjust_branch_stock(text,integer,integer,integer,text,uuid,text,timestamptz) from public, anon, authenticated;
grant execute on function public.adjust_branch_stock(text,integer,integer,integer,text,uuid,text,timestamptz) to service_role;

-- Keep every table inaccessible through the public Data API. The Edge Function uses service role
-- only after verifying a signed Supabase Auth user and checking their app_users role.
alter table public.app_users enable row level security;
alter table public.branches enable row level security;
alter table public.stock_movements enable row level security;
alter table public.orders enable row level security;
alter table public.stock_alerts enable row level security;
alter table public.warehouse_inventory enable row level security;

revoke all on table public.app_users, public.branches, public.stock_movements, public.orders,
  public.stock_alerts, public.warehouse_inventory from anon, authenticated;
grant all on table public.app_users, public.branches, public.stock_movements, public.orders,
  public.stock_alerts, public.warehouse_inventory to service_role;

-- Warehouse history is separate from retail branch stock history.
create table if not exists public.warehouse_movements (
  id uuid primary key default gen_random_uuid(),
  warehouse_id text not null references public.warehouse_inventory(id),
  movement_type text not null,
  previous_category_on_hand jsonb not null,
  resulting_category_on_hand jsonb not null,
  male_changed integer not null,
  female_changed integer not null,
  kids_changed integer not null,
  actor_user_id uuid not null references public.app_users(id),
  actor_name text not null,
  reason text not null,
  timestamp timestamptz not null default now()
);
create index if not exists warehouse_movements_time_idx on public.warehouse_movements(timestamp desc);
alter table public.warehouse_movements enable row level security;
revoke all on table public.warehouse_movements from anon, authenticated;
grant all on table public.warehouse_movements to service_role;

create or replace function public.adjust_warehouse_stock(
  p_male integer,
  p_female integer,
  p_kids integer,
  p_note text,
  p_actor_user_id uuid,
  p_actor_name text
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_old public.warehouse_inventory%rowtype;
  v_new public.warehouse_inventory%rowtype;
  v_before jsonb;
  v_after jsonb;
begin
  if p_male is null or p_female is null or p_kids is null
     or p_male < 0 or p_female < 0 or p_kids < 0
     or p_male > 1000000 or p_female > 1000000 or p_kids > 1000000 then
    raise exception using errcode = '22023', message = 'Quantities must be whole numbers between 0 and 1,000,000.';
  end if;
  if p_note is null or length(trim(p_note)) < 3 then
    raise exception using errcode = '22023', message = 'Please provide a reason of at least 3 characters for the audit trail.';
  end if;
  if not exists (select 1 from public.app_users u where u.id = p_actor_user_id and u.is_active and u.role = 'ADMIN') then
    raise exception using errcode = '42501', message = 'Only an active administrator can update warehouse stock.';
  end if;

  select * into v_old from public.warehouse_inventory where id='central' for update;
  if not found then
    v_before := jsonb_build_object('male',0,'female',0,'kids',0);
    insert into public.warehouse_inventory(id,male_on_hand,female_on_hand,kids_on_hand,last_restocked_at,updated_at)
    values('central',p_male,p_female,p_kids,now(),now())
    returning * into v_new;
    v_old.male_on_hand := 0; v_old.female_on_hand := 0; v_old.kids_on_hand := 0;
  else
    v_before := jsonb_build_object('male',v_old.male_on_hand,'female',v_old.female_on_hand,'kids',v_old.kids_on_hand);
    update public.warehouse_inventory
      set male_on_hand=p_male,female_on_hand=p_female,kids_on_hand=p_kids,last_restocked_at=now(),updated_at=now()
      where id='central'
      returning * into v_new;
  end if;
  v_after := jsonb_build_object('male',v_new.male_on_hand,'female',v_new.female_on_hand,'kids',v_new.kids_on_hand);

  if v_before <> v_after then
    insert into public.warehouse_movements(warehouse_id,movement_type,previous_category_on_hand,resulting_category_on_hand,male_changed,female_changed,kids_changed,actor_user_id,actor_name,reason)
    values('central','MANUAL_ADJUSTMENT',v_before,v_after,p_male-(v_before->>'male')::int,p_female-(v_before->>'female')::int,p_kids-(v_before->>'kids')::int,p_actor_user_id,p_actor_name,trim(p_note));
  end if;
  return to_jsonb(v_new);
end;
$$;
revoke all on function public.adjust_warehouse_stock(integer,integer,integer,text,uuid,text) from public, anon, authenticated;
grant execute on function public.adjust_warehouse_stock(integer,integer,integer,text,uuid,text) to service_role;

create or replace function public.dispatch_order_atomic(
  p_order_id text,
  p_male integer,
  p_female integer,
  p_kids integer,
  p_actor_user_id uuid,
  p_actor_name text,
  p_courier_ref text
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_warehouse public.warehouse_inventory%rowtype;
  v_m integer; v_f integer; v_k integer;
  v_approved jsonb;
  v_timeline jsonb;
begin
  if not exists (select 1 from public.app_users u where u.id=p_actor_user_id and u.is_active and u.role='ADMIN') then
    raise exception using errcode='42501', message='Only an active administrator can dispatch orders.';
  end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found or v_order.status <> 'APPROVED' then
    raise exception using errcode='40001', message='Order is not in APPROVED state.';
  end if;
  select * into v_warehouse from public.warehouse_inventory where id='central' for update;
  if not found then
    raise exception using errcode='P0002', message='Warehouse stock is not initialized.';
  end if;
  v_m := p_male; v_f := p_female; v_k := p_kids;
  if v_m < 0 or v_f < 0 or v_k < 0 then
    raise exception using errcode='22023', message='Dispatch quantities cannot be negative.';
  end if;
  v_approved := coalesce(v_order.approved_items,v_order.requested_items);
  if v_m > (v_approved->>'male')::int or v_f > (v_approved->>'female')::int or v_k > (v_approved->>'kids')::int then
    raise exception using errcode='22023', message='Dispatch quantities exceed approved quantities.';
  end if;
  if v_m > v_warehouse.male_on_hand or v_f > v_warehouse.female_on_hand or v_k > v_warehouse.kids_on_hand then
    raise exception using errcode='23514', message='Insufficient stock in Central Warehouse.';
  end if;
  update public.warehouse_inventory
    set male_on_hand=male_on_hand-v_m,female_on_hand=female_on_hand-v_f,kids_on_hand=kids_on_hand-v_k,updated_at=now()
    where id='central' returning * into v_warehouse;
  insert into public.warehouse_movements(warehouse_id,movement_type,previous_category_on_hand,resulting_category_on_hand,male_changed,female_changed,kids_changed,actor_user_id,actor_name,reason)
  values('central','DISPATCH_FROM_WAREHOUSE',
    jsonb_build_object('male',v_warehouse.male_on_hand+v_m,'female',v_warehouse.female_on_hand+v_f,'kids',v_warehouse.kids_on_hand+v_k),
    jsonb_build_object('male',v_warehouse.male_on_hand,'female',v_warehouse.female_on_hand,'kids',v_warehouse.kids_on_hand),
    -v_m,-v_f,-v_k,p_actor_user_id,p_actor_name,'Dispatch for order '||v_order.order_number);
  v_timeline := coalesce(v_order.timeline,'[]'::jsonb) || jsonb_build_array(jsonb_build_object('status','DISPATCHED','timestamp',now(),'actor',p_actor_name,'notes','Dispatched from central warehouse.'));
  update public.orders set status='DISPATCHED',
    dispatched_items=jsonb_build_object('male',v_m,'female',v_f,'kids',v_k,'total',v_m+v_f+v_k),
    dispatched_by=p_actor_name,courier_ref=nullif(trim(coalesce(p_courier_ref,'')),''),timeline=v_timeline,updated_at=now()
    where id=p_order_id returning * into v_order;
  return to_jsonb(v_order);
end;
$$;
revoke all on function public.dispatch_order_atomic(text,integer,integer,integer,uuid,text,text) from public, anon, authenticated;
grant execute on function public.dispatch_order_atomic(text,integer,integer,integer,uuid,text,text) to service_role;

create or replace function public.receive_order_atomic(
  p_order_id text,
  p_male integer,
  p_female integer,
  p_kids integer,
  p_actor_user_id uuid,
  p_actor_name text
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_branch public.branches%rowtype;
  v_before jsonb; v_after jsonb; v_dispatched jsonb; v_timeline jsonb;
  v_m integer; v_f integer; v_k integer; v_total integer;
begin
  if not exists (select 1 from public.app_users u where u.id=p_actor_user_id and u.is_active) then
    raise exception using errcode='42501', message='Authenticated EyeKart profile is not active.';
  end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found or v_order.status <> 'DISPATCHED' then
    raise exception using errcode='40001', message='Order is not in DISPATCHED state.';
  end if;
  select * into v_branch from public.branches where id=v_order.branch_id and is_active for update;
  if not found then raise exception using errcode='P0002', message='Branch not found.'; end if;

  v_m := p_male; v_f := p_female; v_k := p_kids;
  if v_m < 0 or v_f < 0 or v_k < 0 then
    raise exception using errcode='22023', message='Received quantities cannot be negative.';
  end if;
  v_dispatched := coalesce(v_order.dispatched_items,v_order.approved_items,v_order.requested_items);
  if v_m > (v_dispatched->>'male')::int or v_f > (v_dispatched->>'female')::int or v_k > (v_dispatched->>'kids')::int then
    raise exception using errcode='22023', message='Received quantities exceed dispatched quantities.';
  end if;

  v_before := jsonb_build_object('male',v_branch.male_on_hand,'female',v_branch.female_on_hand,'kids',v_branch.kids_on_hand);
  update public.branches set male_on_hand=male_on_hand+v_m,female_on_hand=female_on_hand+v_f,kids_on_hand=kids_on_hand+v_k,updated_at=now()
  where id=v_branch.id returning * into v_branch;
  v_after := jsonb_build_object('male',v_branch.male_on_hand,'female',v_branch.female_on_hand,'kids',v_branch.kids_on_hand);

  if v_m > 0 then
    insert into public.stock_movements(branch_id,branch_name,order_id,order_number,movement_type,category,previous_on_hand,quantity_changed,resulting_on_hand,previous_category_on_hand,resulting_category_on_hand,actor_user_id,actor_name,reason)
    values(v_branch.id,v_branch.name,v_order.id,v_order.order_number,'RECEIPT_AT_BRANCH','male',(v_before->>'male')::int,v_m,v_branch.male_on_hand,v_before,v_after,p_actor_user_id,p_actor_name,'Goods received for order '||v_order.order_number);
  end if;
  if v_f > 0 then
    insert into public.stock_movements(branch_id,branch_name,order_id,order_number,movement_type,category,previous_on_hand,quantity_changed,resulting_on_hand,previous_category_on_hand,resulting_category_on_hand,actor_user_id,actor_name,reason)
    values(v_branch.id,v_branch.name,v_order.id,v_order.order_number,'RECEIPT_AT_BRANCH','female',(v_before->>'female')::int,v_f,v_branch.female_on_hand,v_before,v_after,p_actor_user_id,p_actor_name,'Goods received for order '||v_order.order_number);
  end if;
  if v_k > 0 then
    insert into public.stock_movements(branch_id,branch_name,order_id,order_number,movement_type,category,previous_on_hand,quantity_changed,resulting_on_hand,previous_category_on_hand,resulting_category_on_hand,actor_user_id,actor_name,reason)
    values(v_branch.id,v_branch.name,v_order.id,v_order.order_number,'RECEIPT_AT_BRANCH','kids',(v_before->>'kids')::int,v_k,v_branch.kids_on_hand,v_before,v_after,p_actor_user_id,p_actor_name,'Goods received for order '||v_order.order_number);
  end if;

  if v_branch.total_on_hand < v_branch.min_threshold then
    insert into public.stock_alerts(id,branch_id,branch_name,current_stock,min_threshold,shortage_amount,male_balance,female_balance,kids_balance,severity,acknowledged,recommended_action)
    values('alt-'||v_branch.id,v_branch.id,v_branch.name,v_branch.total_on_hand,v_branch.min_threshold,v_branch.min_threshold-v_branch.total_on_hand,v_branch.male_on_hand,v_branch.female_on_hand,v_branch.kids_on_hand,case when v_branch.total_on_hand=0 then 'CRITICAL_ZERO' else 'LOW_STOCK' end,false,'Re-check physical stock and arrange replenishment if required.')
    on conflict(branch_id) do update set current_stock=excluded.current_stock,min_threshold=excluded.min_threshold,shortage_amount=excluded.shortage_amount,male_balance=excluded.male_balance,female_balance=excluded.female_balance,kids_balance=excluded.kids_balance,severity=excluded.severity,detected_at=now(),acknowledged=false,acknowledged_by=null,acknowledged_at=null;
  else
    delete from public.stock_alerts where branch_id=v_branch.id;
  end if;

  v_timeline := coalesce(v_order.timeline,'[]'::jsonb) || jsonb_build_array(jsonb_build_object('status','RECEIVED','timestamp',now(),'actor',p_actor_name,'notes','Branch receipt confirmed.'));
  update public.orders set status='RECEIVED',
    received_items=jsonb_build_object('male',v_m,'female',v_f,'kids',v_k,'total',v_m+v_f+v_k),
    received_by=p_actor_name,timeline=v_timeline,updated_at=now()
    where id=p_order_id returning * into v_order;
  return to_jsonb(v_order);
end;
$$;
revoke all on function public.receive_order_atomic(text,integer,integer,integer,uuid,text) from public, anon, authenticated;
grant execute on function public.receive_order_atomic(text,integer,integer,integer,uuid,text) to service_role;

-- Add the new audit columns expected by order receipts to stock_movements.
alter table public.stock_movements add column if not exists order_id text;
alter table public.stock_movements add column if not exists order_number text;

-- Lock the new helper functions to the trusted backend role.
