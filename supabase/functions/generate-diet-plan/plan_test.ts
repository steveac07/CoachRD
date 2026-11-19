import { assert, assertEquals, assertFalse } from '../_shared/test_deps.ts';
import {
  aiPlanJsonSchema,
  allowedFoods,
  buildDraft,
  buildUserPrompt,
  type Draft,
  MAX_DEVIATION_PCT,
  mealTargets,
  normalizeGrams,
  parseAiPlan,
  slotsFor,
} from './plan.ts';
import { AI_PLAN, DAILY, FOODS } from './test_fixtures.ts';

const SLOTS_3 = slotsFor(3) ?? [];
const IDS = FOODS.map((f) => f.id);

function draftOf(plan = AI_PLAN, foods = FOODS): Draft {
  const result = buildDraft(plan, mealTargets(DAILY, SLOTS_3), foods, DAILY);
  if (!result.ok) throw new Error(`buildDraft falló: ${result.reason} ${result.detail}`);
  return result.draft;
}

// ---------------------------------------------------------------- comidas

Deno.test('slotsFor usa las comidas de la demo según meals_per_day', () => {
  assertEquals(slotsFor(3), ['desayuno', 'almuerzo', 'cena']);
  assertEquals(slotsFor(4), ['desayuno', 'almuerzo', 'merienda', 'cena']);
  assertEquals(slotsFor(5), ['desayuno', 'media_manana', 'almuerzo', 'pre_entreno', 'cena']);
  assertEquals(slotsFor(6), ['desayuno', 'media_manana', 'almuerzo', 'pre_entreno', 'post_entreno', 'cena']);
  assertEquals(slotsFor(2), null);
  assertEquals(slotsFor(7), null);
});

Deno.test('mealTargets reparte el día por pesos y la suma cuadra con el objetivo', () => {
  const targets = mealTargets(DAILY, SLOTS_3);
  // pesos 25 / 32 / 23 sobre 80
  assertEquals(targets[0]?.target.kcal, Math.round(1800 * 25 / 80));
  assertEquals(targets[1]?.target.kcal, Math.round(1800 * 32 / 80));
  const kcal = targets.reduce((sum, t) => sum + t.target.kcal, 0);
  assert(Math.abs(kcal - DAILY.kcal) <= 2, `suma ${kcal}`);
});

// ---------------------------------------------------------------- catálogo

Deno.test('allowedFoods quita las exclusiones del socio', () => {
  const ids = allowedFoods(FOODS, ['aguacate', 'huevo_entero']).map((f) => f.id);
  assertFalse(ids.includes('aguacate'));
  assertFalse(ids.includes('huevo_entero'));
  assertEquals(ids.length, FOODS.length - 2);
});

Deno.test('allowedFoods quita también los orígenes que excluye la forma dietética', () => {
  const ids = allowedFoods(FOODS, [], ['carne', 'huevo']).map((f) => f.id);
  assertFalse(ids.includes('pechuga_pollo_cocida'));
  assertFalse(ids.includes('huevo_entero'));
  assert(ids.includes('arroz_blanco_cocido'));
  assertEquals(ids.length, FOODS.length - 2);
});

Deno.test('el esquema obliga a todas las comidas y limita food_id al catálogo permitido', () => {
  const allowed = allowedFoods(FOODS, ['aguacate']).map((f) => f.id);
  const schema = aiPlanJsonSchema(SLOTS_3, allowed);
  assertEquals(schema.required, ['desayuno', 'almuerzo', 'cena']);
  assertEquals(schema.additionalProperties, false);
  const text = JSON.stringify(schema);
  assertFalse(text.includes('aguacate'));
  assert(text.includes('pechuga_pollo_cocida'));
});

Deno.test('el prompt no lleva los alimentos excluidos y sí los objetivos por comida', () => {
  const catalog = allowedFoods(FOODS, ['aguacate']);
  const prompt = buildUserPrompt({
    daily: DAILY,
    goal: 'perdida_grasa',
    targets: mealTargets(DAILY, SLOTS_3),
    catalog,
  });
  assertFalse(prompt.includes('aguacate'));
  assert(prompt.includes('pérdida de grasa'));
  assert(prompt.includes('- almuerzo (Almuerzo): 720 kcal'));
});

// ---------------------------------------------------------------- validación

Deno.test('parseAiPlan acepta un plan correcto', () => {
  const result = parseAiPlan(AI_PLAN, SLOTS_3, IDS);
  assert(result.ok);
});

