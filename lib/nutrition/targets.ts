// Objetivos diarios del socio con las reglas de la demo aprobada (calc() de referencia/coachrd-demo.html).
// Lógica pura: sin React y sin Supabase. Las operaciones van en el mismo orden que la demo para que los
// números coincidan exactamente (lo comprueba __tests__/targets.test.ts contra la propia demo).
//
// Gasto basal por Katch-McArdle a partir de la masa magra; el coach elige la forma dietética
// (ajuste calórico, proteína por kg de masa magra y % de grasa). La IA no interviene.

export type Sex = 'M' | 'F';

/** Reglas de la forma dietética que aplica el coach. */
export interface DietFormRules {
  name: string;
  /** Ajuste sobre el gasto total, en %. Negativo = déficit. */
  kcalAdjustPct: number;
  /** Gramos de proteína por kg de masa magra. */
  proteinPerKgLbm: number;
  /** Grasa sobre el total de calorías, en %. */
  fatPct: number;
}

export interface AssessmentInput {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  bodyFatPct: number;
  targetBodyFatPct: number;
  /** Masa magra a ganar (negativo: a perder), en kg. */
  leanGainKg: number;
  weeks: number;
  /** Factor de actividad (1.2 a 1.9). */
  activityFactor: number;
  /** Ajuste fino del coach, ±300 kcal como máximo. */
  kcalAdjust: number;
}

export type Level = 'good' | 'warn' | 'bad';

export interface Status {
  level: Level;
  label: string;
  detail: string;
}

export interface Check {
  level: Level;
  message: string;
}

export interface DailyTargets {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface TargetsResult {
  weightKg: number;
  heightCm: number;
  bodyFatPct: number;
  targetBodyFatPct: number;
  weeks: number;
  leanMassKg: number;
  fatMassKg: number;
  bmi: number;
  bmr: number;
  tdee: number;
  targetWeightKg: number;
  deltaKg: number;
  neededKgPerWeek: number;
  neededPctPerWeek: number;
  /** Null sin forma dietética. */
  targets: DailyTargets | null;
  /** kg por semana que se esperan con este plan. Null sin forma dietética. */
  expectedKgPerWeek: number | null;
  /** Semanas que hacen falta al ritmo esperado, cuando la dirección es la correcta. */
  weeksNeeded: number | null;
  status: Status;
  checks: Check[];
}

/** Factores de actividad de la demo, por `client_profiles.activity_level`. */
export const ACTIVITY_FACTORS = {
  sedentario: 1.2,
  ligero: 1.375,
  moderado: 1.55,
  alto: 1.725,
  muy_alto: 1.9,
} as const;
export type ActivityLevel = keyof typeof ACTIVITY_FACTORS;

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentario: 'Sedentario',
  ligero: 'Ligero · 1–3 días',
  moderado: 'Moderado · 3–5 días',
  alto: 'Alto · 6–7 días',
  muy_alto: 'Muy alto · doble sesión',
};

export function isActivityLevel(level: string): level is ActivityLevel {
  return Object.prototype.hasOwnProperty.call(ACTIVITY_FACTORS, level);
}

/** Factor de la demo para un `activity_level`; moderado (1.55) si no se reconoce, como la demo. */
export function activityFactor(level: string): number {
  return isActivityLevel(level) ? ACTIVITY_FACTORS[level] : ACTIVITY_FACTORS.moderado;
}

/** kcal por kg de grasa corporal, para pasar del balance calórico a kg por semana. */
const KCAL_PER_KG = 7700;

const clamp = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));
/** Como `+x || 0` en la demo: lo que no es un número finito cuenta como 0. */
const finite = (x: number) => (Number.isFinite(x) ? x : 0);

