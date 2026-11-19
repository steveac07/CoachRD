-- =====================================================================
-- CoachRD · Formas dietéticas y valoración del coach
-- Lo que la demo calcula en el panel del coach (Katch-McArdle a partir del
-- % de grasa) necesita datos que hoy no existen. El socio es dueño de su
-- perfil (client_profiles); lo que fija el coach va en tablas suyas.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. foods.origin: para que una forma dietética excluya por origen
--    (p. ej. «Vegetariana» excluye carne, pescado y marisco).
--    Los alimentos existentes sin origen conocido se rellenan por categoría,
--    del lado prudente: una proteína desconocida cuenta como carne.
-- ---------------------------------------------------------------------
alter table public.foods add column origin text
  constraint foods_origin_check check (origin in ('vegetal','carne','pescado','marisco','huevo','lacteo'));

update public.foods f set origin = v.origin
from (values
  ('arroz_blanco_cocido','vegetal'), ('platano_verde_hervido','vegetal'), ('batata_hervida','vegetal'),
  ('habichuelas_rojas_cocidas','vegetal'), ('pechuga_pollo_cocida','carne'), ('huevo_entero','huevo'),
  ('clara_huevo','huevo'), ('aguacate','vegetal'), ('aceite_oliva','vegetal'), ('ensalada_verde','vegetal')
) as v(id, origin)
where f.id = v.id;

update public.foods set origin = case category
    when 'proteina' then 'carne'
    when 'lacteo' then 'lacteo'
    else 'vegetal'
  end
where origin is null;

-- Sin valor por defecto: quien añada un alimento tiene que decir su origen.
alter table public.foods alter column origin set not null;

-- ---------------------------------------------------------------------
-- 2. client_profiles.display_name: el nombre que ve el coach.
--    Lo escribe el socio (su perfil); el coach no lee auth.users.
-- ---------------------------------------------------------------------
alter table public.client_profiles add column display_name text
  constraint client_profiles_display_name_check check (char_length(btrim(display_name)) between 1 and 80);

-- ---------------------------------------------------------------------
-- 3. Formas dietéticas del coach (mismos rangos que la demo)
-- ---------------------------------------------------------------------
create table public.diet_forms (
  id                    uuid primary key default gen_random_uuid(),
  coach_id              uuid not null references public.coaches(user_id) on delete cascade,
  name                  text not null check (char_length(btrim(name)) between 2 and 60),
  kcal_adjust_pct       numeric(4,1) not null default 0 check (kcal_adjust_pct between -30 and 20),
  protein_g_per_kg_lbm  numeric(3,1) not null default 2.0 check (protein_g_per_kg_lbm between 1.6 and 3.2),
  fat_pct               numeric(4,1) not null default 28 check (fat_pct between 15 and 45),
  meals_per_day         int not null default 4 check (meals_per_day between 3 and 6),
  excluded_origins      text[] not null default '{}'
    check (excluded_origins <@ array['carne','pescado','marisco','huevo','lacteo']::text[]),
  note                  text not null default '' check (char_length(note) <= 240),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (coach_id, name)
);
create index diet_forms_coach_idx on public.diet_forms (coach_id);

-- ---------------------------------------------------------------------
-- 4. Valoración del coach para cada socio (entrada del cálculo)
-- ---------------------------------------------------------------------
create table public.client_assessments (
  user_id              uuid primary key references public.client_profiles(user_id) on delete cascade,
  diet_form_id         uuid references public.diet_forms(id) on delete set null,
  body_fat_pct         numeric(4,1) not null check (body_fat_pct between 3 and 60),
  target_body_fat_pct  numeric(4,1) not null check (target_body_fat_pct between 3 and 60),
  lean_gain_kg         numeric(4,1) not null default 0 check (lean_gain_kg between -10 and 15),
  weeks                int not null check (weeks between 1 and 104),
  -- Ajuste fino que el coach aprueba a partir de los check-ins (±300 kcal como máximo)
  kcal_adjust          int not null default 0 check (kcal_adjust between -300 and 300),
  updated_by           uuid references auth.users(id),
  updated_at           timestamptz not null default now()
);
create index client_assessments_form_idx on public.client_assessments (diet_form_id);

-- ---------------------------------------------------------------------
-- 5. nutrition_targets.meals_per_day: las comidas de la forma dietética
--    (en la demo salen de la forma, no del perfil). Null = las del perfil.
-- ---------------------------------------------------------------------
alter table public.nutrition_targets add column meals_per_day int
  constraint nutrition_targets_meals_per_day_check check (meals_per_day between 3 and 6);

