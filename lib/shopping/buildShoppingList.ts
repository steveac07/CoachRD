// Lista de compra: cálculo determinista, sin IA.
// Suma el menú de los 7 días, pasa los gramos cocidos a lo que se compra en crudo,
// agrupa por nombre de compra y redondea hacia arriba en la unidad de cada producto.

import { GROUP_TITLES, SECTION_ORDER, slugify } from './foods';
import { GRAMS_PER_LB, formatMass, formatQuantity, roundUpToBuy } from './quantity';
import type {
  BuyUnit,
  DayMenu,
  ShopGroupId,
  ShoppingFood,
  ShoppingGroup,
  ShoppingItem,
  ShoppingList,
  ShopPeriod,
} from './types';

/** El mes es el menú de la semana × 4. */
export const WEEKS_PER_MONTH = 4;

export interface BuildShoppingListInput {
  /** Menús de la semana: un arreglo por día (7 días) con todo lo que se come ese día. */
  days: readonly DayMenu[];
  /** Catálogo con los datos de compra de cada alimento (ver `toShoppingFood`). */
  foods: readonly ShoppingFood[];
  period: ShopPeriod;
}

// Solo se pueden sumar cantidades de la misma magnitud: peso (lb y g), volumen o unidades.
type Dimension = 'peso' | 'ml' | 'un';

function dimensionOf(unit: BuyUnit): Dimension {
  if (unit === 'ml' || unit === 'un') {
    return unit;
  }
  return 'peso';
}

// Sin gramos por unidad no se pueden contar unidades: ese alimento se compra al peso.
function effectiveUnit(food: ShoppingFood): BuyUnit {
  const hasUnitGrams = food.unitGrams !== null && food.unitGrams > 0;
  return food.unit === 'un' && !hasUnitGrams ? 'lb' : food.unit;
}

interface Line {
  key: string;
  /** Primer alimento de la línea (por id): pone el nombre, la unidad y la sección. */
  lead: ShoppingFood;
  unit: BuyUnit;
  /** Compra de una semana sin redondear: gramos crudos, ml o unidades. */
  weeklyAmount: number;
  /** Gramos cocidos del plan en una semana. */
  weeklyPlanGrams: number;
  isFresh: boolean;
  foodIds: string[];
}

function sumCookedGrams(
  days: readonly DayMenu[],
  byId: ReadonlyMap<string, ShoppingFood>,
): { cooked: Map<string, number>; missing: Set<string> } {
  const cooked = new Map<string, number>();
  const missing = new Set<string>();
  for (const day of days) {
    for (const item of day) {
      // El premio canjeado no se compra con la lista.
      if (item.isReward || !Number.isFinite(item.grams) || item.grams <= 0) {
        continue;
      }
      if (!byId.has(item.foodId)) {
        missing.add(item.foodId);
        continue;
      }
      cooked.set(item.foodId, (cooked.get(item.foodId) ?? 0) + item.grams);
    }
  }
  return { cooked, missing };
}

function buildLines(cooked: ReadonlyMap<string, number>, byId: ReadonlyMap<string, ShoppingFood>): Line[] {
  const lines = new Map<string, Line>();
  // Orden por id: el resultado no depende del orden de las comidas en el plan.
  for (const foodId of [...cooked.keys()].sort()) {
    const food = byId.get(foodId);
    const grams = cooked.get(foodId);
    if (!food || grams === undefined) {
      continue;
    }
    const unit = effectiveUnit(food);
    const rawPer100 = food.rawPer100 > 0 ? food.rawPer100 : 100;
    const raw = (grams * rawPer100) / 100;
    const amount = unit === 'un' && food.unitGrams ? raw / food.unitGrams : raw;
    const key = `${slugify(food.buyName) || slugify(food.id)}:${dimensionOf(unit)}`;

    const line = lines.get(key);
    if (line) {
      line.weeklyAmount += amount;
      line.weeklyPlanGrams += grams;
      // Si uno de los alimentos de la línea es fresco, el producto se compra cada semana.
      line.isFresh = line.isFresh || food.isFresh;
      line.foodIds.push(food.id);
    } else {
      lines.set(key, {
        key,
        lead: food,
        unit,
        weeklyAmount: amount,
        weeklyPlanGrams: grams,
        isFresh: food.isFresh,
        foodIds: [food.id],
      });
    }
  }
  return [...lines.values()];
}

function toItem(line: Line, period: ShopPeriod): ShoppingItem {
  // Los frescos no aguantan un mes: en la compra del mes llevan la cantidad de una semana.
  const weeklyOnly = period === 'month' && line.isFresh;
  const weeks = period === 'month' && !line.isFresh ? WEEKS_PER_MONTH : 1;
  // Se multiplica antes de redondear: 4 semanas de pollo son 26¾ lb, no 4 × 6¾ = 27 lb.
  const quantity = roundUpToBuy(line.weeklyAmount * weeks, line.unit);
  const planGrams = line.weeklyPlanGrams * weeks;
  return {
    key: line.key,
    name: line.lead.buyName,
    section: line.lead.section,
    isFresh: line.isFresh,
    unit: line.unit,
    quantity,
    quantityLabel: formatQuantity(quantity, line.unit, {
      singular: line.lead.unitSingular,
      plural: line.lead.unitPlural,
    }),
    detail: line.unit === 'lb' ? `≈ ${formatMass(quantity * GRAMS_PER_LB)}` : `${formatMass(planGrams)} en el plan`,
    planGrams,
    weeklyOnly,
    foodIds: line.foodIds,
  };
}

/**
 * Genera la lista de compra de un socio a partir de los menús de su semana.
 *
 * - Semana: la suma de los días recibidos. Mes: esa semana × 4.
 * - Cada alimento pasa de gramos cocidos a crudo con su rendimiento (`rawPer100`).
 * - Los alimentos con el mismo nombre de compra se suman en una sola línea.
 * - Se redondea siempre hacia arriba: cuartos de libra, unidades enteras, 50 g y 25 ml.
 * - En el mes, los frescos van al grupo «cómpralos cada semana» con la cantidad de una semana.
 * - El premio canjeado (`isReward`) no entra.
 */
export function buildShoppingList({ days, foods, period }: BuildShoppingListInput): ShoppingList {
  const byId = new Map(foods.map((food) => [food.id, food]));
  const { cooked, missing } = sumCookedGrams(days, byId);
  const items = buildLines(cooked, byId).map((line) => toItem(line, period));

  const byGroup = new Map<ShopGroupId, ShoppingItem[]>();
  for (const item of items) {
    const groupId: ShopGroupId = item.weeklyOnly ? 'frescos' : item.section;
    byGroup.set(groupId, [...(byGroup.get(groupId) ?? []), item]);
  }

  const groupOrder: readonly ShopGroupId[] = [...SECTION_ORDER, 'frescos'];
  const groups: ShoppingGroup[] = [];
  for (const id of groupOrder) {
    const groupItems = byGroup.get(id);
    if (groupItems?.length) {
      groups.push({
        id,
        title: GROUP_TITLES[id],
        items: [...groupItems].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)),
      });
    }
  }

  return { period, groups, itemCount: items.length, missingFoodIds: [...missing].sort() };
}