/** Número con formato de República Dominicana, como `fmt` en la demo. */
export function fmt(x: number, decimals = 0): string {
  return Number(x).toLocaleString('es-DO', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function computeTargets(input: AssessmentInput, form: DietFormRules | null): TargetsResult {
  const W = clamp(finite(input.weightKg), 30, 250);
  const H = clamp(finite(input.heightCm), 120, 230);
  const bf = clamp(finite(input.bodyFatPct), 3, 60) / 100;
  const tbf = clamp(finite(input.targetBodyFatPct), 3, 60) / 100;
  const weeks = clamp(Math.round(finite(input.weeks) || 1), 1, 104);
  const lean = clamp(finite(input.leanGainKg), -10, 15);

  const LBM = W * (1 - bf);
  const FM = W - LBM;
  const BMI = W / Math.pow(H / 100, 2);
  const BMR = 370 + 21.6 * LBM;
  const TDEE = BMR * (finite(input.activityFactor) || 1.55);
  const targetW = (LBM + lean) / (1 - tbf);
  const delta = targetW - W;
  const needWk = delta / weeks;
  const needPct = delta / weeks / W * 100;

  const base = {
    weightKg: W,
    heightCm: H,
    bodyFatPct: bf * 100,
    targetBodyFatPct: tbf * 100,
    weeks,
    leanMassKg: LBM,
    fatMassKg: FM,
    bmi: BMI,
    bmr: BMR,
    tdee: TDEE,
    targetWeightKg: targetW,
    deltaKg: delta,
    neededKgPerWeek: needWk,
    neededPctPerWeek: needPct,
  };

  if (!form) {
    return {
      ...base,
      targets: null,
      expectedKgPerWeek: null,
      weeksNeeded: null,
      status: { level: 'warn', label: 'Sin forma', detail: 'Asigna una forma dietética para calcular el plan.' },
      checks: [],
    };
  }

  const kcal = Math.round(TDEE * (1 + form.kcalAdjustPct / 100)) + clamp(finite(input.kcalAdjust), -300, 300);
  const P = Math.round(form.proteinPerKgLbm * LBM);
  const F = Math.round(kcal * form.fatPct / 100 / 9);
  const C = Math.max(0, Math.round((kcal - P * 4 - F * 9) / 4));
  const expWk = (kcal - TDEE) * 7 / KCAL_PER_KG;

  let status: Status;
  let weeksNeeded: number | null = null;
  if (Math.abs(delta) < 0.3) {
    status = { level: 'good', label: 'Mantenimiento', detail: 'El peso meta coincide con el actual.' };
  } else if (Math.abs(expWk) < 0.01 || Math.sign(expWk) !== Math.sign(delta)) {
    const direction = form.kcalAdjustPct < 0
      ? 'tiene déficit'
      : form.kcalAdjustPct > 0
      ? 'tiene superávit'
      : 'es de mantenimiento';
    status = {
      level: 'bad',
      label: 'Dirección contraria',
      detail: `La meta pide ${delta < 0 ? 'bajar' : 'subir'} peso y «${form.name}» ${direction}.`,
    };
  } else {
    const wn = Math.abs(delta / expWk);
    weeksNeeded = wn;
    status = wn <= weeks * 1.1
      ? {
        level: 'good',
        label: 'En plazo',
        detail: `Con esta forma llega en unas ${Math.ceil(wn)} semanas. Plazo fijado: ${weeks}.`,
      }
      : {
        level: 'warn',
        label: `+${Math.ceil(wn - weeks)} semanas`,
        detail: `Con esta forma necesita unas ${Math.ceil(wn)} semanas. Alarga el plazo o aumenta el déficit.`,
      };
  }

  const checks: Check[] = [];
  if (needPct < -1.5) {
    checks.push({
      level: 'bad',
      message: `Ritmo de pérdida muy alto: ${fmt(Math.abs(needPct), 1)} % del peso por semana. Recomendado: hasta 1 %.`,
    });
  } else if (needPct < -1) {
    checks.push({ level: 'warn', message: `Ritmo de pérdida exigente: ${fmt(Math.abs(needPct), 1)} % semanal.` });
  }
  if (needPct > 0.5) {
    checks.push({ level: 'warn', message: `Ganancia de ${fmt(needPct, 1)} % semanal: probablemente más grasa que músculo.` });
  }
  const floor = input.sex === 'F' ? 15 : 8;
  if (tbf * 100 < floor) {
    checks.push({
      level: 'bad',
      message: `Meta de grasa por debajo de un rango saludable (${floor} % para ${input.sex === 'F' ? 'mujeres' : 'hombres'}).`,
    });
  }
  if (kcal < BMR) {
    checks.push({ level: 'warn', message: `Calorías del plan (${fmt(kcal)}) por debajo del gasto basal (${fmt(BMR)}).` });
  }
  if (C < 60) {
    checks.push({ level: 'warn', message: `Carbohidratos muy bajos (${C} g). Revisa proteína o grasa.` });
  }

  return {
    ...base,
    targets: { kcal, protein_g: P, carbs_g: C, fat_g: F },
    expectedKgPerWeek: expWk,
    weeksNeeded,
    status,
    checks,
  };
}

const TARGET_KEYS = ['kcal', 'protein_g', 'carbs_g', 'fat_g'] as const satisfies readonly (keyof DailyTargets)[];

/** Rangos que admite `nutrition_targets` (checks de la base de datos). */
export const TARGET_LIMITS: Record<keyof DailyTargets, { min: number; max: number; label: string; unit: string }> = {
  kcal: { min: 1000, max: 6000, label: 'Calorías', unit: 'kcal' },
  protein_g: { min: 40, max: 400, label: 'Proteína', unit: 'g' },
  carbs_g: { min: 30, max: 800, label: 'Carbohidratos', unit: 'g' },
  fat_g: { min: 20, max: 250, label: 'Grasa', unit: 'g' },
};

/** Qué objetivos se salen de los rangos que se pueden guardar. Vacío si todo está bien. */
export function targetLimitProblems(targets: DailyTargets): string[] {
  const problems: string[] = [];
  for (const key of TARGET_KEYS) {
    const { min, max, label, unit } = TARGET_LIMITS[key];
    const value = targets[key];
    if (value < min) problems.push(`${label}: ${fmt(value)} ${unit}, el mínimo es ${fmt(min)} ${unit}.`);
    else if (value > max) problems.push(`${label}: ${fmt(value)} ${unit}, el máximo es ${fmt(max)} ${unit}.`);
  }
  return problems;
}
