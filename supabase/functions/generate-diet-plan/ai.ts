// Adaptador de Claude. Solo pide el JSON y comprueba cómo terminó la respuesta: validar el plan
// y calcular macros es cosa de `plan.ts`.

import { Anthropic } from '../_shared/deps.ts';

export const DEFAULT_MODEL = 'claude-sonnet-5-5';
const MAX_TOKENS = 16_000;
// Si un clasificador de seguridad rechaza la petición, la API la reintenta en el modelo que
// Anthropic recomienda para esa categoría, dentro de la misma llamada.
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

export interface PlanRequest {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
}

export type PlanFailure = 'refusal' | 'max_tokens' | 'no_text' | 'invalid_json' | 'api_error';

export type PlanResponse =
  | { ok: true; json: unknown; model: string }
  | { ok: false; reason: PlanFailure; detail?: string };

export type PlanGenerator = (request: PlanRequest) => Promise<PlanResponse>;

export function createClaudePlanGenerator(client: Anthropic, model: string = DEFAULT_MODEL): PlanGenerator {
  return async ({ system, prompt, schema }) => {
    let message: Anthropic.Beta.BetaMessage;
    try {
      message = await client.beta.messages.create({
        model,
        max_tokens: MAX_TOKENS,
        betas: [FALLBACK_BETA],
        fallbacks: 'default',
        system,
        messages: [{ role: 'user', content: prompt }],
        output_config: { format: { type: 'json_schema', schema } },
      });
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        return { ok: false, reason: 'api_error', detail: `${error.status ?? 'sin estado'} ${error.name}` };
      }
      throw error;
    }

    if (message.stop_reason === 'refusal') {
      return { ok: false, reason: 'refusal', detail: message.stop_details?.category ?? undefined };
    }
    if (message.stop_reason === 'max_tokens') {
      return { ok: false, reason: 'max_tokens' };
    }

    const text = message.content.find((block) => block.type === 'text');
    if (!text || text.type !== 'text') return { ok: false, reason: 'no_text' };

    try {
      // `message.model` es el modelo que respondió de verdad (puede ser el de respaldo).
      return { ok: true, json: JSON.parse(text.text), model: message.model };
    } catch {
      return { ok: false, reason: 'invalid_json' };
    }
  };
}
