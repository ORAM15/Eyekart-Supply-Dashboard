-- Open sign-up provisioning (applied after the base schema.sql).
-- Any team member can create their own Auth account in the app; no per-email
-- pre-provisioning is needed. The first account ever provisioned becomes ADMIN
-- (so the warehouse count and admin-only actions always have an owner);
-- every account after that becomes RECEPTIONIST.
-- The advisory lock serialises concurrent first sign-ups so exactly one
-- account can take the ADMIN bootstrap slot.
create or replace function public.provision_app_user(
  p_id uuid,
  p_email text,
  p_display_name text
) returns public.app_users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.app_users%rowtype;
  v_role text;
  v_name text;
begin
  if p_id is null or p_email is null or length(trim(p_email)) = 0 then
    raise exception using errcode = '22023', message = 'A valid user id and email are required to provision an EyeKart profile.';
  end if;

  perform pg_advisory_xact_lock(727271);

  select * into v_existing from public.app_users where id = p_id;
  if found then
    return v_existing;
  end if;

  v_role := case when exists (select 1 from public.app_users) then 'RECEPTIONIST' else 'ADMIN' end;
  v_name := nullif(trim(coalesce(p_display_name, '')), '');
  if v_name is null then
    v_name := split_part(p_email, '@', 1);
  end if;

  insert into public.app_users (id, email, display_name, role, assigned_branch_id, is_active)
  values (p_id, trim(p_email), v_name, v_role, null, true)
  returning * into v_existing;
  return v_existing;
end;
$$;

revoke all on function public.provision_app_user(uuid, text, text) from public, anon, authenticated;
grant execute on function public.provision_app_user(uuid, text, text) to service_role;
