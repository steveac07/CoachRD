// Supabase Edge Function (Deno) · POST /functions/v1/generate-diet-plan
// Detalle del flujo en handler.ts.
//
// Secrets (npx supabase secrets set ...):
//   ANTHROPIC_API_KEY            obligatoria
//   ANTHROPIC_MODEL              opcional (por defecto claude-sonnet-5-5)
// SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY las inyecta Supabase.

import { Anthropic } from '../_shared/deps.ts';
import { createClaudePlanGenerator, DEFAULT_MODEL } from './ai.ts';
import { createHandler } from './handler.ts';
import { supabaseDeps } from './supabase.ts';

function requireEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

const handler = createHandler({
  ...supabaseDeps({
    url: requireEnv('SUPABASE_URL'),
    anonKey: requireEnv('SUPABASE_ANON_KEY'),
    serviceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  }),
  generate: createClaudePlanGenerator(
    new Anthropic({ apiKey: requireEnv('ANTHROPIC_API_KEY') }),
    Deno.env.get('ANTHROPIC_MODEL')?.trim() || DEFAULT_MODEL,
  ),
  now: () => new Date(),
  logError: (event, detail) => console.error(JSON.stringify({ event, ...detail })),
});

Deno.serve(handler);
