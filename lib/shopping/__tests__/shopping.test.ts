import {
  buildShoppingList,
  formatQuantity,
  menuFromPlanJson,
  repeatDailyMenu,
  roundUpToBuy,
  shoppingListKey,
  shoppingListToText,
  shopSection,
  toShoppingFood,
  type DayMenu,
  type FoodBuyRow,
  type ShoppingFood,
  type ShoppingItem,
  type ShoppingList,
  type ShopPeriod,
} from '../index';

function food(row: Partial<FoodBuyRow> & { id: string }): ShoppingFood {
  return toShoppingFood({ name: row.id, category: 'otro', ...row });
}

const pollo = food({ id: 'pollo', name: 'Pechuga de pollo guisada', category: 'proteina', buy_name: 'Pechuga de pollo', raw_g_per_100g: 135 });
const arroz = food({ id: 'arroz', name: 'Arroz blanco cocido', category: 'carbohidrato', buy_name: 'Arroz blanco', raw_g_per_100g: 38 });
const pan = food({
  id: 'pan',
  name: 'Pan integral',
  category: 'carbohidrato',
  buy_unit: 'un',
  unit_g: 30,
  unit_label_singular: 'rebanada',
  unit_label_plural: 'rebanadas',
});
const aceite = food({ id: 'aceite', name: 'Aceite de oliva', category: 'grasa', buy_unit: 'ml', raw_g_per_100g: 109 });
const yogur = food({ id: 'yogur', name: 'Yogur griego natural', category: 'lacteo', buy_unit: 'g' });
const batata = food({ id: 'batata', name: 'Batata hervida', category: 'carbohidrato', buy_name: 'Batata', raw_g_per_100g: 120, is_fresh: true });
const huevo = food({ id: 'huevo', name: 'Huevo entero', category: 'proteina', buy_name: 'Huevos', buy_unit: 'un', unit_g: 50, unit_label_singular: 'huevo', unit_label_plural: 'huevos', shop_section: 'lacteos' });
const clara = food({ id: 'clara', name: 'Clara de huevo', category: 'proteina', buy_name: 'Huevos', buy_unit: 'un', unit_g: 33, unit_label_singular: 'huevo', unit_label_plural: 'huevos', shop_section: 'lacteos' });

const CATALOG = [pollo, arroz, pan, aceite, yogur, batata, huevo, clara];

/** Semana con el mismo menú los 7 días. */
function sameEveryDay(day: DayMenu): DayMenu[] {
  return repeatDailyMenu(day);
}

/** Semana de 7 días en la que el total indicado cae en el primer día. */
function weekWithTotal(foodId: string, grams: number): DayMenu[] {
  return [[{ foodId, grams }], [], [], [], [], [], []];
}

function list(days: DayMenu[], period: ShopPeriod = 'week'): ShoppingList {
  return buildShoppingList({ days, foods: CATALOG, period });
}

function onlyItem(result: ShoppingList): ShoppingItem {
  const items = result.groups.flatMap((group) => group.items);
  expect(items).toHaveLength(1);
  return items[0];
}

