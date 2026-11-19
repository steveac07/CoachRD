// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // dist: export web · referencia y supabase/functions: código Deno, fuera del bundle
    // types/database.ts: generado por `npm run gen:types`
    ignores: ['dist/*', 'referencia/*', 'supabase/functions/*', 'types/database.ts'],
  },
]);
