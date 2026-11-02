-- =====================================================================
-- CoachRD · Esquema inicial (Supabase / Postgres)
-- Principio: la IA PROPONE alimentos y gramos; la base de datos y el
-- código CALCULAN macros. El coach APRUEBA antes de que el cliente vea nada.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. Catálogo de alimentos (valores por 100 g, ya cocidos salvo indicación)
-- ---------------------------------------------------------------------
create table public.foods (
  id               text primary key,               -- slug estable: 'arroz_blanco_cocido'
  name             text not null,
  category         text not null check (category in
                     ('carbohidrato','proteina','grasa','vegetal','lacteo','otro')),
  kcal_100g        numeric(6,1) not null check (kcal_100g >= 0),
  protein_100g     numeric(5,1) not null check (protein_100g >= 0),
  carbs_100g       numeric(5,1) not null check (carbs_100g >= 0),
  fat_100g         numeric(5,1) not null check (fat_100g >= 0),
  fiber_100g       numeric(5,1),
  household_unit   text,                            -- 'taza', 'cucharón', 'unidad'
  household_unit_g numeric(6,1),                    -- gramos por medida casera
  source           text not null,                   -- 'USDA FDC', 'INCAP TCA', 'coach'
  verified         boolean not null default false,  -- lo marca el nutricionista
  active           boolean not null default true
);

