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
npx tsc --noEmit
npx expo-doctor
```

Copia `.env.example` a `.env` y completa los valores públicos de Supabase.
Las dependencias nuevas se instalan con `npx expo install`.

Las reglas del proyecto están en `CLAUDE.md`.
