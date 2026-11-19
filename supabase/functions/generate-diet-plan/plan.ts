// Dominio del generador de planes: sin red, sin Supabase y sin SDK de Anthropic.
// La IA solo propone platos (alimentos del catálogo + gramos). Aquí se fijan las comidas del
// día, se valida lo que propone y se calculan los macros.

import { z } from '../_shared/deps.ts';
import {
  deviation,
  type Food,
  householdMeasure,
  MACRO_KEYS,
  type MacroKey,
  type Macros,
  macrosForPortion,
  roundMacros,
  scaleMacros,
  sumMacros,
} from '../_shared/nutrition.ts';

// ---------------------------------------------------------------------------
// Comidas del día (las mismas que la demo aprobada)
// ---------------------------------------------------------------------------

export const SLOT_IDS = [
  'desayuno',
  'media_manana',
  'almuerzo',
  'merienda',
  'pre_entreno',
  'post_entreno',
  'cena',
] as const;
export type SlotId = (typeof SLOT_IDS)[number];

export const SLOT_LABELS: Record<SlotId, string> = {
  desayuno: 'Desayuno',
  media_manana: 'Media mañana',
  almuerzo: 'Almuerzo',
  merienda: 'Merienda',
  pre_entreno: 'Pre-entreno',
  post_entreno: 'Post-entreno',
  cena: 'Cena',
};

/** Peso relativo de cada comida en el reparto del día. */
const SLOT_WEIGHTS: Record<SlotId, number> = {
  desayuno: 25,
  media_manana: 10,
  almuerzo: 32,
  merienda: 12,
  pre_entreno: 12,
  post_entreno: 14,
  cena: 23,
};

const SLOTS_BY_MEALS: Readonly<Record<number, readonly SlotId[]>> = {
  3: ['desayuno', 'almuerzo', 'cena'],
  4: ['desayuno', 'almuerzo', 'merienda', 'cena'],
  5: ['desayuno', 'media_manana', 'almuerzo', 'pre_entreno', 'cena'],
  6: ['desayuno', 'media_manana', 'almuerzo', 'pre_entreno', 'post_entreno', 'cena'],
};

/** Comidas del día según `client_profiles.meals_per_day` (3 a 6). Null si el número no es válido. */
export function slotsFor(mealsPerDay: number): readonly SlotId[] | null {
  return SLOTS_BY_MEALS[mealsPerDay] ?? null;
}

export type MealTarget = {
  slot: SlotId;
  target: Macros;
};

/** Reparte el objetivo del día entre las comidas según su peso. */
export function mealTargets(daily: Macros, slots: readonly SlotId[]): MealTarget[] {
  const total = slots.reduce((sum, slot) => sum + SLOT_WEIGHTS[slot], 0);
  return slots.map((slot) => ({ slot, target: roundMacros(scaleMacros(daily, SLOT_WEIGHTS[slot] / total)) }));
}

// ---------------------------------------------------------------------------
// Catálogo permitido
// ---------------------------------------------------------------------------

/** Quita del catálogo los alimentos excluidos para el socio. Se aplica ANTES de llamar a la IA. */
export function allowedFoods(foods: readonly Food[], excludedIds: readonly string[]): Food[] {
  const excluded = new Set(excludedIds);
  return foods.filter((food) => !excluded.has(food.id));
}

// ---------------------------------------------------------------------------
// Contrato con la IA: un plato por comida, solo ids del catálogo y gramos
// ---------------------------------------------------------------------------

export const GRAMS_STEP = 5;
export const MAX_GRAMS_PER_ITEM = 800;
export const MAX_ITEMS_PER_MEAL = 8;

export interface AiItem {
  food_id: string;
  grams: number;
}

export interface AiMeal {
  dish_name: string;
  prep_tip: string;
  items: AiItem[];
}

export type AiPlan = Partial<Record<SlotId, AiMeal>>;

/**
 * JSON Schema para `output_config.format`. Las comidas son propiedades obligatorias (no una lista):
 * así la IA no puede saltarse ni inventar comidas. `food_id` es un enum del catálogo permitido.
 * Los rangos (gramos, longitudes) los valida `parseAiPlan` después.
 */
export function aiPlanJsonSchema(slots: readonly SlotId[], foodIds: readonly string[]): Record<string, unknown> {
  const meal = {
    type: 'object',
    additionalProperties: false,
    required: ['dish_name', 'items', 'prep_tip'],
    properties: {
      dish_name: { type: 'string' },
      prep_tip: { type: 'string' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['food_id', 'grams'],
          properties: {
            food_id: { type: 'string', enum: [...foodIds] },
            grams: { type: 'integer' },
          },
        },
      },
    },
  };
  return {
    type: 'object',
    additionalProperties: false,
    required: [...slots],
    properties: Object.fromEntries(slots.map((slot) => [slot, meal])),
  };
}

export type ParseResult = { ok: true; plan: AiPlan } | { ok: false; issues: string[] };

/** Segunda barrera: valida la respuesta de la IA contra las comidas y el catálogo permitido. */
export function parseAiPlan(raw: unknown, slots: readonly SlotId[], foodIds: readonly string[]): ParseResult {
  const [first, ...rest] = foodIds;
  if (first === undefined) return { ok: false, issues: ['catálogo vacío'] };

  const item = z.object({
    food_id: z.enum([first, ...rest]),
    grams: z.number().int().positive().max(MAX_GRAMS_PER_ITEM),
  });
  const meal = z.object({
    dish_name: z.string().trim().min(2).max(80),
    prep_tip: z.string().trim().max(240),
    items: z.array(item).min(1).max(MAX_ITEMS_PER_MEAL),
  });
  const schema = z.strictObject(Object.fromEntries(slots.map((slot) => [slot, meal])));

  const result = schema.safeParse(raw);
  if (!result.success) {
    return { ok: false, issues: result.error.issues.map((i) => `${i.path.join('.') || '(raíz)'}: ${i.message}`) };
  }
  return { ok: true, plan: result.data };
}

