-- =====================================================================
-- CoachRD · Lista de compra
-- Se aplica DESPUÉS de referencia/001_init.sql (ya aplicado).
-- La lista se calcula por código a partir del plan aprobado: aquí solo se
-- guarda CÓMO se compra cada alimento, el periodo que prefiere el socio y
-- los productos que ya marcó como comprados.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. foods: cómo se compra cada alimento en el supermercado
--    Por defecto todo se compra por libras (República Dominicana).
-- ---------------------------------------------------------------------
alter table public.foods
  add column buy_name            text,
  add column buy_unit            text not null default 'lb'
    constraint foods_buy_unit_check check (buy_unit in ('lb','un','g','ml')),
  add column raw_g_per_100g      numeric(6,1) not null default 100
    constraint foods_raw_g_per_100g_check check (raw_g_per_100g > 0),
  add column unit_g              numeric(7,1)
    constraint foods_unit_g_check check (unit_g > 0),
  add column unit_label_singular text,
  add column unit_label_plural   text,
  add column is_fresh            boolean not null default false,
  add column shop_section        text
    constraint foods_shop_section_check check (shop_section in ('carnes','lacteos','viveres','despensa'));

-- Para comprar por unidades hay que saber cuántos gramos trae cada una.
alter table public.foods
  add constraint foods_unit_needs_grams check (buy_unit <> 'un' or unit_g is not null);

comment on column public.foods.buy_name is
  'Nombre en la lista de compra. Dos alimentos con el mismo nombre se suman en una sola línea. Null = usa name.';
comment on column public.foods.buy_unit is
  'Unidad de compra: lb (cuartos de libra), un (unidades enteras), g (de 50 en 50) o ml (de 25 en 25).';
comment on column public.foods.raw_g_per_100g is
  'Rendimiento: gramos (o ml) que hay que comprar en crudo por cada 100 g del plan (cocido y listo para comer).';
comment on column public.foods.unit_g is
  'Gramos que trae una unidad tal como se compra. Obligatorio cuando buy_unit = un.';
comment on column public.foods.is_fresh is
  'Fresco: en la compra del mes va al grupo «cómpralos cada semana» con la cantidad de una semana.';
comment on column public.foods.shop_section is
  'Sección del supermercado. Null = se deduce de category.';

-- Valores de compra de los alimentos que ya existen (aproximados; el coach
-- los ajusta desde la app). Rendimientos orientativos:
--   arroz crudo x2,6 al cocer · habichuelas secas x2,5 · pechuga cruda pierde ~25 %
--   plátano y aguacate: se descuenta cáscara y semilla · aceite: 100 g = 109 ml
update public.foods f set
  buy_name            = v.buy_name,
  buy_unit            = v.buy_unit,
  raw_g_per_100g      = v.raw_g_per_100g,
  unit_g              = v.unit_g,
  unit_label_singular = v.unit_label_singular,
  unit_label_plural   = v.unit_label_plural,
  is_fresh            = v.is_fresh,
  shop_section        = v.shop_section
from (values
  ('arroz_blanco_cocido',       'Arroz blanco',                                       'lb',  38::numeric, null::numeric, null::text, null::text,  false, 'despensa'),
  ('habichuelas_rojas_cocidas', 'Habichuelas rojas secas',                            'lb',  40,          null,          null,       null,        false, 'despensa'),
  ('platano_verde_hervido',     'Plátano verde',                                      'un', 155,          240,           'plátano',  'plátanos',  true,  'viveres'),
  ('batata_hervida',            'Batata',                                             'lb', 120,          null,          null,       null,        true,  'viveres'),
  ('pechuga_pollo_cocida',      'Pechuga de pollo',                                   'lb', 135,          null,          null,       null,        false, 'carnes'),
  ('huevo_entero',              'Huevos',                                             'un', 100,          50,            'huevo',    'huevos',    false, 'lacteos'),
  ('clara_huevo',               'Huevos',                                             'un', 100,          33,            'huevo',    'huevos',    false, 'lacteos'),
  ('aguacate',                  'Aguacate',                                           'un', 150,          450,           'aguacate', 'aguacates', true,  'viveres'),
  ('aceite_oliva',              'Aceite de oliva',                                    'ml', 109,          null,          null,       null,        false, 'despensa'),
  ('ensalada_verde',            'Vegetales para ensalada (lechuga, tomate y pepino)', 'lb', 115,          null,          null,       null,        true,  'viveres')
) as v(id, buy_name, buy_unit, raw_g_per_100g, unit_g, unit_label_singular, unit_label_plural, is_fresh, shop_section)
where f.id = v.id;

-- ---------------------------------------------------------------------
-- 2. client_profiles: periodo de compra que prefiere el socio
-- ---------------------------------------------------------------------
alter table public.client_profiles
  add column shop_period text not null default 'week'
    constraint client_profiles_shop_period_check check (shop_period in ('week','month'));

-- ---------------------------------------------------------------------
-- 3. shopping_checks: productos ya comprados
--    list_key = id del plan aprobado + periodo ('<uuid>:week' | '<uuid>:month').
--    Si cambia el plan aprobado cambia la clave y los checks empiezan de cero.
-- ---------------------------------------------------------------------
create table public.shopping_checks (
  user_id    uuid not null references public.client_profiles(user_id) on delete cascade,
  list_key   text not null,
  item_key   text not null,
  checked_at timestamptz not null default now(),
  primary key (user_id, list_key, item_key)
);

alter table public.shopping_checks enable row level security;

revoke all on public.shopping_checks from anon;
grant select, insert, update, delete on public.shopping_checks to authenticated;

-- El socio gestiona solo sus filas; su coach solo las lee.
create policy shopping_checks_self on public.shopping_checks
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy shopping_checks_coach_read on public.shopping_checks
  for select to authenticated
  using (public.is_coach_of(user_id));

-- ---------------------------------------------------------------------
-- 4. foods: los coaches ajustan SOLO las columnas de compra
--    Un permiso UPDATE de tabla cubre todas las columnas, así que primero
--    se retira y después se concede columna a columna. La política limita
--    además las filas a usuarios que estén en la tabla coaches.
--    TODO: cuando haya datos separados por gimnasio, foods llevará gym_id
--    y esta política se limitará a los alimentos del gimnasio del coach.
-- ---------------------------------------------------------------------
revoke update on public.foods from anon, authenticated;
grant update (buy_name, buy_unit, raw_g_per_100g, unit_g,
              unit_label_singular, unit_label_plural, is_fresh, shop_section)
  on public.foods to authenticated;

create policy foods_coach_update_buy on public.foods
  for update to authenticated
  using      (exists (select 1 from public.coaches c where c.user_id = (select auth.uid())))
  with check (exists (select 1 from public.coaches c where c.user_id = (select auth.uid())));

commit;

-- Comprobación (opcional, después de aplicar):
--   select id, buy_name, buy_unit, raw_g_per_100g, unit_g, is_fresh, shop_section
--   from public.foods order by shop_section, id;
