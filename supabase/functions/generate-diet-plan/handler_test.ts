import { assert, assertEquals, assertFalse } from '../_shared/test_deps.ts';
import type { PlanRequest, PlanResponse } from './ai.ts';
import { type ClientContext, createHandler, type HandlerDeps, RATE_LIMIT_MS } from './handler.ts';
import type { Draft } from './plan.ts';
import { AI_PLAN, DAILY, FOODS } from './test_fixtures.ts';

const COACH = 'coach-1';
const CLIENT_ID = '7d3c1c2e-5b7a-4f43-9a42-6f1b2f0e8c11';
const TOKEN = 'Bearer token-del-coach';
const NOW = new Date('2026-11-19T12:00:00Z');

const CLIENT: ClientContext = {
  goal: 'perdida_grasa',
  mealsPerDay: 3,
  excludedFoodIds: ['aguacate'],
  excludedOrigins: [],
  consentAt: '2026-11-01T10:00:00Z',
  targets: DAILY,
};

/** Sin el aguacate, que el socio tiene excluido. */
const PLAN_OK = {
  ...AI_PLAN,
  cena: { ...AI_PLAN.cena!, items: AI_PLAN.cena!.items.filter((i) => i.food_id !== 'aguacate') },
};

interface Spy {
  prompts: PlanRequest[];
  saved: { clientId: string; model: string; draft: Draft }[];
  errors: { event: string; detail: Record<string, unknown> }[];
}

function setup(
  overrides: Partial<HandlerDeps> = {},
  ai: PlanResponse = { ok: true, json: PLAN_OK, model: 'claude-sonnet-5-5' },
) {
  const spy: Spy = { prompts: [], saved: [], errors: [] };
  const deps: HandlerDeps = {
    authenticate: (auth) => Promise.resolve(auth === TOKEN ? COACH : null),
    isCoachOf: (auth, clientId) => Promise.resolve(auth === TOKEN && clientId === CLIENT_ID),
    loadClient: () => Promise.resolve(CLIENT),
    loadActiveFoods: () => Promise.resolve(FOODS),
    lastPlanCreatedAt: () => Promise.resolve(null),
    generate: (request) => {
      spy.prompts.push(request);
      return Promise.resolve(ai);
    },
    saveDraft: (input) => {
      spy.saved.push(input);
      return Promise.resolve('plan-1');
    },
    now: () => NOW,
    logError: (event, detail) => spy.errors.push({ event, detail }),
    ...overrides,
  };
  return { handler: createHandler(deps), spy };
}

