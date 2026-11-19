# CoachRD

App de marca blanca de nutrición y entrenamiento para gimnasios y coaches en República Dominicana.
El gimnasio la ofrece a sus socios; el coach define alimentos, formas dietéticas, retos y premios.

## Demo en Netlify

La demo aprobada vive en `referencia/coachrd-demo.html` y es lo que Netlify publica como página de inicio
(ver `netlify.toml`). Cada `git push` a la rama de producción la vuelve a desplegar.

Lo que incluye:

- **Panel del coach**: resumen con prioridades del día, adherencia, check-ins y ajuste de calorías sugerido
  por reglas (el coach lo aprueba), socios, retos y premios, formas dietéticas, alimentos y marca.
- **App del socio**: plan del día con intercambio de alimentos y lista de compras, check-in semanal,
  racha, agua, retos, ranking por hábitos, progreso y tarjeta para redes.

Para verla en local basta con abrir el archivo HTML en el navegador.

## App (Expo)

```bash
npm install
npx expo start        # tecla w para web
npm run typecheck
npm run lint
npm run test:ci
npx expo-doctor
```

Copia `.env.example` a `.env` y completa los valores públicos de Supabase.
Las dependencias nuevas se instalan con `npx expo install`.

### Panel del coach

`/login` → `/coach` (lista de socios) → `/coach/socio/<id>` (ficha). Hace falta una cuenta que esté en la tabla
`coaches`. En la ficha el coach escribe su valoración (grasa actual y meta, músculo a ganar, plazo, ajuste fino) y
elige la forma dietética. El cálculo se ve en vivo con las reglas de la demo (Katch-McArdle). Después:

1. **Guardar objetivos**: guarda la valoración y los objetivos juntos (RPC `save_coach_assessment`).
2. **Generar plan**: llama a la Edge Function `generate-diet-plan` y deja el borrador en `diet_plans`.

Si el coach aún no tiene formas dietéticas, la lista ofrece crear las cuatro de la demo con un botón.

## Base de datos (Supabase)

Todo el esquema vive en `supabase/migrations/`, en orden. Con Docker Desktop abierto:

```bash
npm run db:start          # Postgres local con todas las migraciones
npm run db:reset          # vuelve a crearla desde cero
npm run gen:types:local   # regenera types/database.ts
npm run db:test           # tests de RLS y funciones SQL (pgTAP, supabase/tests/)
```

`types/database.ts` se versiona. El CI aplica las migraciones sobre una base vacía y falla si los tipos
no coinciden con ellas.

El esquema inicial (`20261101000000_init.sql`) se aplicó en producción desde el SQL Editor. Antes del
primer `supabase db push`, márcalo como aplicado en el proyecto remoto (y la lista de compra también, si
ya la ejecutaste a mano):

```bash
npx supabase link --project-ref ttxcxxuanbsuxzgbrfiv
npx supabase migration repair --status applied 20261101000000
npx supabase migration list
```

## Edge Function `generate-diet-plan`

El coach pide el borrador del plan diario de un socio suyo. Claude elige alimentos del catálogo y gramos; el
código valida la respuesta, calcula los macros y guarda el plan como `draft` (el socio solo ve los `approved`).

```ts
const { data, error } = await supabase.functions.invoke('generate-diet-plan', { body: { client_id } });
```

| Respuesta | Cuándo |
|---|---|
| `201 { plan_id, status: 'draft', needs_review, flagged }` | Borrador guardado. `flagged`: macros a más de ±10 % del objetivo |
| `400 invalid_body` | `client_id` no es un uuid |
| `401 unauthorized` | Sin sesión o token inválido |
| `403 forbidden` | Quien llama no es el coach de ese socio |
| `409 consent_required` · `targets_required` · `empty_catalog` | Falta el consentimiento (Ley 172-13), los objetivos del coach o alimentos permitidos |
| `429 too_many_requests` (+ `Retry-After`) | Ya se generó un plan para ese socio hace menos de 10 minutos |
| `502 ai_generation_failed` (+ `reason`) | Claude rechazó la petición o devolvió un plan no válido. No se guarda nada |

Desarrollo (Deno se instala con `npm install`, no hace falta aparte):

```bash
npm run fn:check
npm run fn:lint
npm run fn:fmt
npm run fn:test
```

Despliegue. La clave de Anthropic va en `supabase/functions/.env` (ignorado por git) con la línea
`ANTHROPIC_API_KEY=...`; `ANTHROPIC_MODEL` es opcional (por defecto `claude-sonnet-5-5`):

```bash
npx supabase link --project-ref ttxcxxuanbsuxzgbrfiv
npx supabase secrets set --env-file supabase/functions/.env
npm run fn:deploy
```

## CI

GitHub Actions (`.github/workflows/ci.yml`) corre en cada pull request y en cada push a `master`:
tipos, lint y tests de la app (con el cálculo comparado contra la demo), Edge Functions (Deno) y
migraciones + tests de RLS + tipos de Supabase.

Las reglas del proyecto están en `CLAUDE.md`.
