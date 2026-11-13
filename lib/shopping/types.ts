// Tipos de la lista de compra. Sin React y sin Supabase: solo datos.

/** Unidad de compra. En República Dominicana el peso se compra por libras. */
export type BuyUnit = 'lb' | 'un' | 'g' | 'ml';

/** Periodo de la lista. El mes es el menú de la semana × 4. */
export type ShopPeriod = 'week' | 'month';

/** Secciones del supermercado. */
export type ShopSection = 'carnes' | 'lacteos' | 'viveres' | 'despensa';

/** Grupos de la lista: las secciones más «frescos», que solo aparece en la compra del mes. */
export type ShopGroupId = ShopSection | 'frescos';

/**
 * Fila de `foods` con sus columnas de compra, tal como llega de la base de datos.
 * Todo lo de compra es opcional: un alimento recién creado por el coach aún no las tiene.
 */
export interface FoodBuyRow {
  id: string;
  name: string;
  category: string;
  buy_name?: string | null;
  buy_unit?: string | null;
  raw_g_per_100g?: number | null;
  unit_g?: number | null;
  unit_label_singular?: string | null;
  unit_label_plural?: string | null;
  is_fresh?: boolean | null;
  shop_section?: string | null;
}

/** Alimento ya normalizado para calcular la compra (ver `toShoppingFood`). */
export interface ShoppingFood {
  id: string;
  /** Nombre del alimento en el plan. */
  name: string;
  /** Nombre en la lista. Dos alimentos con el mismo nombre se suman en una línea. */
  buyName: string;
  unit: BuyUnit;
  /** Rendimiento: gramos (o ml) que se compran en crudo por cada 100 g del plan. */
  rawPer100: number;
  /** Gramos que trae una unidad tal como se compra. Solo se usa con `unit: 'un'`. */
  unitGrams: number | null;
  unitSingular: string;
  unitPlural: string;
  /** Fresco: en la compra del mes se compra cada semana. */
  isFresh: boolean;
  section: ShopSection;
}

/** Un alimento del menú con sus gramos ya cocidos. */
export interface MenuItem {
  foodId: string;
  grams: number;
  /** El premio canjeado no entra en la lista de compra. */
  isReward?: boolean;
}

/** Todo lo que se come en un día (todas las comidas juntas). */
export type DayMenu = readonly MenuItem[];

export interface ShoppingItem {
  /** Clave estable de la línea. Es el `item_key` de `shopping_checks`. */
  key: string;
  name: string;
  section: ShopSection;
  isFresh: boolean;
  unit: BuyUnit;
  /** Cantidad a comprar, ya redondeada hacia arriba, en la unidad de compra. */
  quantity: number;
  /** Cantidad lista para mostrar: «6¾ lb», «32 rebanadas», «200 ml», «1.25 kg». */
  quantityLabel: string;
  /** Línea secundaria: equivalencia en kg (libras) o gramos en el plan (resto). */
  detail: string;
  /** Gramos cocidos del plan que cubre esta línea. */
  planGrams: number;
  /** true cuando es un fresco en la compra del mes: la cantidad es la de una semana. */
  weeklyOnly: boolean;
  /** Alimentos del plan que suma esta línea. */
  foodIds: string[];
}

export interface ShoppingGroup {
  id: ShopGroupId;
  title: string;
  items: ShoppingItem[];
}

export interface ShoppingList {
  period: ShopPeriod;
  groups: ShoppingGroup[];
  itemCount: number;
  /** Alimentos del menú que no están en el catálogo recibido (no se pueden calcular). */
  missingFoodIds: string[];
}