describe('buildShoppingList · casos de referencia', () => {
  // 320 g al día × 7 = 2.240 g cocidos → 3.024 g crudos → 6,67 lb → 6¾ lb
  const semanaDePollo = sameEveryDay([{ foodId: 'pollo', grams: 320 }]);

  it('2.240 g de pollo cocido con rendimiento 135 son «6¾ lb»', () => {
    const item = onlyItem(list(semanaDePollo));
    expect(item.planGrams).toBe(2240);
    expect(item.quantity).toBe(6.75);
    expect(item.quantityLabel).toBe('6¾ lb');
    expect(item.detail).toBe('≈ 3.06 kg');
  });

  it('ese mismo pollo en modo mes son «26¾ lb» (semana × 4 antes de redondear)', () => {
    const item = onlyItem(list(semanaDePollo, 'month'));
    expect(item.quantityLabel).toBe('26¾ lb');
    expect(item.weeklyOnly).toBe(false);
  });

  it('1.000 g de arroz cocido con rendimiento 38 son «1 lb»', () => {
    expect(onlyItem(list(weekWithTotal('arroz', 1000))).quantityLabel).toBe('1 lb');
  });

  it('950 g de pan a 30 g por unidad son «32 rebanadas»', () => {
    const item = onlyItem(list(weekWithTotal('pan', 950)));
    expect(item.quantityLabel).toBe('32 rebanadas');
    expect(item.detail).toBe('950 g en el plan');
  });

  it('170 g de aceite con rendimiento 109 en ml son «200 ml»', () => {
    expect(onlyItem(list(weekWithTotal('aceite', 170))).quantityLabel).toBe('200 ml');
  });

  it('1.210 g de yogur en gramos son «1.25 kg»', () => {
    expect(onlyItem(list(weekWithTotal('yogur', 1210))).quantityLabel).toBe('1.25 kg');
  });

  it('un fresco en modo mes muestra la cantidad de una semana y va al grupo de frescos', () => {
    const days = sameEveryDay([
      { foodId: 'batata', grams: 150 },
      { foodId: 'pollo', grams: 320 },
    ]);
    const semana = list(days, 'week');
    const mes = list(days, 'month');

    const batataSemana = semana.groups.flatMap((g) => g.items).find((i) => i.name === 'Batata');
    expect(semana.groups.map((g) => g.id)).toEqual(['carnes', 'viveres']);
    expect(batataSemana?.quantityLabel).toBe('3 lb'); // 1.050 g × 1,2 = 1.260 g → 2,78 lb

    expect(mes.groups.map((g) => g.id)).toEqual(['carnes', 'frescos']);
    const frescos = mes.groups.find((g) => g.id === 'frescos');
    expect(frescos?.title).toBe('Frescos · cómpralos cada semana');
    expect(frescos?.items).toHaveLength(1);
    expect(frescos?.items[0].quantityLabel).toBe('3 lb');
    expect(frescos?.items[0].weeklyOnly).toBe(true);
    // El pollo, que no es fresco, sí se multiplica por 4.
    expect(mes.groups[0].items[0].quantityLabel).toBe('26¾ lb');
  });

  it('dos alimentos con el mismo buy_name se suman en una sola línea', () => {
    // 100 g de huevo (2 huevos) + 99 g de clara (3 huevos) al día = 5 huevos × 7 días
    const item = onlyItem(
      list(
        sameEveryDay([
          { foodId: 'huevo', grams: 100 },
          { foodId: 'clara', grams: 99 },
        ]),
      ),
    );
    expect(item.name).toBe('Huevos');
    expect(item.quantityLabel).toBe('35 huevos');
    expect(item.foodIds).toEqual(['clara', 'huevo']);
    expect(item.section).toBe('lacteos');
    expect(item.key).toBe('huevos:un');
  });
});

