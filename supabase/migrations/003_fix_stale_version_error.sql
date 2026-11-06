-- 003_fix_stale_version_error.sql
-- E2E testing on 2026-11-06 proved that raising SQLSTATE 40001
-- (serialization_failure) from these RPCs hangs the PostgREST call:
-- a stale-version stock write timed out repeatedly (30s, 60s, 45s)
-- while fresh writes returned instantly. Fix:
--   * adjust_branch_stock: stale version now RETURNS {stale: true}
--     instead of raising; the Edge Function maps it to HTTP 409.
--   * dispatch_order_atomic / receive_order_atomic: wrong-state checks
--     now raise P0001 instead of 40001 (Edge Function maps any RPC
--     error there to HTTP 409 already).
-- Apply once in the Supabase SQL Editor. Idempotent (CREATE OR REPLACE).
-- Keeps the 2026-11-05 receptionist-dispatch approval in place.

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
    -- Return a sentinel instead of raising SQLSTATE 40001: a 40001 raise from
    -- this RPC hangs the PostgREST call (reproduced 2026-11-06: stale-version
    -- stock writes timed out repeatedly while fresh writes returned instantly).
    -- The Edge Function maps {stale: true} to HTTP 409.
    return jsonb_build_object('stale', true, 'message', 'Stock changed since this counter was opened. Refresh it and review the latest values before saving.');
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
  if not exists (select 1 from public.app_users u where u.id=p_actor_user_id and u.is_active and u.role in ('ADMIN','RECEPTIONIST')) then
    raise exception using errcode='42501', message='Only an active administrator or receptionist can dispatch orders.';
  end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found or v_order.status <> 'APPROVED' then
    -- P0001, not 40001: a 40001 raise hangs the PostgREST call (see adjust_branch_stock).
    raise exception using errcode='P0001', message='Order is not in APPROVED state.';
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
    -- P0001, not 40001: a 40001 raise hangs the PostgREST call (see adjust_branch_stock).
    raise exception using errcode='P0001', message='Order is not in DISPATCHED state.';
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

