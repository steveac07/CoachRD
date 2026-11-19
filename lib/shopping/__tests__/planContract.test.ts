// Contrato con la Edge Function generate-diet-plan: el JSON que guarda en `diet_plans.plan`
// lo genera y comprueba su propio test (supabase/functions/generate-diet-plan/plan_test.ts).
// Aquí se comprueba que la lista de compra lo entiende.
import draftPlan from '../../../supabase/functions/generate-diet-plan/fixtures/draft-plan.json';
import { menuFromPlanJson } from '../index';

describe('contrato con generate-diet-plan', () => {
  it('lee todos los alimentos y gramos del plan que guarda la Edge Function', () => {
    expect(menuFromPlanJson(draftPlan)).toEqual([
      { foodId: 'platano_verde_hervido', grams: 200 },
      { foodId: 'huevo_entero', grams: 100 },
      { foodId: 'arroz_blanco_cocido', grams: 180 },
      { foodId: 'habichuelas_rojas_cocidas', grams: 130 },
      { foodId: 'pechuga_pollo_cocida', grams: 160 },
      { foodId: 'ensalada_verde', grams: 150 },
      { foodId: 'pechuga_pollo_cocida', grams: 150 },
      { foodId: 'ensalada_verde', grams: 200 },
      { foodId: 'aguacate', grams: 105 },
    ]);
  });
});
