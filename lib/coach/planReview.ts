// Revisión del borrador: del JSON que guarda la Edge Function a lo que ve el coach. Lógica pura.
// El formato lo fija supabase/functions/generate-diet-plan (fixtures/draft-plan.json es el contrato).
import type { Enums } from '@/types/database';

import { MACRO_LABELS } from './generateMessages';

export type PlanStatus = Enums<'plan_status'>;
export type StatusLevel = 'good' | 'warn' | 'bad' | 'neutral';

export const PLAN_STATUS: Record<PlanStatus, { label: string; level: StatusLevel }> = {
  draft: { label: 'Borrador', level: 'warn' },
  approved: { label: 'Aprobado', level: 'good' },
  rejected: { label: 'Rechazado', level: 'bad' },
  archived: { label: 'Archivado', level: 'neutral' },
};

export const MACRO_KEYS = ['kcal', 'protein_g', 'carbs_g', 'fat_g'] as const;
export type MacroKey = (typeof MACRO_KEYS)[number];
export type MacrosView = Record<MacroKey, number>;

export interface ItemView {
  foodId: string;
  name: string;
  grams: number;
  household: string | null;
  macros: MacrosView | null;
}

export interface MealView {
  slot: string;
  label: string;
  dishName: string;
  prepTip: string;
  items: ItemView[];
  macros: MacrosView | null;
  target: MacrosView | null;
}

export interface PlanView {
  meals: MealView[];
  totals: MacrosView | null;
  target: MacrosView | null;
  /** % de desviación del total frente al objetivo, por macro. */
  deviation: MacrosView | null;
  /** Macros a más de ±10 % del objetivo. */
  flagged: MacroKey[];
  needsReview: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const str = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);
const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

function isMacroKey(value: unknown): value is MacroKey {
  return typeof value === 'string' && (MACRO_KEYS as readonly string[]).includes(value);
}

function macros(value: unknown): MacrosView | null {
  if (!isRecord(value)) return null;
  const [kcal, protein_g, carbs_g, fat_g] = MACRO_KEYS.map((k) => num(value[k]));
  if (kcal === null || protein_g === null || carbs_g === null || fat_g === null) return null;
  return { kcal, protein_g, carbs_g, fat_g };
}

function item(value: unknown): ItemView | null {
  if (!isRecord(value) || typeof value.food_id !== 'string') return null;
  const grams = num(value.grams);
  if (grams === null) return null;
  return {
    foodId: value.food_id,
    name: str(value.name, value.food_id),
    grams,
    household: typeof value.household === 'string' ? value.household : null,
    macros: macros(value.macros),
  };
}

function meal(value: unknown): MealView | null {
  if (!isRecord(value) || !Array.isArray(value.items)) return null;
  const slot = str(value.slot);
  return {
    slot,
    label: str(value.label, slot),
    dishName: str(value.dish_name),
    prepTip: str(value.prep_tip),
    items: value.items.map(item).filter((i): i is ItemView => i !== null),
    macros: macros(value.macros),
    target: macros(value.target),
  };
}

/** Tolerante: lo que no tenga la forma esperada se ignora (nunca rompe la pantalla). */
export function planView(plan: unknown, totals: unknown, deviation: unknown): PlanView {
  const meals = isRecord(plan) && Array.isArray(plan.meals)
    ? plan.meals.map(meal).filter((m): m is MealView => m !== null)
    : [];
  const dev = isRecord(deviation) ? deviation : {};
  const flagged = Array.isArray(dev.flagged) ? dev.flagged.filter(isMacroKey) : [];
  return {
    meals,
    totals: macros(totals),
    target: isRecord(totals) ? macros(totals.target) : null,
    deviation: macros(dev),
    flagged,
    needsReview: dev.needs_review === true || flagged.length > 0,
  };
}

export function macroLabel(key: MacroKey): string {
  return MACRO_LABELS[key] ?? key;
}

/** Del error de la RPC review_diet_plan (código de Postgres) a un mensaje para el coach. */
export function reviewErrorMessage(code: string | null): string {
  switch (code) {
    case '55000':
      return 'Este plan ya se revisó. Vuelve a la ficha para ver su estado.';
    case '42501':
      return 'Este plan no es de uno de tus socios.';
    default:
      return 'No se pudo guardar la revisión. Revisa tu conexión y vuelve a intentarlo.';
  }
}
