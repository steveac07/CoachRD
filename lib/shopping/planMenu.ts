// Del plan aprobado (`diet_plans`) a los menús de la semana que necesita `buildShoppingList`.

import type { DayMenu, MenuItem, ShopPeriod } from './types';

export const DAYS_PER_WEEK = 7;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Lee el JSON de `diet_plans.plan` ({ meals: [{ items: [{ food_id, grams }] }] }) y devuelve
 * todo lo que se come en el día. Es tolerante: lo que no tenga la forma esperada se ignora.
 *
 * El premio canjeado no es un alimento del catálogo y hoy no se guarda en `plan.meals`. Por si
 * más adelante se guarda ahí, una comida o un alimento con `is_reward: true` sale marcado
 * como premio y `buildShoppingList` lo deja fuera.
 */
export function menuFromPlanJson(plan: unknown): MenuItem[] {
  if (!isRecord(plan)) {
    return [];
  }
  const menu: MenuItem[] = [];
  for (const meal of asArray(plan.meals)) {
    if (!isRecord(meal)) {
      continue;
    }
    const rewardMeal = meal.is_reward === true;
    for (const item of asArray(meal.items)) {
      if (!isRecord(item) || typeof item.food_id !== 'string' || typeof item.grams !== 'number') {
        continue;
      }
      const isReward = rewardMeal || item.is_reward === true;
      menu.push(isReward ? { foodId: item.food_id, grams: item.grams, isReward } : { foodId: item.food_id, grams: item.grams });
    }
  }
  return menu;
}

/**
 * ORIGEN DE LOS 7 DÍAS. Hoy `diet_plans` guarda un único plan diario aprobado (sin fecha ni
 * día de la semana), así que la semana es ese mismo día repetido 7 veces.
 * Cuando existan planes distintos por día, se pasan tal cual a `buildShoppingList` en `days`
 * y esta función deja de hacer falta: el cálculo ya suma día a día.
 */
export function repeatDailyMenu(day: DayMenu, days: number = DAYS_PER_WEEK): DayMenu[] {
  return Array.from({ length: Math.max(0, Math.floor(days)) }, () => day);
}

/**
 * Clave de la lista en `shopping_checks.list_key`: id del plan aprobado + periodo.
 * Si cambia el plan aprobado cambia la clave y los checks empiezan de cero.
 */
export function shoppingListKey(planId: string, period: ShopPeriod): string {
  return `${planId}:${period}`;
}
