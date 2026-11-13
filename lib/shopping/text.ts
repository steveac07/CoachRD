// Lista de compra en texto plano, para «Copiar lista» (notas, WhatsApp).

import type { ShoppingList, ShopPeriod } from './types';

export const PERIOD_LABELS: Record<ShopPeriod, string> = { week: 'Semana', month: 'Mes' };

export interface ShoppingTextOptions {
  /** Nombre del gimnasio o del coach, para la cabecera. */
  brandName?: string;
  /** Productos ya comprados (`ShoppingItem.key`): salen con ✓ en lugar de guion. */
  checkedKeys?: ReadonlySet<string>;
}

export function shoppingListToText(list: ShoppingList, options: ShoppingTextOptions = {}): string {
  const brand = options.brandName?.trim();
  const title = ['Lista de compra', PERIOD_LABELS[list.period], ...(brand ? [brand] : [])].join(' · ');
  const blocks = list.groups.map((group) =>
    [
      group.title.toUpperCase(),
      ...group.items.map(
        (item) => `${options.checkedKeys?.has(item.key) ? '✓' : '-'} ${item.name}: ${item.quantityLabel}`,
      ),
    ].join('\n'),
  );
  return [title, ...blocks].join('\n\n');
}