// ---------------------------------------------------------------------------
// Borrador: macros calculados por código
// ---------------------------------------------------------------------------

/** Fuera de ±10 % en cualquier macro, el plan se marca para revisión del coach. */
export const MAX_DEVIATION_PCT = 10;

export type DraftItem = {
  food_id: string;
  name: string;
  grams: number;
  household: string | null;
  macros: Macros;
};

export type DraftMeal = {
  slot: SlotId;
  label: string;
  dish_name: string;
  prep_tip: string;
  items: DraftItem[];
  macros: Macros;
  target: Macros;
};

export type Draft = {
  /** `diet_plans.plan`. Lo lee `menuFromPlanJson` (lista de compra): `{ meals: [{ items: [{ food_id, grams }] }] }`. */
  plan: { meals: DraftMeal[] };
  /** `diet_plans.totals` */
  totals: Macros & { target: Macros };
  /** `diet_plans.deviation` */
  deviation: Record<MacroKey, number> & { needs_review: boolean; flagged: MacroKey[] };
};

export type DraftResult = { ok: true; draft: Draft } | {
  ok: false;
  reason: 'missing_meal' | 'food_not_allowed';
  detail: string;
};

/** Gramos en múltiplos de 5, nunca por debajo de 5. */
export function normalizeGrams(grams: number): number {
  return Math.max(GRAMS_STEP, Math.round(grams / GRAMS_STEP) * GRAMS_STEP);
}

/**
 * Construye el borrador a partir del plan de la IA. Vuelve a comprobar que cada alimento está en
 * el catálogo permitido (exclusiones incluidas) aunque el esquema ya lo imponga.
 */
export function buildDraft(
  aiPlan: AiPlan,
  targets: readonly MealTarget[],
  allowed: readonly Food[],
  daily: Macros,
): DraftResult {
  const byId = new Map(allowed.map((food) => [food.id, food]));
  const meals: DraftMeal[] = [];

  for (const { slot, target } of targets) {
    const aiMeal = aiPlan[slot];
    if (!aiMeal) return { ok: false, reason: 'missing_meal', detail: slot };

    const items: DraftItem[] = [];
    for (const { food_id, grams } of aiMeal.items) {
      const food = byId.get(food_id);
      if (!food) return { ok: false, reason: 'food_not_allowed', detail: food_id };
      const g = normalizeGrams(grams);
      items.push({
        food_id,
        name: food.name,
        grams: g,
        household: householdMeasure(food, g),
        macros: roundMacros(macrosForPortion(food, g)),
      });
    }

    meals.push({
      slot,
      label: SLOT_LABELS[slot],
      dish_name: aiMeal.dish_name.trim(),
      prep_tip: aiMeal.prep_tip.trim(),
      items,
      macros: roundMacros(sumMacros(items.map((i) => i.macros))),
      target,
    });
  }

  const totals = roundMacros(sumMacros(meals.map((m) => m.macros)));
  const dev = deviation(totals, daily);
  const flagged = MACRO_KEYS.filter((key) => Math.abs(dev[key]) > MAX_DEVIATION_PCT);

  return {
    ok: true,
    draft: {
      plan: { meals },
      totals: { ...totals, target: daily },
      deviation: { ...dev, needs_review: flagged.length > 0, flagged },
    },
  };
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

export const SYSTEM_PROMPT =
  `Eres el motor de planificación de CoachRD. Un coach o nutricionista de República Dominicana revisa cada plan antes de que el socio lo vea.
Construyes menús de comida dominicana real, solo con los alimentos del catálogo que recibes (el catálogo ya excluye lo que el socio no puede comer), en versiones de cocción ligera: hervido, horneado, air fryer, guisado con sofrito natural. Nada frito por inmersión.
Reglas:
- Prepara exactamente las comidas pedidas, un plato por comida.
- Usa solo los food_id del catálogo recibido.
- Indica los gramos en peso cocido, en múltiplos de 5.
- Ajusta los gramos para acercarte al objetivo de cada comida (±5 %). El sistema calcula los macros; no los incluyas.
- dish_name: nombre corto del plato, como lo diría alguien en RD.
- prep_tip: una frase práctica en español dominicano neutro y en positivo.
- No des consejos médicos ni diagnósticos.`;

const GOAL_LABELS: Record<string, string> = {
  perdida_grasa: 'pérdida de grasa',
  recomposicion: 'recomposición corporal',
  ganancia_muscular: 'ganancia muscular',
};

const formatMacros = (m: Macros) => `${m.kcal} kcal | P ${m.protein_g} g | C ${m.carbs_g} g | G ${m.fat_g} g`;

export function buildUserPrompt(input: {
  daily: Macros;
  goal: string;
  targets: readonly MealTarget[];
  catalog: readonly Food[];
}): string {
  return [
    `Objetivo del día: ${formatMacros(input.daily)}`,
    `Meta del socio: ${GOAL_LABELS[input.goal] ?? input.goal}.`,
    '',
    'Comidas y objetivo de cada una:',
    ...input.targets.map(({ slot, target }) => `- ${slot} (${SLOT_LABELS[slot]}): ${formatMacros(target)}`),
    '',
    'Catálogo (food_id · nombre · grupo · por 100 g cocidos: kcal/P/C/G):',
    ...input.catalog.map(
      (f) => `${f.id} · ${f.name} · ${f.category} · ${f.kcal_100g}/${f.protein_100g}/${f.carbs_100g}/${f.fat_100g}`,
    ),
  ].join('\n');
}
