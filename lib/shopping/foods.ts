// Datos de compra de cada alimento: valores por defecto, sección y clave de agrupación.

import type { BuyUnit, FoodBuyRow, ShopGroupId, ShoppingFood, ShopSection } from './types';

export const SECTION_ORDER: readonly ShopSection[] = ['carnes', 'lacteos', 'viveres', 'despensa'];

export const GROUP_TITLES: Record<ShopGroupId, string> = {
  carnes: 'Carnes y pescados',
  lacteos: 'Huevos y lácteos',
  viveres: 'Víveres, frutas y vegetales',
  despensa: 'Granos y despensa',
  frescos: 'Frescos · cómpralos cada semana',
};

const BUY_UNITS: readonly BuyUnit[] = ['lb', 'un', 'g', 'ml'];

function isBuyUnit(value: unknown): value is BuyUnit {
  return typeof value === 'string' && (BUY_UNITS as readonly string[]).includes(value);
}

function isShopSection(value: unknown): value is ShopSection {
  return typeof value === 'string' && (SECTION_ORDER as readonly string[]).includes(value);
}

function isPositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * Sección del supermercado de un alimento. Manda `shop_section`; si el coach no la ha puesto,
 * se deduce de la categoría nutricional: la proteína va a carnes, los lácteos a huevos y lácteos,
 * los vegetales a víveres, y carbohidratos y grasas a despensa salvo que sean frescos
 * (plátano, batata, aguacate), que van con los víveres.
 */
export function shopSection(food: Pick<FoodBuyRow, 'category' | 'shop_section' | 'is_fresh'>): ShopSection {
  if (isShopSection(food.shop_section)) {
    return food.shop_section;
  }
  switch (food.category) {
    case 'proteina':
      return 'carnes';
    case 'lacteo':
      return 'lacteos';
    case 'vegetal':
      return 'viveres';
    default:
      return food.is_fresh ? 'viveres' : 'despensa';
  }
}

/**
 * Convierte una fila de `foods` en un alimento listo para calcular. Un alimento que el coach
 * acaba de crear y todavía no ha ajustado entra en la lista igualmente: con su propio nombre,
 * por libras y con rendimiento 100 (se compra lo mismo que pesa en el plan).
 */
export function toShoppingFood(row: FoodBuyRow): ShoppingFood {
  const unitGrams = isPositive(row.unit_g) ? row.unit_g : null;
  const wantedUnit = isBuyUnit(row.buy_unit) ? row.buy_unit : 'lb';
  return {
    id: row.id,
    name: row.name,
    buyName: row.buy_name?.trim() || row.name,
    // Sin gramos por unidad no se pueden contar unidades: se compra al peso.
    unit: wantedUnit === 'un' && unitGrams === null ? 'lb' : wantedUnit,
    rawPer100: isPositive(row.raw_g_per_100g) ? row.raw_g_per_100g : 100,
    unitGrams,
    unitSingular: row.unit_label_singular?.trim() || 'unidad',
    unitPlural: row.unit_label_plural?.trim() || 'unidades',
    isFresh: row.is_fresh === true,
    section: shopSection(row),
  };
}

const ACCENTS: Record<string, string> = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ü: 'u', ñ: 'n' };

/** «Pechuga de pollo» → «pechuga-de-pollo». Mapa propio de acentos: igual en web, iOS y Android. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[áéíóúüñ]/g, (char) => ACCENTS[char] ?? char)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
