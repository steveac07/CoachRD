import {
  ageOn,
  type AssessmentDraft,
  clientName,
  type ClientProfile,
  type DietForm,
  draftFromAssessment,
  parseNumber,
  preview,
  saveArgs,
  saveBlockers,
  validateDraft,
} from '../assessment';
import { draftReadyMessage, generateErrorMessage, joinEs } from '../generateMessages';

const PROFILE: ClientProfile = {
  user_id: 'socia-1',
  display_name: 'Andrea Álvarez',
  sex: 'F',
  birth_date: '1995-05-10',
  height_cm: 165,
  weight_kg: 70,
  activity_level: 'moderado',
  goal: 'perdida_grasa',
  meals_per_day: 4,
  consent_health_data_at: '2026-11-01T10:00:00Z',
};

const FORM: DietForm = {
  id: 'forma-def',
  coach_id: 'coach-1',
  name: 'Definición criolla',
  kcal_adjust_pct: -20,
  protein_g_per_kg_lbm: 2.4,
  fat_pct: 25,
  meals_per_day: 4,
  excluded_origins: [],
  note: '',
  created_at: '2026-11-19T10:00:00Z',
  updated_at: '2026-11-19T10:00:00Z',
};

const DRAFT: AssessmentDraft = {
  dietFormId: FORM.id,
  bodyFatPct: '30',
  targetBodyFatPct: '24',
  leanGainKg: '1',
  weeks: '16',
  kcalAdjust: '0',
};

function values(draft: AssessmentDraft = DRAFT) {
  const result = validateDraft(draft);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.values;
}

describe('parseNumber', () => {
  it('admite coma o punto decimal y espacios', () => {
    expect(parseNumber('24,5')).toBe(24.5);
    expect(parseNumber(' 24.5 ')).toBe(24.5);
    expect(parseNumber('-100')).toBe(-100);
  });
  it('rechaza lo que no es un número', () => {
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('veinte')).toBeNull();
    expect(parseNumber('1e3')).toBeNull();
    expect(parseNumber('12,5,1')).toBeNull();
  });
});

describe('validateDraft', () => {
  it('convierte un formulario correcto', () => {
    expect(values({ ...DRAFT, bodyFatPct: '30,5' })).toEqual({
      dietFormId: FORM.id,
      bodyFatPct: 30.5,
      targetBodyFatPct: 24,
      leanGainKg: 1,
      weeks: 16,
      kcalAdjust: 0,
    });
  });

  it('explica cada error con los rangos de la base de datos', () => {
    const result = validateDraft({ ...DRAFT, bodyFatPct: '', targetBodyFatPct: '70', weeks: '12,5', kcalAdjust: 'mucho' });
    expect(result).toEqual({
      ok: false,
      errors: {
        bodyFatPct: 'Falta este dato.',
        targetBodyFatPct: 'Entre 3 y 60 %.',
        weeks: 'Escribe un número entero.',
        kcalAdjust: 'Escribe un número.',
      },
    });
  });
});

describe('draftFromAssessment', () => {
  it('propone valores de partida para un socio nuevo', () => {
    expect(draftFromAssessment(null)).toEqual({
      dietFormId: null,
      bodyFatPct: '',
      targetBodyFatPct: '',
      leanGainKg: '0',
      weeks: '12',
      kcalAdjust: '0',
    });
  });
  it('muestra los decimales con coma', () => {
    const draft = draftFromAssessment({
      user_id: 'socia-1',
      diet_form_id: FORM.id,
      body_fat_pct: 29.5,
      target_body_fat_pct: 24,
      lean_gain_kg: 1.5,
      weeks: 16,
      kcal_adjust: -100,
      updated_by: 'coach-1',
      updated_at: '2026-11-19T10:00:00Z',
    });
    expect(draft.bodyFatPct).toBe('29,5');
    expect(draft.leanGainKg).toBe('1,5');
    expect(draft.kcalAdjust).toBe('-100');
  });
});