-- ---------------------------------------------------------------------
-- 1b. Coaches autorizados. Solo se dan de alta desde el SQL Editor /
--     service_role (no hay política de INSERT para usuarios).
-- ---------------------------------------------------------------------
create table public.coaches (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. Perfil del cliente (editable por el propio cliente)
-- ---------------------------------------------------------------------
create table public.client_profiles (
  user_id               uuid primary key references auth.users(id) on delete cascade,
  coach_id              uuid not null references public.coaches(user_id),
  sex                   text not null check (sex in ('M','F')),
  birth_date            date not null,
  height_cm             numeric(5,1) not null check (height_cm between 120 and 230),
  weight_kg             numeric(5,1) not null check (weight_kg between 35 and 250),
  activity_level        text not null check (activity_level in
                          ('sedentario','ligero','moderado','alto','muy_alto')),
  goal                  text not null check (goal in
                          ('perdida_grasa','recomposicion','ganancia_muscular')),
  meals_per_day         int  not null default 4 check (meals_per_day between 3 and 6),
  excluded_food_ids     text[] not null default '{}',
  consent_health_data_at timestamptz,               -- consentimiento explícito (Ley 172-13 RD)
  updated_at            timestamptz not null default now(),
  constraint client_is_not_own_coach check (coach_id <> user_id)
);

-- ---------------------------------------------------------------------
-- 3. Objetivos nutricionales (solo coach / servidor; el cliente solo lee)
--    Separado del perfil para que el cliente no pueda auto-asignarse macros.
-- ---------------------------------------------------------------------
create table public.nutrition_targets (
  user_id     uuid primary key references public.client_profiles(user_id) on delete cascade,
  kcal        int not null check (kcal between 1000 and 6000),
  protein_g   int not null check (protein_g between 40 and 400),
  carbs_g     int not null check (carbs_g between 30 and 800),
  fat_g       int not null check (fat_g between 20 and 250),
  set_by      uuid references auth.users(id),       -- null = cálculo automático
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4. Planes de dieta (borrador IA -> aprobado por coach)
-- ---------------------------------------------------------------------
create type public.plan_status as enum ('draft','approved','rejected');

create table public.diet_plans (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.client_profiles(user_id) on delete cascade,
  status       public.plan_status not null default 'draft',
  model        text not null,
  plan         jsonb not null,      -- comidas con porciones y macros calculados por código
  totals       jsonb not null,
  deviation    jsonb not null,      -- % desviación vs objetivo (alertas para el coach)
  approved_by  uuid references auth.users(id),
  approved_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index diet_plans_user_created_idx on public.diet_plans (user_id, created_at desc);

-- ---------------------------------------------------------------------
-- 5. RLS
-- ---------------------------------------------------------------------
alter table public.coaches           enable row level security;
alter table public.foods             enable row level security;
alter table public.client_profiles   enable row level security;
alter table public.nutrition_targets enable row level security;
alter table public.diet_plans        enable row level security;

create or replace function public.is_coach_of(client uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from client_profiles cp
    join coaches c on c.user_id = cp.coach_id
    where cp.user_id = client
      and cp.coach_id = auth.uid()
      and cp.user_id <> auth.uid()
  );
$$;

-- Coaches: cualquier autenticado puede ver la lista (para elegir coach); nadie escribe
create policy coaches_read on public.coaches
  for select to authenticated using (true);

-- El cliente no puede cambiar de coach por su cuenta ni tocar campos ajenos:
-- solo se permite UPDATE si coach_id no cambia.
create or replace function public.prevent_coach_change()
returns trigger language plpgsql as $$
begin
  if new.coach_id is distinct from old.coach_id
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'coach_id solo lo cambia el administrador';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger client_profiles_guard
  before update on public.client_profiles
  for each row execute function public.prevent_coach_change();

-- Catálogo: lectura para cualquier usuario autenticado
create policy foods_read on public.foods
  for select to authenticated using (active);

-- Perfil: el cliente gestiona el suyo; el coach lee los de sus clientes
create policy profile_self on public.client_profiles
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy profile_coach_read on public.client_profiles
  for select to authenticated using (coach_id = auth.uid());

-- Objetivos: cliente lee; coach lee/escribe
create policy targets_client_read on public.nutrition_targets
  for select to authenticated using (user_id = auth.uid());
create policy targets_coach_all on public.nutrition_targets
  for all to authenticated
  using (public.is_coach_of(user_id))
  with check (public.is_coach_of(user_id));

-- Planes: el cliente SOLO ve planes aprobados; el coach gestiona todo.
-- Los borradores los inserta la Edge Function con service_role (salta RLS).
create policy plans_client_read on public.diet_plans
  for select to authenticated using (user_id = auth.uid() and status = 'approved');
create policy plans_coach_all on public.diet_plans
  for all to authenticated
  using (public.is_coach_of(user_id))
  with check (public.is_coach_of(user_id));

-- ---------------------------------------------------------------------
-- 6. Semilla mínima (valores aproximados de referencia USDA FoodData Central).
--    verified = false: el nutricionista DEBE revisar y completar con la
--    Tabla de Composición de Alimentos de Centroamérica (INCAP) / etiquetas
--    locales antes de producción.
-- ---------------------------------------------------------------------
insert into public.foods
  (id, name, category, kcal_100g, protein_100g, carbs_100g, fat_100g, fiber_100g, household_unit, household_unit_g, source)
values
  ('arroz_blanco_cocido',      'Arroz blanco cocido',                   'carbohidrato', 130, 2.7, 28.2,  0.3, 0.4, 'taza',     160, 'USDA FDC (aprox.)'),
  ('platano_verde_hervido',    'Plátano verde hervido (mangú sin grasa)','carbohidrato', 116, 0.8, 31.2,  0.2, 2.3, 'unidad',   150, 'USDA FDC (aprox.)'),
  ('batata_hervida',           'Batata hervida',                        'carbohidrato',  76, 1.4, 17.7,  0.1, 2.5, 'taza',     150, 'USDA FDC (aprox.)'),
  ('habichuelas_rojas_cocidas','Habichuelas rojas cocidas (sin grasa)', 'carbohidrato', 127, 8.7, 22.8,  0.5, 6.4, 'cucharón', 130, 'USDA FDC (aprox.)'),
  ('pechuga_pollo_cocida',     'Pechuga de pollo cocida sin piel',      'proteina',     165, 31.0, 0.0,  3.6, 0.0, null,       null,'USDA FDC (aprox.)'),
  ('huevo_entero',             'Huevo entero',                          'proteina',     143, 12.6, 0.7,  9.5, 0.0, 'unidad',    50, 'USDA FDC (aprox.)'),
  ('clara_huevo',              'Clara de huevo',                        'proteina',      52, 10.9, 0.7,  0.2, 0.0, 'unidad',    33, 'USDA FDC (aprox.)'),
  ('aguacate',                 'Aguacate',                              'grasa',        160, 2.0,  8.5, 14.7, 6.7, null,       null,'USDA FDC (aprox.)'),
  ('aceite_oliva',             'Aceite de oliva',                       'grasa',        884, 0.0,  0.0,100.0, 0.0, 'cucharadita', 4.5,'USDA FDC (aprox.)'),
  ('ensalada_verde',           'Ensalada verde (lechuga, tomate, pepino)','vegetal',     18, 0.9,  3.5,  0.2, 1.3, 'plato',    200, 'USDA FDC (aprox.)');
