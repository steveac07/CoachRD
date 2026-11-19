-- Tests de la revisión del borrador (pgTAP). Se ejecutan con: npm run db:test
begin;
select plan(17);

-- ---------------------------------------------------------------- datos
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'coach-a@test.local'),
  ('00000000-0000-4000-8000-0000000000b1', 'coach-b@test.local'),
  ('00000000-0000-4000-8000-0000000000a2', 'socia-s@test.local'),
  ('00000000-0000-4000-8000-0000000000b2', 'socio-t@test.local');
insert into public.coaches (user_id, display_name) values
  ('00000000-0000-4000-8000-0000000000a1', 'Coach A'),
  ('00000000-0000-4000-8000-0000000000b1', 'Coach B');
insert into public.client_profiles
  (user_id, coach_id, sex, birth_date, height_cm, weight_kg, activity_level, goal, consent_health_data_at)
values
  ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000a1', 'F', '1995-05-10', 165, 70, 'moderado', 'perdida_grasa', now()),
  ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000b1', 'M', '1990-01-01', 180, 90, 'alto', 'recomposicion', now());
-- Borradores como los deja la Edge Function (service_role)
insert into public.diet_plans (id, user_id, status, model, plan, totals, deviation) values
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000a2', 'draft', 'claude-sonnet-5-5', '{"meals":[]}', '{}', '{}'),
  ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-0000000000a2', 'draft', 'claude-sonnet-5-5', '{"meals":[]}', '{}', '{}'),
  ('00000000-0000-4000-8000-0000000000d3', '00000000-0000-4000-8000-0000000000a2', 'draft', 'claude-sonnet-5-5', '{"meals":[]}', '{}', '{}'),
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000b2', 'draft', 'claude-sonnet-5-5', '{"meals":[]}', '{}', '{}');

create function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- ---------------------------------------------------------------- coach A
set local role authenticated;
select pg_temp.as_user('00000000-0000-4000-8000-0000000000a1');

select throws_ok(
  $$ insert into public.diet_plans (user_id, status, model, plan, totals, deviation)
     values ('00000000-0000-4000-8000-0000000000a2', 'approved', 'a-mano', '{}', '{}', '{}') $$,
  '42501', null, 'el coach no puede insertar planes (solo la Edge Function)');
select throws_ok(
  $$ update public.diet_plans set plan = '{"meals":[1]}' where id = '00000000-0000-4000-8000-0000000000d1' $$,
  '42501', null, 'el coach no puede editar un plan directamente');
select is((select count(*)::int from public.diet_plans), 3, 'el coach ve los planes de su socia y no los de otros');

select is(public.review_diet_plan('00000000-0000-4000-8000-0000000000d1', 'approve'), 'approved'::public.plan_status,
  'el coach aprueba un borrador');
select is(
  (select row(status, approved_by, reviewed_by, reviewed_at is not null)::text from public.diet_plans where id = '00000000-0000-4000-8000-0000000000d1'),
  row('approved'::public.plan_status, '00000000-0000-4000-8000-0000000000a1'::uuid, '00000000-0000-4000-8000-0000000000a1'::uuid, true)::text,
  'queda constancia de quién y cuándo lo aprobó');
select throws_ok(
  $$ select public.review_diet_plan('00000000-0000-4000-8000-0000000000d1', 'approve') $$,
  '55000', null, 'un plan ya revisado no se vuelve a revisar');

select is(public.review_diet_plan('00000000-0000-4000-8000-0000000000d2', 'approve', '  '), 'approved'::public.plan_status,
  'aprobar otro borrador');
select is((select status from public.diet_plans where id = '00000000-0000-4000-8000-0000000000d1'), 'archived'::public.plan_status,
  'el aprobado anterior se archiva');
select is((select review_note from public.diet_plans where id = '00000000-0000-4000-8000-0000000000d2'), null,
  'una nota en blanco no se guarda');

select is(public.review_diet_plan('00000000-0000-4000-8000-0000000000d3', 'reject', ' Falta variedad en la cena. '),
  'rejected'::public.plan_status, 'el coach rechaza un borrador');
select is((select review_note from public.diet_plans where id = '00000000-0000-4000-8000-0000000000d3'), 'Falta variedad en la cena.',
  'la nota del rechazo se guarda sin espacios sobrantes');

select throws_ok(
  $$ select public.review_diet_plan('00000000-0000-4000-8000-0000000000e1', 'approve') $$,
  '42501', null, 'no puede revisar el plan de un socio ajeno');
select throws_ok(
  $$ select public.review_diet_plan('00000000-0000-4000-8000-0000000000ff', 'approve') $$,
  '42501', null, 'un plan que no existe da el mismo error (no revela nada)');
select throws_ok(
  $$ select public.review_diet_plan('00000000-0000-4000-8000-0000000000e1', 'publicar') $$,
  '22023', null, 'solo se acepta approve o reject');

-- ---------------------------------------------------------------- socia S
select pg_temp.as_user('00000000-0000-4000-8000-0000000000a2');
select is((select array_agg(id)::text from public.diet_plans), '{00000000-0000-4000-8000-0000000000d2}',
  'la socia solo ve su plan aprobado vigente (ni borradores, ni rechazados, ni archivados)');
select throws_ok(
  $$ select public.review_diet_plan('00000000-0000-4000-8000-0000000000d3', 'approve') $$,
  '42501', null, 'la socia no puede aprobarse un plan');
reset role;

-- ---------------------------------------------------------------- integridad
select throws_ok(
  $$ update public.diet_plans set status = 'approved' where id = '00000000-0000-4000-8000-0000000000d1' $$,
  '23505', null, 'nunca hay dos planes aprobados para el mismo socio');

select * from finish();
rollback;
