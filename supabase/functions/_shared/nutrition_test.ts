import { assertEquals } from './test_deps.ts';
import { deviation, type Food, householdMeasure, macrosForPortion, roundMacros, sumMacros } from './nutrition.ts';

const arroz: Food = {
  id: 'arroz_blanco_cocido',
  name: 'Arroz blanco cocido',
  category: 'carbohidrato',
  origin: 'vegetal',
  kcal_100g: 130,
  protein_100g: 2.7,
  carbs_100g: 28.2,
  fat_100g: 0.3,
  household_unit: 'taza',
  household_unit_g: 160,
};

Deno.test('macrosForPortion escala los valores por 100 g', () => {
  assertEquals(roundMacros(macrosForPortion(arroz, 200)), { kcal: 260, protein_g: 5.4, carbs_g: 56.4, fat_g: 0.6 });
});

Deno.test('sumMacros suma y roundMacros deja kcal enteras y gramos con un decimal', () => {
  const total = sumMacros([
    { kcal: 100.4, protein_g: 10.04, carbs_g: 1.06, fat_g: 0 },
    { kcal: 50.2, protein_g: 0.03, carbs_g: 2, fat_g: 3.33 },
  ]);
  assertEquals(roundMacros(total), { kcal: 151, protein_g: 10.1, carbs_g: 3.1, fat_g: 3.3 });
});

Deno.test('deviation da el % con un decimal y 0 si el objetivo es 0', () => {
  const target = { kcal: 2000, protein_g: 150, carbs_g: 200, fat_g: 0 };
  assertEquals(deviation({ kcal: 2210, protein_g: 135, carbs_g: 200, fat_g: 12 }, target), {
    kcal: 10.5,
    protein_g: -10,
    carbs_g: 0,
    fat_g: 0,
  });
});

Deno.test('householdMeasure redondea a cuartos y es null sin medida casera', () => {
  assertEquals(householdMeasure(arroz, 200), '1.25 taza');
  assertEquals(householdMeasure({ ...arroz, household_unit: null, household_unit_g: null }, 200), null);
});
