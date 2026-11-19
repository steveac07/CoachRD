-- Tests de RLS y de save_coach_assessment (pgTAP). Se ejecutan con: npm run db:test
begin;
select plan(17);

-- ---------------------------------------------------------------- datos
-- coach A con su socia S; coach B con su socio T
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'coach-a@test.local'),
  ('00000000-0000-4000-8000-0000000000b1', 'coach-b@test.local'),
  ('00000000-0000-4000-8000-0000000000a2', 'socia-s@test.local'),
  ('00000000-0000-4000-8000-0000000000b2', 'socio-t@test.local');
insert into public.coaches (user_id, display_name) values
  ('00000000-0000-4000-8000-0000000000a1', 'Coach A'),
  ('00000000-0000-4000-8000-0000000000b1', 'Coach B');
insert into public.client_profiles
  (user_id, coach_id, display_name, sex, birth_date, height_cm, weight_kg, activity_level, goal, consent_health_data_at)
values
  ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000a1', 'Socia S', 'F', '1995-05-10', 165, 70, 'moderado', 'perdida_grasa', now()),
  ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000b1', 'Socio T', 'M', '1990-01-01', 180, 90, 'alto', 'recomposicion', now());
insert into public.diet_forms (id, coach_id, name, kcal_adjust_pct, protein_g_per_kg_lbm, fat_pct, meals_per_day) values
  ('00000000-0000-4000-8000-00000000f0b1', '00000000-0000-4000-8000-0000000000b1', 'Forma de B', -10, 2.2, 28, 4);

create function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- ---------------------------------------------------------------- foods.origin
select is((select origin from public.foods where id = 'pechuga_pollo_cocida'), 'carne', 'la pechuga es carne');
select is((select count(*)::int from public.foods where origin is null), 0, 'ningún alimento queda sin origen');

-- ---------------------------------------------------------------- coach A
set local role authenticated;
select pg_temp.as_user('00000000-0000-4000-8000-0000000000a1');

select lives_ok(
  $$ insert into public.diet_forms (id, coach_id, name, kcal_adjust_pct, protein_g_per_kg_lbm, fat_pct, meals_per_day, excluded_origins)
     values ('00000000-0000-4000-8000-00000000f0a1', '00000000-0000-4000-8000-0000000000a1', 'Vegetariana', -10, 2.2, 30, 5, '{carne,pescado,marisco}') $$,
  'el coach crea una forma propia');
select throws_ok(
  $$ insert into public.diet_forms (coach_id, name) values ('00000000-0000-4000-8000-0000000000b1', 'Forma ajena') $$,
  '42501', null, 'el coach no crea formas a nombre de otro');
select is((select count(*)::int from public.diet_forms), 1, 'el coach solo ve sus formas');

select lives_ok(
  $$ select public.save_coach_assessment('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-00000000f0a1',
       30, 24, 1, 16, 0, 1650, 120, 170, 55, 5) $$,
  'el coach guarda la valoración y los objetivos de su socia');
select is(
  (select row(kcal, protein_g, carbs_g, fat_g, meals_per_day, set_by)::text from public.nutrition_targets
   where user_id = '00000000-0000-4000-8000-0000000000a2'),
  row(1650, 120, 170, 55, 5, '00000000-0000-4000-8000-0000000000a1'::uuid)::text,
  'los objetivos quedan guardados con las comidas de la forma');
select lives_ok(
  $$ select public.save_coach_assessment('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-00000000f0a1',
       29, 24, 1, 16, -100, 1550, 120, 150, 55, 5) $$,
  'guardar otra vez actualiza (upsert)');
select is((select body_fat_pct from public.client_assessments), 29.0, 'la valoración se actualiza');

select throws_ok(
  $$ select public.save_coach_assessment('00000000-0000-4000-8000-0000000000b2', null, 25, 18, 0, 12, 0, 2400, 180, 250, 70, 4) $$,
  '42501', null, 'no puede guardar la valoración de un socio ajeno');
select throws_ok(
  $$ select public.save_coach_assessment('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-00000000f0b1',
       30, 24, 1, 16, 0, 1650, 120, 170, 55, 4) $$,
  '42501', null, 'no puede asignar una forma de otro coach');
select throws_ok(
  $$ select public.save_coach_assessment('00000000-0000-4000-8000-0000000000a2', null, 30, 24, 1, 16, 0, 1650, 120, 10, 55, 4) $$,
  '23514', null, 'los rangos de nutrition_targets se respetan (carbohidratos < 30 g)');

-- ---------------------------------------------------------------- socia S
select pg_temp.as_user('00000000-0000-4000-8000-0000000000a2');
select is((select count(*)::int from public.client_assessments), 1, 'la socia lee su valoración');
select is((select name from public.diet_forms), 'Vegetariana', 'la socia lee solo la forma que tiene asignada');
select throws_ok(
  $$ select public.save_coach_assessment('00000000-0000-4000-8000-0000000000a2', null, 10, 10, 0, 4, 0, 1200, 100, 100, 40, 3) $$,
  '42501', null, 'la socia no puede fijarse sus propios objetivos');
update public.client_assessments set body_fat_pct = 10;
reset role;
select is((select body_fat_pct from public.client_assessments where user_id = '00000000-0000-4000-8000-0000000000a2'), 29.0,
  'la socia no puede cambiar su valoración');

-- ---------------------------------------------------------------- coach B
set local role authenticated;
select pg_temp.as_user('00000000-0000-4000-8000-0000000000b1');
select is((select count(*)::int from public.client_assessments), 0, 'otro coach no ve la valoración');
reset role;

select * from finish();
rollback;
