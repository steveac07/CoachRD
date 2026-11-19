// Datos de ejemplo para los tests (valores de la semilla de 20261101000000_init.sql).
import type { Food, Macros } from '../_shared/nutrition.ts';
import type { AiPlan } from './plan.ts';

const food = (
  id: string,
  name: string,
  category: string,
  origin: string,
  [kcal, p, c, f]: [number, number, number, number],
  unit: [string, number] | null = null,
): Food => ({
  id,
  name,
  category,
  origin,
  kcal_100g: kcal,
  protein_100g: p,
  carbs_100g: c,
  fat_100g: f,
  household_unit: unit?.[0] ?? null,
  household_unit_g: unit?.[1] ?? null,
});

export const FOODS: Food[] = [
  food('arroz_blanco_cocido', 'Arroz blanco cocido', 'carbohidrato', 'vegetal', [130, 2.7, 28.2, 0.3], ['taza', 160]),
  food('platano_verde_hervido', 'Plátano verde hervido (mangú sin grasa)', 'carbohidrato', 'vegetal', [
    116,
    0.8,
    31.2,
    0.2,
  ], [
    'unidad',
    150,
  ]),
  food('habichuelas_rojas_cocidas', 'Habichuelas rojas cocidas (sin grasa)', 'carbohidrato', 'vegetal', [
    127,
    8.7,
    22.8,
    0.5,
  ], [
    'cucharón',
    130,
  ]),
  food('pechuga_pollo_cocida', 'Pechuga de pollo cocida sin piel', 'proteina', 'carne', [165, 31, 0, 3.6]),
  food('huevo_entero', 'Huevo entero', 'proteina', 'huevo', [143, 12.6, 0.7, 9.5], ['unidad', 50]),
  food('aguacate', 'Aguacate', 'grasa', 'vegetal', [160, 2, 8.5, 14.7]),
  food('ensalada_verde', 'Ensalada verde (lechuga, tomate, pepino)', 'vegetal', 'vegetal', [18, 0.9, 3.5, 0.2], [
    'plato',
    200,
  ]),
];

export const DAILY: Macros = { kcal: 1800, protein_g: 140, carbs_g: 180, fat_g: 55 };

/** Plan de 3 comidas tal como podría devolverlo la IA. */
export const AI_PLAN: AiPlan = {
  desayuno: {
    dish_name: 'Mangú con huevo',
    prep_tip: 'Hierve el plátano con una pizca de sal y májalo con un poco del agua de la cocción.',
    items: [
      { food_id: 'platano_verde_hervido', grams: 200 },
      { food_id: 'huevo_entero', grams: 100 },
    ],
  },
  almuerzo: {
    dish_name: 'La bandera ligera',
    prep_tip: 'Guisa el pollo con sofrito natural y sirve las habichuelas sin grasa añadida.',
    items: [
      { food_id: 'arroz_blanco_cocido', grams: 180 },
      { food_id: 'habichuelas_rojas_cocidas', grams: 130 },
      { food_id: 'pechuga_pollo_cocida', grams: 160 },
      { food_id: 'ensalada_verde', grams: 150 },
    ],
  },
  cena: {
    dish_name: 'Pollo con ensalada y aguacate',
    prep_tip: 'Haz el pollo en la air fryer y agrega el aguacate al servir.',
    items: [
      { food_id: 'pechuga_pollo_cocida', grams: 150 },
      { food_id: 'ensalada_verde', grams: 200 },
      { food_id: 'aguacate', grams: 103 },
    ],
  },
};