describe('buildShoppingList · reglas', () => {
  it('el premio canjeado no entra en la lista', () => {
    const result = list(
      sameEveryDay([
        { foodId: 'pollo', grams: 320 },
        { foodId: 'pan', grams: 120, isReward: true },
      ]),
    );
    expect(result.itemCount).toBe(1);
    expect(onlyItem(result).name).toBe('Pechuga de pollo');
  });

  it('suma día a día cuando los menús de la semana son distintos', () => {
    const days: DayMenu[] = [
      [{ foodId: 'arroz', grams: 200 }],
      [{ foodId: 'arroz', grams: 300 }],
      [],
      [{ foodId: 'arroz', grams: 500 }],
      [],
      [],
      [],
    ];
    expect(onlyItem(list(days)).planGrams).toBe(1000);
  });

  it('agrupa por secciones en orden de supermercado y ordena los productos', () => {
    const result = list(
      sameEveryDay([
        { foodId: 'aceite', grams: 10 },
        { foodId: 'arroz', grams: 150 },
        { foodId: 'yogur', grams: 170 },
        { foodId: 'pollo', grams: 150 },
        { foodId: 'batata', grams: 150 },
      ]),
    );
    expect(result.groups.map((g) => g.title)).toEqual([
      'Carnes y pescados',
      'Huevos y lácteos',
      'Víveres, frutas y vegetales',
      'Granos y despensa',
    ]);
    expect(result.groups[3].items.map((i) => i.name)).toEqual(['Aceite de oliva', 'Arroz blanco']);
    expect(result.itemCount).toBe(5);
  });

  it('avisa de los alimentos del menú que no están en el catálogo', () => {
    const result = list(weekWithTotal('no_existe', 100));
    expect(result.itemCount).toBe(0);
    expect(result.missingFoodIds).toEqual(['no_existe']);
  });

  it('no depende del orden de las comidas', () => {
    const a = list(sameEveryDay([{ foodId: 'huevo', grams: 100 }, { foodId: 'clara', grams: 99 }, { foodId: 'pollo', grams: 200 }]));
    const b = list(sameEveryDay([{ foodId: 'pollo', grams: 200 }, { foodId: 'clara', grams: 99 }, { foodId: 'huevo', grams: 100 }]));
    expect(a).toEqual(b);
  });

  it('un alimento nuevo sin datos de compra entra por libras con su propio nombre', () => {
    const nuevo = toShoppingFood({ id: 'yuca_hervida', name: 'Yuca hervida', category: 'carbohidrato' });
    expect(nuevo).toMatchObject({ buyName: 'Yuca hervida', unit: 'lb', rawPer100: 100, isFresh: false, section: 'despensa' });
    const result = buildShoppingList({ days: weekWithTotal('yuca_hervida', 900), foods: [nuevo], period: 'week' });
    expect(onlyItem(result).quantityLabel).toBe('2 lb'); // 900 g = 1,98 lb
  });

  it('por unidades sin gramos por unidad se compra al peso', () => {
    const sinGramos = toShoppingFood({ id: 'guineo', name: 'Guineo', category: 'carbohidrato', buy_unit: 'un' });
    expect(sinGramos.unit).toBe('lb');
  });
});

describe('roundUpToBuy y formatQuantity', () => {
  it('redondea siempre hacia arriba', () => {
    expect(roundUpToBuy(1, 'lb')).toBe(0.25); // 1 g crudo ya es ¼ lb
    expect(roundUpToBuy(453.59237, 'lb')).toBe(1); // 1 lb exacta no sube
    expect(roundUpToBuy(454, 'lb')).toBe(1.25);
    expect(roundUpToBuy(31.01, 'un')).toBe(32);
    expect(roundUpToBuy(1000, 'g')).toBe(1000); // un valor que ya está en el paso no sube
    expect(roundUpToBuy(1001, 'g')).toBe(1050);
    expect(roundUpToBuy(185.3, 'ml')).toBe(200);
    expect(roundUpToBuy(0, 'lb')).toBe(0);
  });

  it('da formato a libras con fracciones', () => {
    expect(formatQuantity(0.25, 'lb')).toBe('¼ lb');
    expect(formatQuantity(0.5, 'lb')).toBe('½ lb');
    expect(formatQuantity(0.75, 'lb')).toBe('¾ lb');
    expect(formatQuantity(1, 'lb')).toBe('1 lb');
    expect(formatQuantity(2.5, 'lb')).toBe('2½ lb');
    expect(formatQuantity(26.75, 'lb')).toBe('26¾ lb');
  });

  it('da formato a unidades, gramos y mililitros', () => {
    expect(formatQuantity(1, 'un', { singular: 'aguacate', plural: 'aguacates' })).toBe('1 aguacate');
    expect(formatQuantity(3, 'un', { singular: 'aguacate', plural: 'aguacates' })).toBe('3 aguacates');
    expect(formatQuantity(4, 'un')).toBe('4 unidades');
    expect(formatQuantity(950, 'g')).toBe('950 g');
    expect(formatQuantity(1000, 'g')).toBe('1 kg');
    expect(formatQuantity(1250, 'g')).toBe('1.25 kg');
    expect(formatQuantity(200, 'ml')).toBe('200 ml');
    expect(formatQuantity(1500, 'ml')).toBe('1.5 L');
  });
});

