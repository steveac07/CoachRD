import { Anthropic } from '../_shared/deps.ts';
import { assert, assertEquals } from '../_shared/test_deps.ts';
import { createClaudePlanGenerator, DEFAULT_MODEL, type PlanRequest } from './ai.ts';

const REQUEST: PlanRequest = { system: 'sistema', prompt: 'prompt', schema: { type: 'object' } };

interface Captured {
  url: string;
  headers: Headers;
  body: Record<string, unknown>;
}

/** Cliente del SDK con un fetch falso: no sale a la red y guarda la petición. */
function fakeClient(status: number, payload: unknown): { client: Anthropic; captured: Captured[] } {
  const captured: Captured[] = [];
  const fetch = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const raw = typeof init?.body === 'string' ? init.body : '{}';
    captured.push({ url: String(input), headers: new Headers(init?.headers), body: JSON.parse(raw) });
    return Promise.resolve(
      new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } }),
    );
  };
  return {
    client: new Anthropic({ apiKey: 'test-key', baseURL: 'https://api.anthropic.test', fetch, maxRetries: 0 }),
    captured,
  };
}

function message(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    model: DEFAULT_MODEL,
    content: [{ type: 'text', text: '{"desayuno":{}}' }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    stop_details: null,
    usage: { input_tokens: 10, output_tokens: 20 },
    ...overrides,
  };
}

Deno.test('pide salida JSON con el esquema, fallbacks por defecto y el modelo configurado', async () => {
  const { client, captured } = fakeClient(200, message({}));
  await createClaudePlanGenerator(client, 'claude-opus-5-5')(REQUEST);

  const sent = captured[0];
  assert(sent, 'no se llamó a la API');
  assertEquals(new URL(sent.url).pathname, '/v1/messages');
  assertEquals(sent.headers.get('anthropic-beta'), 'server-side-fallback-2026-07-01');
  assertEquals(sent.body.model, 'claude-opus-5-5');
  assertEquals(sent.body.fallbacks, 'default');
  assertEquals(sent.body.system, 'sistema');
  assertEquals(sent.body.messages, [{ role: 'user', content: 'prompt' }]);
  assertEquals(sent.body.output_config, { format: { type: 'json_schema', schema: { type: 'object' } } });
  assertEquals(sent.body.max_tokens, 16_000);
  // Sin temperature/top_p/top_k ni thinking deshabilitado: rechazados en los modelos actuales
  for (const key of ['temperature', 'top_p', 'top_k', 'thinking']) assertEquals(sent.body[key], undefined, key);
});

Deno.test('devuelve el JSON y el modelo que respondió de verdad (puede ser el de respaldo)', async () => {
  const { client } = fakeClient(
    200,
    message({
      model: 'claude-sonnet-5',
      content: [{ type: 'thinking', thinking: '', signature: 'x' }, { type: 'text', text: '{"cena":{"items":[]}}' }],
    }),
  );
  const result = await createClaudePlanGenerator(client)(REQUEST);
  assertEquals(result, { ok: true, json: { cena: { items: [] } }, model: 'claude-sonnet-5' });
});

Deno.test('una negativa del modelo no se lee como plan', async () => {
  const { client } = fakeClient(
    200,
    message({
      content: [],
      stop_reason: 'refusal',
      stop_details: { type: 'refusal', category: 'general_harms', explanation: null },
    }),
  );
  assertEquals(await createClaudePlanGenerator(client)(REQUEST), {
    ok: false,
    reason: 'refusal',
    detail: 'general_harms',
  });
});

Deno.test('una respuesta cortada por max_tokens no se lee como plan', async () => {
  const { client } = fakeClient(200, message({ stop_reason: 'max_tokens', content: [{ type: 'text', text: '{"de' }] }));
  assertEquals(await createClaudePlanGenerator(client)(REQUEST), { ok: false, reason: 'max_tokens' });
});

Deno.test('sin bloque de texto o con JSON roto falla con su motivo', async () => {
  const sinTexto = fakeClient(200, message({ content: [] }));
  assertEquals(await createClaudePlanGenerator(sinTexto.client)(REQUEST), { ok: false, reason: 'no_text' });

  const roto = fakeClient(200, message({ content: [{ type: 'text', text: 'no es json' }] }));
  assertEquals(await createClaudePlanGenerator(roto.client)(REQUEST), { ok: false, reason: 'invalid_json' });
});

Deno.test('un error de la API se devuelve como api_error con su estado', async () => {
  const { client } = fakeClient(529, { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } });
  const result = await createClaudePlanGenerator(client)(REQUEST);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.reason, 'api_error');
    assert(result.detail?.startsWith('529'), result.detail);
  }
});
