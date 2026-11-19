-- =====================================================================
-- CoachRD · Revisión del borrador por el coach
-- - El contenido de un plan solo lo escribe la Edge Function (service_role):
--   el coach ya no puede insertar ni editar planes directamente, así nadie
--   se salta la validación ni el cálculo de macros por código.
-- - El coach cambia el estado con review_diet_plan(): solo de draft a
--   approved o rejected, y solo en planes de sus socios.
-- - Un único plan aprobado por socio: al aprobar, el anterior se archiva.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Quién revisó, cuándo y con qué nota
-- ---------------------------------------------------------------------
alter table public.diet_plans
  add column reviewed_by uuid references auth.users(id),
  add column reviewed_at timestamptz,
  add column review_note text
    constraint diet_plans_review_note_check check (char_length(review_note) <= 500);

-- ---------------------------------------------------------------------
-- 2. Un único plan aprobado por socio
--    Si ya hubiera varios (aprobados a mano), se queda el más reciente.
-- ---------------------------------------------------------------------
update public.diet_plans d set status = 'archived'
where d.status = 'approved'
  and exists (
    select 1 from public.diet_plans newer
    where newer.user_id = d.user_id
      and newer.status = 'approved'
      and (coalesce(newer.approved_at, newer.created_at), newer.id) > (coalesce(d.approved_at, d.created_at), d.id)
  );

create unique index diet_plans_one_approved_per_user on public.diet_plans (user_id) where status = 'approved';

-- ---------------------------------------------------------------------
-- 3. El coach solo lee los planes de sus socios; nadie los escribe desde
--    la app. La Edge Function usa service_role (salta RLS y permisos).
-- ---------------------------------------------------------------------
drop policy plans_coach_all on public.diet_plans;

create policy plans_coach_read on public.diet_plans
  for select to authenticated
  using (public.is_coach_of(user_id));

revoke insert, update, delete on public.diet_plans from anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Revisión: aprobar o rechazar un borrador
--    security definer porque authenticated ya no tiene UPDATE; por eso la
--    función comprueba ella misma que quien llama es el coach del socio.
-- ---------------------------------------------------------------------
create or replace function public.review_diet_plan(p_plan uuid, p_decision text, p_note text default null)
returns public.plan_status
language plpgsql security definer set search_path = public as $$
declare
  v_user   uuid;
  v_status public.plan_status;
  v_note   text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if p_decision not in ('approve', 'reject') then
    raise exception 'decisión no válida: %', p_decision using errcode = '22023';
  end if;

  select user_id, status into v_user, v_status
  from public.diet_plans where id = p_plan
  for update;

  -- Mismo error si el plan no existe o es de un socio ajeno: no revela nada.
  if not found or not public.is_coach_of(v_user) then
    raise exception 'solo el coach del socio puede revisar su plan' using errcode = '42501';
  end if;
  if v_status <> 'draft' then
    raise exception 'el plan ya está revisado (%)', v_status using errcode = '55000';
  end if;

  if p_decision = 'approve' then
    update public.diet_plans set status = 'archived'
    where user_id = v_user and status = 'approved';

    update public.diet_plans set
      status = 'approved',
      approved_by = auth.uid(),
      approved_at = now(),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_note = v_note
    where id = p_plan;
    return 'approved';
  end if;

  update public.diet_plans set
    status = 'rejected',
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    review_note = v_note
  where id = p_plan;
  return 'rejected';
end;
$$;

revoke all on function public.review_diet_plan(uuid, text, text) from public, anon;
grant execute on function public.review_diet_plan(uuid, text, text) to authenticated;

commit;
