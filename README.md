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

## Base de datos (Supabase)

Todo el esquema vive en `supabase/migrations/`, en orden. Con Docker Desktop abierto:

```bash
npm run db:start          # Postgres local con todas las migraciones
npm run db:reset          # vuelve a crearla desde cero
npm run gen:types:local   # regenera types/database.ts
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

## CI

GitHub Actions (`.github/workflows/ci.yml`) corre en cada pull request y en cada push a `master`:
tipos, lint, tests y migraciones + tipos de Supabase.

Las reglas del proyecto están en `CLAUDE.md`.
