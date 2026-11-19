// POST /functions/v1/generate-diet-plan   body: { "client_id": "<uuid>" }
//
// Solo el coach de ese socio puede pedirlo. Flujo:
//   identidad (JWT) -> es su coach -> consentimiento + objetivos del coach -> catálogo sin
//   exclusiones -> Claude (alimentos y gramos) -> validación -> macros por código -> borrador.
//
// Todas las dependencias se inyectan: el handler no conoce Supabase ni el SDK de Anthropic.

import { z } from '../_shared/deps.ts';
import type { Food, Macros } from '../_shared/nutrition.ts';
import type { PlanFailure, PlanGenerator } from './ai.ts';
import {
  aiPlanJsonSchema,
  allowedFoods,
  buildDraft,
  buildUserPrompt,
  type Draft,
  mealTargets,
  parseAiPlan,
  slotsFor,
  SYSTEM_PROMPT,
} from './plan.ts';

/** Una generación por socio cada 10 minutos (controla el coste de la API). */
export const RATE_LIMIT_MS = 10 * 60_000;

export interface ClientContext {
  goal: string;
  mealsPerDay: number;
  excludedFoodIds: string[];
  /** Orígenes que excluye la forma dietética asignada (vacío si no tiene). */
  excludedOrigins: string[];
  consentAt: string | null;
  /** Objetivos que fija el coach. Null si aún no los ha fijado. */
  targets: Macros | null;
}

export interface HandlerDeps {
  /** Id del usuario del JWT, o null si el token no es válido. */
  authenticate(authorization: string): Promise<string | null>;
  /** true si el usuario del JWT es el coach del socio (`public.is_coach_of`). */
  isCoachOf(authorization: string, clientId: string): Promise<boolean>;
  loadClient(clientId: string): Promise<ClientContext | null>;
  loadActiveFoods(): Promise<Food[]>;
  lastPlanCreatedAt(clientId: string): Promise<Date | null>;
  generate: PlanGenerator;
  saveDraft(input: { clientId: string; model: string; draft: Draft }): Promise<string>;
  now(): Date;
  logError(event: string, detail: Record<string, unknown>): void;
}

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: Record<string, unknown>, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', ...headers },
  });
}

const Body = z.object({ client_id: z.uuid() });

export type AiFailure = PlanFailure | 'invalid_plan';

export function createHandler(deps: HandlerDeps): (req: Request) => Promise<Response> {
  return async (req) => {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
    if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

    try {
      return await generate(req, deps);
    } catch (error) {
      deps.logError('unexpected_error', { message: error instanceof Error ? error.message : String(error) });
      return json(500, { error: 'internal_error' });
    }
  };
}

async function generate(req: Request, deps: HandlerDeps): Promise<Response> {
  // 1. Identidad: siempre del JWT, nunca de un campo del body
  const authorization = req.headers.get('Authorization') ?? '';
  const userId = authorization ? await deps.authenticate(authorization) : null;
  if (!userId) return json(401, { error: 'unauthorized' });

  // 2. Petición
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json(400, { error: 'invalid_body' });
  }
  const body = Body.safeParse(raw);
  if (!body.success) return json(400, { error: 'invalid_body' });
  const clientId = body.data.client_id;

  // 3. Autorización: solo su coach (no revela si el socio existe)
  if (!(await deps.isCoachOf(authorization, clientId))) return json(403, { error: 'forbidden' });

  // 4. Requisitos del socio
  const client = await deps.loadClient(clientId);
  if (!client) return json(403, { error: 'forbidden' });
  if (!client.consentAt) return json(409, { error: 'consent_required' });
  if (!client.targets) return json(409, { error: 'targets_required' });
  const slots = slotsFor(client.mealsPerDay);
  if (!slots) return json(409, { error: 'invalid_meals_per_day' });

  // 5. Límite de generaciones
  const last = await deps.lastPlanCreatedAt(clientId);
  const elapsed = last ? deps.now().getTime() - last.getTime() : Infinity;
  if (elapsed < RATE_LIMIT_MS) {
    const retryAfter = Math.ceil((RATE_LIMIT_MS - elapsed) / 1000);
    return json(429, { error: 'too_many_requests', retry_after_s: retryAfter }, { 'Retry-After': String(retryAfter) });
  }

  // 6. Catálogo permitido: las exclusiones se quitan ANTES de llamar a la IA
  const catalog = allowedFoods(await deps.loadActiveFoods(), client.excludedFoodIds, client.excludedOrigins);
  if (catalog.length === 0) return json(409, { error: 'empty_catalog' });
  const foodIds = catalog.map((food) => food.id);

  // 7. IA: un plato por comida con alimentos del catálogo y gramos
  const daily = client.targets;
  const targets = mealTargets(daily, slots);
  const response = await deps.generate({
    system: SYSTEM_PROMPT,
    prompt: buildUserPrompt({ daily, goal: client.goal, targets, catalog }),
    schema: aiPlanJsonSchema(slots, foodIds),
  });
  if (!response.ok) return aiFailed(deps, clientId, response.reason, response.detail);

  // 8. Validación (y de nuevo las exclusiones) + macros por código
  const parsed = parseAiPlan(response.json, slots, foodIds);
  if (!parsed.ok) return aiFailed(deps, clientId, 'invalid_plan', parsed.issues.slice(0, 5).join('; '));
  const built = buildDraft(parsed.plan, targets, catalog, daily);
  if (!built.ok) return aiFailed(deps, clientId, 'invalid_plan', `${built.reason}: ${built.detail}`);

  // 9. Borrador: el socio no lo ve hasta que el coach lo aprueba (RLS)
  const planId = await deps.saveDraft({ clientId, model: response.model, draft: built.draft });
  return json(201, {
    plan_id: planId,
    status: 'draft',
    needs_review: built.draft.deviation.needs_review,
    flagged: built.draft.deviation.flagged,
  });
}

function aiFailed(deps: HandlerDeps, clientId: string, reason: AiFailure, detail?: string): Response {
  deps.logError('ai_generation_failed', { client_id: clientId, reason, detail });
  return json(502, { error: 'ai_generation_failed', reason });
}
