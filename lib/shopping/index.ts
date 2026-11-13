// Lista de compra de CoachRD: lógica pura (sin React, sin Supabase y sin IA).

export { buildShoppingList, WEEKS_PER_MONTH, type BuildShoppingListInput } from './buildShoppingList';
export { GROUP_TITLES, SECTION_ORDER, shopSection, slugify, toShoppingFood } from './foods';
export { DAYS_PER_WEEK, menuFromPlanJson, repeatDailyMenu, shoppingListKey } from './planMenu';
export { BUY_STEP, GRAMS_PER_LB, formatMass, formatQuantity, roundUpToBuy, type UnitLabels } from './quantity';
export { PERIOD_LABELS, shoppingListToText, type ShoppingTextOptions } from './text';
export type {
  BuyUnit,
  DayMenu,
  FoodBuyRow,
  MenuItem,
  ShopGroupId,
  ShoppingFood,
  ShoppingGroup,
  ShoppingItem,
  ShoppingList,
  ShopPeriod,
  ShopSection,
} from './types';
