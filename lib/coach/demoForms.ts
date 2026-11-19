// Las cuatro formas dietéticas de ejemplo de la demo aprobada. El coach las crea con un botón
// mientras no exista el editor de formas.
import type { TablesInsert } from '@/types/database';

type DemoForm = Omit<TablesInsert<'diet_forms'>, 'coach_id'>;

export const DEMO_DIET_FORMS: readonly DemoForm[] = [
  {
    name: 'Definición criolla',
    kcal_adjust_pct: -20,
    protein_g_per_kg_lbm: 2.4,
    fat_pct: 25,
    meals_per_day: 4,
    excluded_origins: [],
    note: 'Déficit moderado con víveres hervidos y guisos sin fritura.',
  },
  {
    name: 'Recomposición',
    kcal_adjust_pct: -10,
    protein_g_per_kg_lbm: 2.2,
    fat_pct: 28,
    meals_per_day: 4,
    excluded_origins: [],
    note: 'Déficit suave y proteína alta para ganar músculo mientras baja grasa.',
  },
  {
    name: 'Volumen limpio',
    kcal_adjust_pct: 10,
    protein_g_per_kg_lbm: 2.0,
    fat_pct: 25,
    meals_per_day: 5,
    excluded_origins: [],
    note: 'Superávit pequeño repartido en cinco tomas.',
  },
  {
    name: 'Vegetariana',
    kcal_adjust_pct: -10,
    protein_g_per_kg_lbm: 2.2,
    fat_pct: 30,
    meals_per_day: 4,
    excluded_origins: ['carne', 'pescado', 'marisco'],
    note: 'Sin carnes ni pescados. Admite huevo y lácteos.',
  },
];