Deno.test('parseAiPlan rechaza alimentos fuera del catálogo permitido', () => {
  const allowed = IDS.filter((id) => id !== 'aguacate');
  const result = parseAiPlan(AI_PLAN, SLOTS_3, allowed);
  assertFalse(result.ok);
  if (!result.ok) assert(result.issues.some((i) => i.startsWith('cena.items.2.food_id')), result.issues.join('\n'));
});

Deno.test('parseAiPlan rechaza comidas que faltan o que sobran', () => {
  const { cena: _cena, ...sinCena } = AI_PLAN;
  assertFalse(parseAiPlan(sinCena, SLOTS_3, IDS).ok);
  assertFalse(parseAiPlan({ ...AI_PLAN, merienda: AI_PLAN.cena }, SLOTS_3, IDS).ok);
});

Deno.test('parseAiPlan rechaza gramos no enteros, negativos o por encima de 800', () => {
  for (const grams of [12.5, -10, 0, 900]) {
    const plan = { ...AI_PLAN, cena: { ...AI_PLAN.cena!, items: [{ food_id: 'pechuga_pollo_cocida', grams }] } };
    assertFalse(parseAiPlan(plan, SLOTS_3, IDS).ok, `${grams} g`);
  }
});

Deno.test('parseAiPlan rechaza basura', () => {
  assertFalse(parseAiPlan(null, SLOTS_3, IDS).ok);
  assertFalse(parseAiPlan('plan', SLOTS_3, IDS).ok);
  assertFalse(parseAiPlan(AI_PLAN, SLOTS_3, []).ok);
});

// ---------------------------------------------------------------- borrador

Deno.test('buildDraft calcula macros por código y redondea gramos a múltiplos de 5', () => {
  const draft = draftOf();
  const cena = draft.plan.meals[2];
  assertEquals(cena?.slot, 'cena');
  assertEquals(cena?.label, 'Cena');
  // 103 g de aguacate -> 105 g
  assertEquals(cena?.items[2], {
    food_id: 'aguacate',
    name: 'Aguacate',
    grams: 105,
    household: null,
    macros: { kcal: 168, protein_g: 2.1, carbs_g: 8.9, fat_g: 15.4 },
  });
  assertEquals(draft.totals.target, DAILY);
});

Deno.test('normalizeGrams nunca baja de 5 g', () => {
  assertEquals(normalizeGrams(1), 5);
  assertEquals(normalizeGrams(102), 100);
  assertEquals(normalizeGrams(103), 105);
});

Deno.test('buildDraft vuelve a comprobar el catálogo permitido aunque la IA se lo salte', () => {
  const result = buildDraft(AI_PLAN, mealTargets(DAILY, SLOTS_3), allowedFoods(FOODS, ['aguacate']), DAILY);
  assertEquals(result, { ok: false, reason: 'food_not_allowed', detail: 'aguacate' });
});

Deno.test('buildDraft falla si falta una comida', () => {
  const { almuerzo: _a, ...plan } = AI_PLAN;
  assertEquals(buildDraft(plan, mealTargets(DAILY, SLOTS_3), FOODS, DAILY), {
    ok: false,
    reason: 'missing_meal',
    detail: 'almuerzo',
  });
});

Deno.test(`buildDraft marca para revisión si un macro se desvía más de ${MAX_DEVIATION_PCT} %`, () => {
  const draft = draftOf();
  const flagged = (['kcal', 'protein_g', 'carbs_g', 'fat_g'] as const).filter(
    (k) => Math.abs(draft.deviation[k]) > MAX_DEVIATION_PCT,
  );
  assertEquals(draft.deviation.flagged, flagged);
  assertEquals(draft.deviation.needs_review, flagged.length > 0);

  // Un plan que clava el objetivo no se marca
  const exact = buildDraft(AI_PLAN, mealTargets(DAILY, SLOTS_3), FOODS, draft.totals);
  assert(exact.ok);
  if (exact.ok) {
    assertEquals(exact.draft.deviation.flagged, []);
    assertFalse(exact.draft.deviation.needs_review);
  }
});

// ---------------------------------------------------------------- contrato con la app

Deno.test('el plan guardado coincide con el contrato que lee la lista de compra (fixtures/draft-plan.json)', async () => {
  const fixture: unknown = JSON.parse(await Deno.readTextFile(new URL('./fixtures/draft-plan.json', import.meta.url)));
  assertEquals(JSON.parse(JSON.stringify(draftOf().plan)), fixture);
});