function post(body: unknown = { client_id: CLIENT_ID }, auth: string | null = TOKEN): Request {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (auth) headers.set('Authorization', auth);
  return new Request('http://localhost/generate-diet-plan', {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

async function call(handler: (req: Request) => Promise<Response>, req: Request) {
  const res = await handler(req);
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
}

// ---------------------------------------------------------------- éxito

Deno.test('201: el coach genera un borrador para su socio', async () => {
  const { handler, spy } = setup();
  const res = await call(handler, post());

  assertEquals(res.status, 201);
  assertEquals(res.body.plan_id, 'plan-1');
  assertEquals(res.body.status, 'draft');
  assertEquals(typeof res.body.needs_review, 'boolean');
  assertEquals(res.headers.get('Access-Control-Allow-Origin'), '*');

  const saved = spy.saved[0];
  assert(saved);
  assertEquals(saved.clientId, CLIENT_ID);
  assertEquals(saved.model, 'claude-sonnet-5-5');
  assertEquals(saved.draft.plan.meals.map((m) => m.slot), ['desayuno', 'almuerzo', 'cena']);
  assertEquals(saved.draft.totals.target, DAILY);
});

Deno.test('los alimentos excluidos no llegan a la IA (ni sistema, ni prompt, ni esquema)', async () => {
  const { handler, spy } = setup();
  await call(handler, post());
  const sent = spy.prompts[0];
  assert(sent);
  const everything = [sent.system, sent.prompt, JSON.stringify(sent.schema)].join('\n').toLowerCase();
  assertFalse(everything.includes('aguacate'));
});

Deno.test('los orígenes que excluye la forma dietética no llegan a la IA', async () => {
  const vegetariana = {
    ...PLAN_OK,
    almuerzo: {
      ...PLAN_OK.almuerzo!,
      items: PLAN_OK.almuerzo!.items.filter((i) => i.food_id !== 'pechuga_pollo_cocida'),
    },
  };
  const { handler, spy } = setup(
    { loadClient: () => Promise.resolve({ ...CLIENT, excludedOrigins: ['carne'] }) },
    { ok: true, json: vegetariana, model: 'claude-sonnet-5-5' },
  );
  const res = await call(handler, post());
  const sent = spy.prompts[0];
  assert(sent);
  assertFalse(JSON.stringify(sent.schema).includes('pechuga_pollo_cocida'));
  assertFalse(sent.prompt.includes('Pechuga'));
  // La cena del plan de ejemplo lleva pollo: la validación lo rechaza aunque la IA lo devolviera
  assertEquals(res.body, { error: 'ai_generation_failed', reason: 'invalid_plan' });
});

Deno.test('guarda el modelo que respondió de verdad', async () => {
  const { handler, spy } = setup({}, { ok: true, json: PLAN_OK, model: 'claude-sonnet-5' });
  await call(handler, post());
  assertEquals(spy.saved[0]?.model, 'claude-sonnet-5');
});

// ---------------------------------------------------------------- HTTP y autenticación

Deno.test('OPTIONS responde el preflight de CORS y otros métodos dan 405', async () => {
  const { handler } = setup();
  const preflight = await handler(new Request('http://localhost/', { method: 'OPTIONS' }));
  assertEquals(preflight.status, 204);
  assert(preflight.headers.get('Access-Control-Allow-Headers')?.includes('authorization'));
  assertEquals((await call(handler, new Request('http://localhost/', { method: 'GET' }))).status, 405);
});

Deno.test('401 sin token o con un token inválido', async () => {
  const { handler, spy } = setup();
  assertEquals((await call(handler, post(undefined, null))).body, { error: 'unauthorized' });
  assertEquals((await call(handler, post(undefined, 'Bearer otro'))).status, 401);
  assertEquals(spy.prompts.length, 0);
});

Deno.test('400 si el body no es JSON o client_id no es un uuid', async () => {
  const { handler } = setup();
  assertEquals((await call(handler, post('{no es json'))).body, { error: 'invalid_body' });
  assertEquals((await call(handler, post({ client_id: 'abc' }))).status, 400);
  assertEquals((await call(handler, post({}))).status, 400);
});

Deno.test('403 si quien llama no es el coach de ese socio (también si el socio no existe)', async () => {
  const { handler, spy } = setup();
  const otro = await call(handler, post({ client_id: '00000000-0000-4000-8000-000000000000' }));
  assertEquals(otro.status, 403);
  assertEquals(otro.body, { error: 'forbidden' });

  const sinPerfil = setup({ loadClient: () => Promise.resolve(null) });
  assertEquals((await call(sinPerfil.handler, post())).status, 403);
  assertEquals(spy.prompts.length, 0);
});

// ---------------------------------------------------------------- requisitos

Deno.test('409 sin consentimiento de datos de salud (Ley 172-13)', async () => {
  const { handler, spy } = setup({ loadClient: () => Promise.resolve({ ...CLIENT, consentAt: null }) });
  assertEquals((await call(handler, post())).body, { error: 'consent_required' });
  assertEquals(spy.prompts.length, 0);
});

Deno.test('409 si el coach aún no ha fijado los objetivos', async () => {
  const { handler, spy } = setup({ loadClient: () => Promise.resolve({ ...CLIENT, targets: null }) });
  assertEquals((await call(handler, post())).body, { error: 'targets_required' });
  assertEquals(spy.prompts.length, 0);
});

Deno.test('409 si no queda ningún alimento tras las exclusiones', async () => {
  const { handler } = setup({
    loadClient: () => Promise.resolve({ ...CLIENT, excludedFoodIds: FOODS.map((f) => f.id) }),
  });
  assertEquals((await call(handler, post())).body, { error: 'empty_catalog' });
});

Deno.test('429 con Retry-After si hubo un plan hace menos de 10 minutos', async () => {
  const { handler, spy } = setup({ lastPlanCreatedAt: () => Promise.resolve(new Date(NOW.getTime() - 4 * 60_000)) });
  const res = await call(handler, post());
  assertEquals(res.status, 429);
  assertEquals(res.body, { error: 'too_many_requests', retry_after_s: 360 });
  assertEquals(res.headers.get('Retry-After'), '360');
  assertEquals(spy.prompts.length, 0);

  const pasado = setup({ lastPlanCreatedAt: () => Promise.resolve(new Date(NOW.getTime() - RATE_LIMIT_MS)) });
  assertEquals((await call(pasado.handler, post())).status, 201);
});

// ---------------------------------------------------------------- fallos de la IA

Deno.test('502 si el modelo rechaza la petición; no se guarda nada', async () => {
  const { handler, spy } = setup({}, { ok: false, reason: 'refusal', detail: 'general_harms' });
  const res = await call(handler, post());
  assertEquals(res.status, 502);
  assertEquals(res.body, { error: 'ai_generation_failed', reason: 'refusal' });
  assertEquals(spy.saved.length, 0);
  assertEquals(spy.errors[0]?.detail.reason, 'refusal');
});

Deno.test('502 invalid_plan si la IA usa un alimento excluido; no se guarda nada', async () => {
  const { handler, spy } = setup({}, { ok: true, json: AI_PLAN, model: 'claude-sonnet-5-5' });
  const res = await call(handler, post());
  assertEquals(res.body, { error: 'ai_generation_failed', reason: 'invalid_plan' });
  assertEquals(spy.saved.length, 0);
  assert(String(spy.errors[0]?.detail.detail).includes('cena.items.2.food_id'));
});

Deno.test('502 invalid_plan si la IA se salta una comida', async () => {
  const { cena: _c, ...sinCena } = PLAN_OK;
  const { handler } = setup({}, { ok: true, json: sinCena, model: 'claude-sonnet-5-5' });
  assertEquals((await call(handler, post())).body.reason, 'invalid_plan');
});

// ---------------------------------------------------------------- errores inesperados

Deno.test('500 internal_error si falla la base de datos, sin filtrar el mensaje', async () => {
  const { handler, spy } = setup({ saveDraft: () => Promise.reject(new Error('diet_plans insert: secreto')) });
  const res = await call(handler, post());
  assertEquals(res.status, 500);
  assertEquals(res.body, { error: 'internal_error' });
  assertEquals(spy.errors[0]?.event, 'unexpected_error');
});
