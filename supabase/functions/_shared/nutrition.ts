// Lógica nutricional DETERMINISTA. La IA nunca calcula macros: solo elige alimentos del
// catálogo y gramos. Todo número que ve el socio sale de aquí.
//
// Los objetivos diarios no se calculan en esta función: los fija el coach (`nutrition_targets`)
// con las reglas de su forma dietética, como en la demo aprobada.

export interface Food {
  id: string;
  name: string;
  category: string;
  kcal_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
  household_unit: string | null;
  household_unit_g: number | null;
}

export type Macros = {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export type MacroKey = keyof Macros;

export const MACRO_KEYS: readonly MacroKey[] = ['kcal', 'protein_g', 'carbs_g', 'fat_g'];

export const ZERO_MACROS: Macros = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };

export function macrosForPortion(food: Food, grams: number): Macros {
  const f = grams / 100;
  return {
    kcal: food.kcal_100g * f,
    protein_g: food.protein_100g * f,
    carbs_g: food.carbs_100g * f,
    fat_g: food.fat_100g * f,
  };
}

export function sumMacros(items: readonly Macros[]): Macros {
  return items.reduce<Macros>(
    (acc, m) => ({
      kcal: acc.kcal + m.kcal,
      protein_g: acc.protein_g + m.protein_g,
      carbs_g: acc.carbs_g + m.carbs_g,
      fat_g: acc.fat_g + m.fat_g,
    }),
    ZERO_MACROS,
  );
}

/** Calorías enteras; gramos con un decimal. */
export function roundMacros(m: Macros): Macros {
  return {
    kcal: Math.round(m.kcal),
    protein_g: Math.round(m.protein_g * 10) / 10,
    carbs_g: Math.round(m.carbs_g * 10) / 10,
    fat_g: Math.round(m.fat_g * 10) / 10,
  };
}

export function scaleMacros(m: Macros, factor: number): Macros {
  return {
    kcal: m.kcal * factor,
    protein_g: m.protein_g * factor,
    carbs_g: m.carbs_g * factor,
    fat_g: m.fat_g * factor,
  };
}

/** Desviación porcentual por macro, con un decimal: (real - objetivo) / objetivo. */
export function deviation(actual: Macros, target: Macros): Record<MacroKey, number> {
  const pct = (a: number, t: number) => (t === 0 ? 0 : Math.round(((a - t) / t) * 1000) / 10);
  return {
    kcal: pct(actual.kcal, target.kcal),
    protein_g: pct(actual.protein_g, target.protein_g),
    carbs_g: pct(actual.carbs_g, target.carbs_g),
    fat_g: pct(actual.fat_g, target.fat_g),
  };
}

/** Medida casera redondeada a cuartos: «1.5 taza». Null si el alimento no tiene medida casera. */
export function householdMeasure(food: Food, grams: number): string | null {
  if (!food.household_unit || !food.household_unit_g) return null;
  const units = Math.round((grams / food.household_unit_g) * 4) / 4;
  return `${units} ${food.household_unit}`;
}
