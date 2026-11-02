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
- Alérgenos y exclusiones se filtran por código antes de llamar a la IA y se comprueban después.
- Los planes generados nacen como `draft` y el socio solo ve los `approved` (lo impone RLS).
- Datos de salud: exigir consentimiento (`consent_health_data_at`, Ley 172-13 de RD) antes de guardarlos.
- Retos: las estrellas se ganan por hábitos, nunca por el peso. Meta semanal: máximo 1 % del peso al bajar y 0,5 % al subir.
- Premios de comida: el plan del día reserva sus calorías y ajusta carbohidrato y grasa; la proteína no se toca.
- Tarjeta para redes: por defecto no muestra el peso, solo el cambio.
- Textos de la interfaz en español dominicano neutro y en positivo.
- Cada cambio de esquema es una migración nueva en `supabase/migrations/`; nunca se edita una ya aplicada.

## Referencias
- `referencia/coachrd-demo.html`: demo aprobada. Fuente de verdad para diseño, flujos, cálculos y generador de planes.
- `referencia/001_init.sql`: esquema ya aplicado en Supabase desde el SQL Editor.
- `referencia/generate-diet-plan/`: Edge Function inicial (Claude con structured outputs + macros por código).

## Comandos
- `npx expo start` (tecla `w` para web)
- `npx tsc --noEmit`
- `npx expo-doctor`