describe('preview y guardado', () => {
  it('calcula con los datos del perfil y la forma (caso «pérdida en plazo» de la demo)', () => {
    const result = preview(PROFILE, values(), FORM);
    expect(result.targets).toEqual({ kcal: 1771, protein_g: 118, carbs_g: 215, fat_g: 49 });
    expect(result.status.label).toBe('En plazo');
    expect(saveBlockers(result, FORM)).toEqual([]);
  });

  it('sin forma dietética no se puede guardar', () => {
    const result = preview(PROFILE, values({ ...DRAFT, dietFormId: null }), null);
    expect(result.targets).toBeNull();
    expect(saveBlockers(result, null)).toEqual(['Elige una forma dietética.']);
  });

  it('no deja guardar objetivos fuera de los rangos de nutrition_targets', () => {
    const pequeña = { ...PROFILE, weight_kg: 52, height_cm: 150, activity_level: 'sedentario' };
    const result = preview(pequeña, values({ ...DRAFT, bodyFatPct: '28', targetBodyFatPct: '22', kcalAdjust: '-300' }), FORM);
    expect(saveBlockers(result, FORM)).toEqual(['Calorías: 832 kcal, el mínimo es 1,000 kcal.']);
  });

  it('guarda las comidas al día de la forma dietética', () => {
    const v = values();
    const result = preview(PROFILE, v, FORM);
    expect(result.targets).not.toBeNull();
    if (!result.targets) return;
    expect(saveArgs('socia-1', v, result.targets, { ...FORM, meals_per_day: 5 })).toMatchObject({
      p_client: 'socia-1',
      p_diet_form_id: FORM.id,
      p_kcal: 1771,
      p_meals_per_day: 5,
    });
  });
});

describe('ageOn y clientName', () => {
  it('calcula la edad cumplida', () => {
    expect(ageOn('1995-05-10', new Date(2026, 4, 9))).toBe(30);
    expect(ageOn('1995-05-10', new Date(2026, 4, 10))).toBe(31);
  });
  it('usa un nombre por defecto si el socio no lo ha puesto', () => {
    expect(clientName({ display_name: '  ' })).toBe('Socio sin nombre');
    expect(clientName({ display_name: 'Andrea Álvarez' })).toBe('Andrea Álvarez');
  });
});

describe('generateErrorMessage', () => {
  it('traduce cada código de la Edge Function a un mensaje para el coach', () => {
    expect(generateErrorMessage(409, { error: 'targets_required' })).toBe('Guarda primero los objetivos y después genera el plan.');
    expect(generateErrorMessage(429, { error: 'too_many_requests', retry_after_s: 61 })).toBe(
      'Ya generaste un plan hace poco. Podrás pedir otro en 2 minutos.',
    );
    expect(generateErrorMessage(429, { error: 'too_many_requests', retry_after_s: 30 })).toBe(
      'Ya generaste un plan hace poco. Podrás pedir otro en 1 minuto.',
    );
    expect(generateErrorMessage(502, { error: 'ai_generation_failed', reason: 'invalid_plan' })).toContain('se descartó');
    expect(generateErrorMessage(500, null)).toBe('El generador no está disponible ahora mismo. Prueba otra vez en unos minutos.');
    expect(generateErrorMessage(null, null)).toBe('No se pudo generar el plan. Prueba otra vez.');
  });
});

describe('draftReadyMessage', () => {
  it('enumera los macros a revisar en buen español', () => {
    expect(joinEs(['calorías', 'carbohidratos', 'grasa'])).toBe('calorías, carbohidratos y grasa');
    expect(draftReadyMessage(['kcal', 'carbs_g', 'fat_g'])).toBe(
      'Borrador listo. Revisa calorías, carbohidratos y grasa: se alejan más del 10 % del objetivo.',
    );
    expect(draftReadyMessage(['fat_g'])).toBe('Borrador listo. Revisa grasa: se aleja más del 10 % del objetivo.');
    expect(draftReadyMessage([])).toContain('dentro del ±10 %');
  });
});
