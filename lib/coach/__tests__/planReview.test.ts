// planView lee el JSON que guarda la Edge Function: el mismo fixture que genera su test (contrato).
import draftPlan from '../../../supabase/functions/generate-diet-plan/fixtures/draft-plan.json';
import { PLAN_STATUS, planView, reviewErrorMessage } from '../planReview';

const TOTALS = { kcal: 1517, protein_g: 131.8, carbs_g: 164.7, fat_g: 38.4, target: { kcal: 1800, protein_g: 140, carbs_g: 180, fat_g: 55 } };
const DEVIATION = { kcal: -15.7, protein_g: -5.9, carbs_g: -8.5, fat_g: -30.2, needs_review: true, flagged: ['kcal', 'fat_g'] };

describe('planView', () => {
  it('lee las comidas, alimentos y macros del plan que guarda la Edge Function', () => {
    const view = planView(draftPlan, TOTALS, DEVIATION);
    expect(view.meals.map((m) => m.label)).toEqual(['Desayuno', 'Almuerzo', 'Cena']);
    expect(view.meals[0]).toMatchObject({
      slot: 'desayuno',
      dishName: 'Mangú con huevo',
      macros: { kcal: 375, protein_g: 14.2, carbs_g: 63.1, fat_g: 9.9 },
    });
    expect(view.meals[0]?.items[0]).toEqual({
      foodId: 'platano_verde_hervido',
      name: 'Plátano verde hervido (mangú sin grasa)',
      grams: 200,
      household: '1.25 unidad',
      macros: { kcal: 232, protein_g: 1.6, carbs_g: 62.4, fat_g: 0.4 },
    });
    expect(view.meals[2]?.items).toHaveLength(3);
    expect(view.meals.every((m) => m.target !== null)).toBe(true);
  });

  it('lee totales, objetivo y desviaciones', () => {
    const view = planView(draftPlan, TOTALS, DEVIATION);
    expect(view.totals).toEqual({ kcal: 1517, protein_g: 131.8, carbs_g: 164.7, fat_g: 38.4 });
    expect(view.target).toEqual({ kcal: 1800, protein_g: 140, carbs_g: 180, fat_g: 55 });
    expect(view.deviation).toEqual({ kcal: -15.7, protein_g: -5.9, carbs_g: -8.5, fat_g: -30.2 });
    expect(view.flagged).toEqual(['kcal', 'fat_g']);
    expect(view.needsReview).toBe(true);
  });

  it('es tolerante con lo que no tiene la forma esperada', () => {
    expect(planView(null, null, null)).toEqual({
      meals: [],
      totals: null,
      target: null,
      deviation: null,
      flagged: [],
      needsReview: false,
    });
    const view = planView(
      { meals: [null, { items: [{ food_id: 'arroz', grams: '200' }, { food_id: 'pollo', grams: 150 }] }] },
      { kcal: 'mucho' },
      { flagged: ['kcal', 'azúcar', 3] },
    );
    expect(view.meals).toHaveLength(1);
    expect(view.meals[0]?.items).toEqual([{ foodId: 'pollo', name: 'pollo', grams: 150, household: null, macros: null }]);
    expect(view.totals).toBeNull();
    expect(view.flagged).toEqual(['kcal']);
  });
});

describe('estados y errores de la revisión', () => {
  it('tiene etiqueta para cada estado del plan, también archivado', () => {
    expect(PLAN_STATUS.archived).toEqual({ label: 'Archivado', level: 'neutral' });
    expect(Object.keys(PLAN_STATUS).sort()).toEqual(['approved', 'archived', 'draft', 'rejected']);
  });

  it('traduce los códigos de review_diet_plan', () => {
    expect(reviewErrorMessage('55000')).toContain('ya se revisó');
    expect(reviewErrorMessage('42501')).toContain('no es de uno de tus socios');
    expect(reviewErrorMessage(null)).toContain('No se pudo guardar la revisión');
  });
});
