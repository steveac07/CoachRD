# CoachRD

App de marca blanca de nutrición y entrenamiento para gimnasios y coaches en República Dominicana.
La vende el gimnasio a sus socios; el coach define alimentos, formas dietéticas, retos y premios.

## Stack
- Expo (React Native + TypeScript estricto), Expo Router, NativeWind v4.
- Supabase: Postgres con RLS, Auth, Realtime y Edge Functions (Deno).
- Claude API solo desde Edge Functions, nunca desde la app.
- Web en Netlify. iOS y Android con EAS Build (no hay Mac; desarrollo en Windows + PowerShell).

## Reglas
- TypeScript estricto, sin `any`. Tipos de la base de datos en `types/database.ts` (`npm run gen:types`).
- Instala dependencias con `npx expo install`, no con `npm install`, para respetar las versiones del SDK.
- En la app solo existen `EXPO_PUBLIC_SUPABASE_URL` y la clave publishable/anon. Nunca `service_role` ni `ANTHROPIC_API_KEY` en el cliente: todo lo `EXPO_PUBLIC_` acaba en el bundle.
- La IA nunca calcula macros. Elige alimentos del catálogo (enum de `foods.id`) y gramos; el código calcula y valida.
- Los objetivos diarios (`nutrition_targets`) los fija el coach con las reglas de su forma dietética (Katch-McArdle, como la demo). La Edge Function no los calcula: sin objetivos responde `409 targets_required`.
- Generar un plan lo pide el coach para un socio suyo (`is_coach_of`), nunca el socio.
- Alérgenos y exclusiones se filtran por código antes de llamar a la IA y se comprueban después.
- Los planes generados nacen como `draft` y el socio solo ve los `approved` (lo impone RLS).
- Datos de salud: exigir consentimiento (`consent_health_data_at`, Ley 172-13 de RD) antes de guardarlos.
- Retos: las estrellas se ganan por hábitos, nunca por el peso. Meta semanal: máximo 1 % del peso al bajar y 0,5 % al subir.
- Premios de comida: el plan del día reserva sus calorías y ajusta carbohidrato y grasa; la proteína no se toca.
- Tarjeta para redes: por defecto no muestra el peso, solo el cambio.
- Textos de la interfaz en español dominicano neutro y en positivo.
- Cada cambio de esquema es una migración nueva en `supabase/migrations/`; nunca se edita una ya aplicada.
  Después: `npm run db:reset` y `npm run gen:types:local`, y commit de `types/database.ts` (el CI falla si no coincide).
- Lista de compra: se calcula por código sumando el menú de 7 días (el mes es la semana × 4). Convierte gramos cocidos a crudo con el rendimiento de cada alimento, agrupa por nombre de compra y redondea hacia arriba: cuartos de libra, unidades enteras, 50 g, 25 ml. Los frescos se compran cada semana. El premio del día no entra.

## Referencias
- `referencia/coachrd-demo.html`: demo aprobada. Fuente de verdad para diseño, flujos, cálculos y generador de planes.
- `supabase/migrations/20261101000000_init.sql`: esquema inicial. En producción se aplicó desde el SQL Editor,
  así que en el historial remoto se marca con `npx supabase migration repair --status applied 20261101000000`.
- `supabase/functions/generate-diet-plan/`: Edge Function (Deno) que genera el borrador del plan. `plan.ts` es lógica pura
  (comidas, validación y macros), `ai.ts` el adaptador de Claude, `handler.ts` el HTTP con dependencias inyectadas
  y `supabase.ts` el acceso a datos. El JSON de `diet_plans.plan` es un contrato con `lib/shopping`
  (`fixtures/draft-plan.json`, probado en los dos lados).
- Las Edge Functions no pueden importar fuera de `supabase/functions/`: los tipos de la base van en
  `_shared/database.types.ts` (los escribe `npm run gen:types`) y las dependencias, con versión exacta, en `_shared/deps.ts`.

## Comandos
- `npx expo start` (tecla `w` para web)
- `npm run typecheck` · `npm run lint` · `npm run test:ci` (lo mismo que corre el CI)
- `npx expo-doctor`
- `npm run db:start` / `npm run db:reset`: Postgres local con todas las migraciones (requiere Docker Desktop)
- `npm run gen:types:local`: tipos desde la base local · `npm run gen:types`: desde el proyecto remoto
- `npm run fn:check` · `npm run fn:lint` · `npm run fn:fmt` · `npm run fn:test`: Edge Functions (Deno llega por npm)
- `npm run fn:deploy`: despliega `generate-diet-plan` (requiere `npx supabase link`)
