// Redondeo y formato de cantidades de compra. Siempre hacia arriba: que no falte comida.

import type { BuyUnit } from './types';

export const GRAMS_PER_LB = 453.59237;

/** Paso de compra de cada unidad: cuartos de libra, unidades enteras, 50 g y 25 ml. */
export const BUY_STEP: Record<BuyUnit, number> = { lb: 0.25, un: 1, g: 50, ml: 25 };

// Tolerancia para que un valor que ya cae justo en un paso (p. ej. 1000 g) no suba al siguiente
// por un error de coma flotante.
const EPSILON = 1e-9;

const FRACTIONS = ['', '¼', '½', '¾'] as const;

function ceilToStep(value: number, step: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  // Se cuenta en pasos enteros para no acumular decimales (0.25 es exacto en binario).
  const steps = Math.max(1, Math.ceil(value / step - EPSILON));
  return steps * step;
}

/**
 * Redondea hacia arriba a lo que se puede comprar.
 * `amount` va en la base de la unidad: gramos en crudo para 'lb' y 'g', mililitros para 'ml'
 * y unidades (con decimales) para 'un'. Devuelve la cantidad en la unidad de compra.
 */
export function roundUpToBuy(amount: number, unit: BuyUnit): number {
  const value = unit === 'lb' ? amount / GRAMS_PER_LB : amount;
  return ceilToStep(value, BUY_STEP[unit]);
}

/** Quita ceros sobrantes: 1.25 → «1.25», 1.50 → «1.5», 1.00 → «1». Punto decimal, como en RD. */
function trimDecimals(value: number, decimals: number): string {
  return Number(value.toFixed(decimals)).toString();
}

/** Peso en gramos o, desde 1000 g, en kilos: «950 g», «1.25 kg». */
export function formatMass(grams: number): string {
  const rounded = Math.round(grams);
  return rounded >= 1000 ? `${trimDecimals(rounded / 1000, 2)} kg` : `${rounded} g`;
}

function formatVolume(ml: number): string {
  const rounded = Math.round(ml);
  return rounded >= 1000 ? `${trimDecimals(rounded / 1000, 3)} L` : `${rounded} ml`;
}

function formatPounds(pounds: number): string {
  const quarters = Math.max(0, Math.round(pounds * 4));
  const whole = Math.floor(quarters / 4);
  const fraction = FRACTIONS[quarters % 4];
  return `${whole === 0 && fraction ? fraction : `${whole}${fraction}`} lb`;
}

export interface UnitLabels {
  singular: string;
  plural: string;
}

const DEFAULT_UNIT_LABELS: UnitLabels = { singular: 'unidad', plural: 'unidades' };

/**
 * Texto de una cantidad ya redondeada en su unidad de compra:
 * libras con fracciones (¼, ½, ¾), unidades con su nombre, gramos (kg desde 1000) y ml (L desde 1000).
 */
export function formatQuantity(quantity: number, unit: BuyUnit, labels: UnitLabels = DEFAULT_UNIT_LABELS): string {
  const safe = Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
  switch (unit) {
    case 'lb':
      return formatPounds(safe);
    case 'un': {
      const count = Math.round(safe);
      return `${count} ${count === 1 ? labels.singular : labels.plural}`;
    }
    case 'g':
      return formatMass(safe);
    case 'ml':
      return formatVolume(safe);
  }
}
