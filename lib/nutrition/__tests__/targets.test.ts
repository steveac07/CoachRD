// El cálculo de la app frente a calc() de la demo aprobada. Los casos y los resultados esperados los
// genera scripts/demo-golden.mjs ejecutando el código de referencia/coachrd-demo.html.
import golden from './demo-calc.golden.json';
import {
  activityFactor,
  computeTargets,
  type DietFormRules,
  targetLimitProblems,
  type TargetsResult,
} from '../targets';

interface DemoClient {
  sex: string;
  weight: number;
  height: number;
  bf: number;
  tbf: number;
  lean: number;
  weeks: number;
  act: number;
  kcalAdj: number;
}
interface DemoForm {
  name: string;
  adjust: number;
  protein: number;
  fatPct: number;
}

function toForm(form: DemoForm | null): DietFormRules | null {
  return form ? { name: form.name, kcalAdjustPct: form.adjust, proteinPerKgLbm: form.protein, fatPct: form.fatPct } : null;
}

function run(client: DemoClient, form: DemoForm | null): TargetsResult {
  return computeTargets(
    {
      sex: client.sex === 'M' ? 'M' : 'F',
      weightKg: client.weight,
      heightCm: client.height,
      bodyFatPct: client.bf,
      targetBodyFatPct: client.tbf,
      leanGainKg: client.lean,
      weeks: client.weeks,
      activityFactor: client.act,
      kcalAdjust: client.kcalAdj,
    },
    toForm(form),
  );
}

/** El resultado de la app con los nombres de campo de la demo, para compararlo tal cual. */
function asDemo(r: TargetsResult): Record<string, unknown> {
  const out: Record<string, unknown> = {
    W: r.weightKg,
    H: r.heightCm,
    bf: r.bodyFatPct,
    tbf: r.targetBodyFatPct,
    weeks: r.weeks,
    LBM: r.leanMassKg,
    FM: r.fatMassKg,
    BMI: r.bmi,
    BMR: r.bmr,
    TDEE: r.tdee,
    targetW: r.targetWeightKg,
    delta: r.deltaKg,
    needWk: r.neededKgPerWeek,
    needPct: r.neededPctPerWeek,
    checks: r.checks.map((c) => [c.level, c.message]),
    status: { lvl: r.status.level, label: r.status.label, detail: r.status.detail },
  };
  if (r.targets) {
    Object.assign(out, {
      kcal: r.targets.kcal,
      P: r.targets.protein_g,
      C: r.targets.carbs_g,
      F: r.targets.fat_g,
      expWk: r.expectedKgPerWeek,
    });
  }
  if (r.weeksNeeded !== null) out.weeksNeeded = r.weeksNeeded;
  return out;
}

describe('computeTargets da lo mismo que la demo aprobada', () => {
  it.each(golden.cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    expect(asDemo(run(c.client, c.form))).toEqual(c.expected);
  });
});

describe('activityFactor', () => {
  it('usa los factores de la demo y moderado si el nivel no se reconoce', () => {
    expect(activityFactor('sedentario')).toBe(1.2);
    expect(activityFactor('muy_alto')).toBe(1.9);
    expect(activityFactor('desconocido')).toBe(1.55);
    expect(activityFactor('toString')).toBe(1.55);
  });
});

describe('targetLimitProblems', () => {
  it('acepta objetivos dentro de los rangos de la base de datos', () => {
    expect(targetLimitProblems({ kcal: 1771, protein_g: 118, carbs_g: 215, fat_g: 49 })).toEqual([]);
  });

  it('explica qué se sale de rango', () => {
    expect(targetLimitProblems({ kcal: 832, protein_g: 90, carbs_g: 25, fat_g: 23 })).toEqual([
      'Calorías: 832 kcal, el mínimo es 1,000 kcal.',
      'Carbohidratos: 25 g, el mínimo es 30 g.',
    ]);
  });
});
