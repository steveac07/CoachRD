// Ficha del socio: del formulario del coach (texto) a los datos del cálculo y lo que se guarda.
// Lógica pura, sin React ni Supabase.
import type { Tables } from '@/types/database';

import {
  activityFactor,
  type AssessmentInput,
  computeTargets,
  type DailyTargets,
  type DietFormRules,
  targetLimitProblems,
  type TargetsResult,
} from '@/lib/nutrition/targets';

export type ClientProfile = Pick<
  Tables<'client_profiles'>,
  'user_id' | 'display_name' | 'sex' | 'birth_date' | 'height_cm' | 'weight_kg' | 'activity_level' | 'goal' | 'meals_per_day' | 'consent_health_data_at'
>;
export type Assessment = Tables<'client_assessments'>;
export type DietForm = Tables<'diet_forms'>;

export type DraftField = 'bodyFatPct' | 'targetBodyFatPct' | 'leanGainKg' | 'weeks' | 'kcalAdjust';

/** Lo que escribe el coach, tal cual (los campos numéricos son texto). */
export interface AssessmentDraft {
  dietFormId: string | null;
  bodyFatPct: string;
  targetBodyFatPct: string;
  leanGainKg: string;
  weeks: string;
  kcalAdjust: string;
}

export interface AssessmentValues {
  dietFormId: string | null;
  bodyFatPct: number;
  targetBodyFatPct: number;
  leanGainKg: number;
  weeks: number;
  kcalAdjust: number;
}

interface FieldRule {
  label: string;
  unit: string;
  min: number;
  max: number;
  integer: boolean;
}

/** Mismos rangos que `client_assessments` (y que la demo). */
export const FIELD_RULES: Record<DraftField, FieldRule> = {
  bodyFatPct: { label: 'Grasa actual', unit: '%', min: 3, max: 60, integer: false },
  targetBodyFatPct: { label: 'Grasa meta', unit: '%', min: 3, max: 60, integer: false },
  leanGainKg: { label: 'Músculo a ganar', unit: 'kg', min: -10, max: 15, integer: false },
  weeks: { label: 'Plazo', unit: 'sem', min: 1, max: 104, integer: true },
  kcalAdjust: { label: 'Ajuste fino', unit: 'kcal', min: -300, max: 300, integer: true },
};

const FIELDS: readonly DraftField[] = ['bodyFatPct', 'targetBodyFatPct', 'leanGainKg', 'weeks', 'kcalAdjust'];

/** Número escrito por una persona: admite coma o punto decimal y espacios. Null si no es un número. */
export function parseNumber(text: string): number | null {
  const clean = text.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^[-+]?\d+(\.\d+)?$/.test(clean)) return null;
  return Number(clean);
}

const show = (n: number) => String(n).replace('.', ',');

export function draftFromAssessment(row: Assessment | null): AssessmentDraft {
  return {
    dietFormId: row?.diet_form_id ?? null,
    bodyFatPct: row ? show(row.body_fat_pct) : '',
    targetBodyFatPct: row ? show(row.target_body_fat_pct) : '',
    leanGainKg: row ? show(row.lean_gain_kg) : '0',
    weeks: row ? String(row.weeks) : '12',
    kcalAdjust: row ? String(row.kcal_adjust) : '0',
  };
}

export type ValidationResult =
  | { ok: true; values: AssessmentValues }
  | { ok: false; errors: Partial<Record<DraftField, string>> };

export function validateDraft(draft: AssessmentDraft): ValidationResult {
  const errors: Partial<Record<DraftField, string>> = {};
  const values: Partial<Record<DraftField, number>> = {};
  for (const field of FIELDS) {
    const rule = FIELD_RULES[field];
    const value = parseNumber(draft[field]);
    if (value === null) {
      errors[field] = draft[field].trim() ? 'Escribe un número.' : 'Falta este dato.';
    } else if (rule.integer && !Number.isInteger(value)) {
      errors[field] = 'Escribe un número entero.';
    } else if (value < rule.min || value > rule.max) {
      errors[field] = `Entre ${show(rule.min)} y ${show(rule.max)} ${rule.unit}.`;
    } else {
      values[field] = value;
    }
  }
  const { bodyFatPct, targetBodyFatPct, leanGainKg, weeks, kcalAdjust } = values;
  if (
    bodyFatPct === undefined ||
    targetBodyFatPct === undefined ||
    leanGainKg === undefined ||
    weeks === undefined ||
    kcalAdjust === undefined
  ) {
    return { ok: false, errors };
  }
  return { ok: true, values: { dietFormId: draft.dietFormId, bodyFatPct, targetBodyFatPct, leanGainKg, weeks, kcalAdjust } };
}

export function formRules(form: DietForm): DietFormRules {
  return {
    name: form.name,
    kcalAdjustPct: form.kcal_adjust_pct,
    proteinPerKgLbm: form.protein_g_per_kg_lbm,
    fatPct: form.fat_pct,
  };
}

export function assessmentInput(profile: ClientProfile, values: AssessmentValues): AssessmentInput {
  return {
    sex: profile.sex === 'M' ? 'M' : 'F',
    weightKg: profile.weight_kg,
    heightCm: profile.height_cm,
    bodyFatPct: values.bodyFatPct,
    targetBodyFatPct: values.targetBodyFatPct,
    leanGainKg: values.leanGainKg,
    weeks: values.weeks,
    activityFactor: activityFactor(profile.activity_level),
    kcalAdjust: values.kcalAdjust,
  };
}

/** Cálculo en vivo de la ficha (solo con valores ya validados). */
export function preview(profile: ClientProfile, values: AssessmentValues, form: DietForm | null): TargetsResult {
  return computeTargets(assessmentInput(profile, values), form ? formRules(form) : null);
}

/** Motivos por los que todavía no se puede guardar. Vacío si se puede. */
export function saveBlockers(result: TargetsResult, form: DietForm | null): string[] {
  if (!form || !result.targets) return ['Elige una forma dietética.'];
  return targetLimitProblems(result.targets);
}

/** Argumentos de `save_coach_assessment`. */
export function saveArgs(clientId: string, values: AssessmentValues, targets: DailyTargets, form: DietForm) {
  return {
    p_client: clientId,
    p_diet_form_id: form.id,
    p_body_fat_pct: values.bodyFatPct,
    p_target_body_fat_pct: values.targetBodyFatPct,
    p_lean_gain_kg: values.leanGainKg,
    p_weeks: values.weeks,
    p_kcal_adjust: values.kcalAdjust,
    p_kcal: targets.kcal,
    p_protein_g: targets.protein_g,
    p_carbs_g: targets.carbs_g,
    p_fat_g: targets.fat_g,
    p_meals_per_day: form.meals_per_day,
  };
}

/** Edad cumplida a partir de `birth_date` (AAAA-MM-DD). */
export function ageOn(birthDate: string, today: Date): number {
  const [y, m, d] = birthDate.split('-').map(Number);
  if (!y || !m || !d) return 0;
  let age = today.getFullYear() - y;
  const month = today.getMonth() + 1;
  if (month < m || (month === m && today.getDate() < d)) age--;
  return age;
}

export const GOAL_LABELS: Record<string, string> = {
  perdida_grasa: 'Pérdida de grasa',
  recomposicion: 'Recomposición',
  ganancia_muscular: 'Ganancia muscular',
};

export function clientName(profile: Pick<ClientProfile, 'display_name'>): string {
  return profile.display_name?.trim() || 'Socio sin nombre';
}
