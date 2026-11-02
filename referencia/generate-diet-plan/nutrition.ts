// Lógica nutricional DETERMINISTA. La IA nunca calcula macros: solo elige
// alimentos del catálogo y gramos. Todo número que ve el cliente sale de aquí.

export type Sex = "M" | "F";
export type Goal = "perdida_grasa" | "recomposicion" | "ganancia_muscular";
export type ActivityLevel = "sedentario" | "ligero" | "moderado" | "alto" | "muy_alto";

export interface Food {
  id: string;
  name: string;
  kcal_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
  household_unit: string | null;
  household_unit_g: number | null;
}

export interface Macros {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentario: 1.2,
  ligero: 1.375,
  moderado: 1.55,
  alto: 1.725,
  muy_alto: 1.9,
};

const GOAL_ADJUST: Record<Goal, number> = {
  perdida_grasa: -0.2,
  recomposicion: -0.1,
  ganancia_muscular: 0.1,
};

const PROTEIN_G_PER_KG: Record<Goal, number> = {
  perdida_grasa: 2.2,
  recomposicion: 2.0,
  ganancia_muscular: 1.8,
};

/** Mifflin-St Jeor. Punto de partida; el coach ajusta con la evolución real. */
export function computeTargets(input: {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  goal: Goal;
}): Macros {
  const { sex, age, heightCm, weightKg, activity, goal } = input;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "M" ? 5 : -161);
  const kcal = Math.round(bmr * ACTIVITY_FACTOR[activity] * (1 + GOAL_ADJUST[goal]));
  const protein_g = Math.round(weightKg * PROTEIN_G_PER_KG[goal]);
  const fat_g = Math.round(weightKg * 0.8);
  const carbs_g = Math.max(0, Math.round((kcal - protein_g * 4 - fat_g * 9) / 4));
  return { kcal, protein_g, carbs_g, fat_g };
}

export function macrosForPortion(food: Food, grams: number): Macros {
  const f = grams / 100;
  return {
    kcal: food.kcal_100g * f,
    protein_g: food.protein_100g * f,
    carbs_g: food.carbs_100g * f,
    fat_g: food.fat_100g * f,
  };
}

export function sumMacros(items: Macros[]): Macros {
  return items.reduce<Macros>(
    (acc, m) => ({
      kcal: acc.kcal + m.kcal,
      protein_g: acc.protein_g + m.protein_g,
      carbs_g: acc.carbs_g + m.carbs_g,
      fat_g: acc.fat_g + m.fat_g,
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );
}

export function roundMacros(m: Macros): Macros {
  return {
    kcal: Math.round(m.kcal),
    protein_g: Math.round(m.protein_g * 10) / 10,
    carbs_g: Math.round(m.carbs_g * 10) / 10,
    fat_g: Math.round(m.fat_g * 10) / 10,
  };
}

/** Desviación porcentual por macro: (real - objetivo) / objetivo. */
export function deviation(actual: Macros, target: Macros): Record<keyof Macros, number> {
  const pct = (a: number, t: number) => (t === 0 ? 0 : Math.round(((a - t) / t) * 1000) / 10);
  return {
    kcal: pct(actual.kcal, target.kcal),
    protein_g: pct(actual.protein_g, target.protein_g),
    carbs_g: pct(actual.carbs_g, target.carbs_g),
    fat_g: pct(actual.fat_g, target.fat_g),
  };
}

export function householdMeasure(food: Food, grams: number): string | null {
  if (!food.household_unit || !food.household_unit_g) return null;
  const units = Math.round((grams / food.household_unit_g) * 4) / 4; // redondeo a 1/4
  return `${units} ${food.household_unit}`;
}