-- ---------------------------------------------------------------------
-- 6. RLS
-- ---------------------------------------------------------------------
alter table public.diet_forms enable row level security;
alter table public.client_assessments enable row level security;

revoke all on public.diet_forms, public.client_assessments from anon;
grant select, insert, update, delete on public.diet_forms, public.client_assessments to authenticated;

-- Las políticas de diet_forms y client_assessments se miran entre sí. Para que
-- Postgres no entre en recursión, cada consulta cruzada va en una función
-- security definer (como is_coach_of), que no aplica RLS por dentro.
create or replace function public.owns_diet_form(form uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from diet_forms f where f.id = form and f.coach_id = auth.uid());
$$;

create or replace function public.has_diet_form_assigned(form uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from client_assessments a where a.user_id = auth.uid() and a.diet_form_id = form);
$$;

-- Formas: cada coach gestiona las suyas; el socio lee la que tiene asignada.
create policy diet_forms_coach_all on public.diet_forms
  for all to authenticated
  using (coach_id = (select auth.uid()))
  with check (
    coach_id = (select auth.uid())
    and exists (select 1 from public.coaches c where c.user_id = (select auth.uid()))
  );
create policy diet_forms_client_read on public.diet_forms
  for select to authenticated
  using (public.has_diet_form_assigned(id));

-- Valoración: el socio la lee; su coach la gestiona, solo con formas propias.
create policy client_assessments_client_read on public.client_assessments
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy client_assessments_coach_all on public.client_assessments
  for all to authenticated
  using (public.is_coach_of(user_id))
  with check (
    public.is_coach_of(user_id)
    and (diet_form_id is null or public.owns_diet_form(diet_form_id))
  );

-- ---------------------------------------------------------------------
-- 7. Guardar valoración + objetivos en una sola transacción.
--    security invoker: se aplican las políticas RLS de quien llama.
--    Los objetivos los calcula la app con las reglas de la demo; aquí se
--    guardan juntos para que nunca queden desalineados.
-- ---------------------------------------------------------------------
create or replace function public.save_coach_assessment(
  p_client               uuid,
  p_diet_form_id         uuid,
  p_body_fat_pct         numeric,
  p_target_body_fat_pct  numeric,
  p_lean_gain_kg         numeric,
  p_weeks                int,
  p_kcal_adjust          int,
  p_kcal                 int,
  p_protein_g            int,
  p_carbs_g              int,
  p_fat_g                int,
  p_meals_per_day        int
) returns void
language plpgsql security invoker set search_path = public as $$
begin
  if not public.is_coach_of(p_client) then
    raise exception 'solo el coach del socio puede guardar su valoración' using errcode = '42501';
  end if;

  insert into public.client_assessments as a
    (user_id, diet_form_id, body_fat_pct, target_body_fat_pct, lean_gain_kg, weeks, kcal_adjust, updated_by, updated_at)
  values
    (p_client, p_diet_form_id, p_body_fat_pct, p_target_body_fat_pct, p_lean_gain_kg, p_weeks, p_kcal_adjust, auth.uid(), now())
  on conflict (user_id) do update set
    diet_form_id = excluded.diet_form_id,
    body_fat_pct = excluded.body_fat_pct,
    target_body_fat_pct = excluded.target_body_fat_pct,
    lean_gain_kg = excluded.lean_gain_kg,
    weeks = excluded.weeks,
    kcal_adjust = excluded.kcal_adjust,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at;

  insert into public.nutrition_targets as t
    (user_id, kcal, protein_g, carbs_g, fat_g, meals_per_day, set_by, updated_at)
  values
    (p_client, p_kcal, p_protein_g, p_carbs_g, p_fat_g, p_meals_per_day, auth.uid(), now())
  on conflict (user_id) do update set
    kcal = excluded.kcal,
    protein_g = excluded.protein_g,
    carbs_g = excluded.carbs_g,
    fat_g = excluded.fat_g,
    meals_per_day = excluded.meals_per_day,
    set_by = excluded.set_by,
    updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.save_coach_assessment(uuid, uuid, numeric, numeric, numeric, int, int, int, int, int, int, int) from public, anon;
grant execute on function public.save_coach_assessment(uuid, uuid, numeric, numeric, numeric, int, int, int, int, int, int, int) to authenticated;

commit;