describe('shopSection', () => {
  it('respeta la sección que puso el coach', () => {
    expect(shopSection({ category: 'proteina', shop_section: 'lacteos' })).toBe('lacteos');
  });

  it('la deduce de la categoría cuando no hay sección', () => {
    expect(shopSection({ category: 'proteina' })).toBe('carnes');
    expect(shopSection({ category: 'lacteo' })).toBe('lacteos');
    expect(shopSection({ category: 'vegetal' })).toBe('viveres');
    expect(shopSection({ category: 'carbohidrato' })).toBe('despensa');
    expect(shopSection({ category: 'carbohidrato', is_fresh: true })).toBe('viveres');
    expect(shopSection({ category: 'grasa', shop_section: 'otra' })).toBe('despensa');
  });
});

describe('shoppingListToText', () => {
  const result = list(
    sameEveryDay([
      { foodId: 'pollo', grams: 320 },
      { foodId: 'batata', grams: 150 },
    ]),
    'month',
  );

  it('escribe la lista por grupos, lista para pegar', () => {
    expect(shoppingListToText(result, { brandName: 'Atlántico Fit' })).toBe(
      [
        'Lista de compra · Mes · Atlántico Fit',
        '',
        'CARNES Y PESCADOS',
        '- Pechuga de pollo: 26¾ lb',
        '',
        'FRESCOS · CÓMPRALOS CADA SEMANA',
        '- Batata: 3 lb',
      ].join('\n'),
    );
  });

  it('marca lo que ya está comprado', () => {
    const text = shoppingListToText(result, { checkedKeys: new Set(['pechuga-de-pollo:peso']) });
    expect(text).toContain('✓ Pechuga de pollo: 26¾ lb');
    expect(text).toContain('- Batata: 3 lb');
  });
});

describe('del plan aprobado a la semana', () => {
  const plan = {
    meals: [
      { slot: 'desayuno', dish_name: 'Mangú con huevo', items: [{ food_id: 'huevo', name: 'Huevo entero', grams: 100 }] },
      { slot: 'almuerzo', dish_name: 'La bandera', items: [{ food_id: 'pollo', grams: 180 }, { food_id: 'arroz', grams: 200 }] },
      { slot: 'cena', dish_name: 'Pollo con batata', items: [{ food_id: 'pollo', grams: 140 }, { food_id: 'sin_gramos' }] },
      { slot: 'premio', is_reward: true, items: [{ food_id: 'pan', grams: 120 }] },
    ],
  };

  it('lee los alimentos y gramos del JSON del plan', () => {
    expect(menuFromPlanJson(plan)).toEqual([
      { foodId: 'huevo', grams: 100 },
      { foodId: 'pollo', grams: 180 },
      { foodId: 'arroz', grams: 200 },
      { foodId: 'pollo', grams: 140 },
      { foodId: 'pan', grams: 120, isReward: true },
    ]);
  });

  it('ignora lo que no tiene forma de plan', () => {
    expect(menuFromPlanJson(null)).toEqual([]);
    expect(menuFromPlanJson('plan')).toEqual([]);
    expect(menuFromPlanJson({ meals: 'ninguna' })).toEqual([]);
    expect(menuFromPlanJson({ meals: [null, { items: [42] }] })).toEqual([]);
  });

  it('repite el plan diario 7 días y calcula la compra de la semana', () => {
    const days = repeatDailyMenu(menuFromPlanJson(plan));
    expect(days).toHaveLength(7);
    const items = list(days).groups.flatMap((g) => g.items);
    // Pollo: (180 + 140) × 7 = 2.240 g cocidos. El pan del premio no entra.
    expect(items.map((i) => `${i.name}: ${i.quantityLabel}`)).toEqual([
      'Pechuga de pollo: 6¾ lb',
      'Huevos: 14 huevos',
      'Arroz blanco: 1¼ lb',
    ]);
  });

  it('la clave de la lista cambia con el plan y con el periodo', () => {
    expect(shoppingListKey('plan-1', 'week')).toBe('plan-1:week');
    expect(shoppingListKey('plan-1', 'month')).not.toBe(shoppingListKey('plan-1', 'week'));
    expect(shoppingListKey('plan-2', 'week')).not.toBe(shoppingListKey('plan-1', 'week'));
  });
});
