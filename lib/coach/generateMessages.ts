// Mensajes para el coach sobre generate-diet-plan, en positivo.

export interface GenerateErrorBody {
  error?: unknown;
  reason?: unknown;
  retry_after_s?: unknown;
}

export function generateErrorMessage(status: number | null, body: GenerateErrorBody | null): string {
  const code = typeof body?.error === 'string' ? body.error : null;
  switch (code) {
    case 'unauthorized':
      return 'Tu sesión terminó. Vuelve a entrar para seguir.';
    case 'forbidden':
      return 'Este socio no está en tu lista.';
    case 'consent_required':
      return 'Falta que el socio acepte el uso de sus datos de salud en su app. En cuanto lo haga, podrás generar su plan.';
    case 'targets_required':
      return 'Guarda primero los objetivos y después genera el plan.';
    case 'empty_catalog':
      return 'Con sus exclusiones no quedan alimentos disponibles. Revisa la forma dietética o las exclusiones.';
    case 'invalid_meals_per_day':
      return 'Revisa las comidas al día de la forma dietética (de 3 a 6).';
    case 'too_many_requests': {
      const seconds = typeof body?.retry_after_s === 'number' ? body.retry_after_s : null;
      const minutes = seconds ? Math.max(1, Math.ceil(seconds / 60)) : null;
      return minutes
        ? `Ya generaste un plan hace poco. Podrás pedir otro en ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}.`
        : 'Ya generaste un plan hace poco. Prueba de nuevo en unos minutos.';
    }
    case 'ai_generation_failed':
      return body?.reason === 'invalid_plan'
        ? 'La propuesta no cumplía tus reglas y se descartó. Prueba a generarla otra vez.'
        : 'Esta vez no se pudo preparar el plan. Prueba otra vez en unos minutos.';
    default:
      return status !== null && status >= 500
        ? 'El generador no está disponible ahora mismo. Prueba otra vez en unos minutos.'
        : 'No se pudo generar el plan. Prueba otra vez.';
  }
}

const MACRO_LABELS: Record<string, string> = {
  kcal: 'calorías',
  protein_g: 'proteína',
  carbs_g: 'carbohidratos',
  fat_g: 'grasa',
};

/** «a», «a y b», «a, b y c». */
export function joinEs(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
}

/** Mensaje tras generar el borrador. `flagged`: macros que se desvían más de ±10 % del objetivo. */
export function draftReadyMessage(flagged: readonly string[]): string {
  if (flagged.length === 0) {
    return 'Borrador listo y dentro del ±10 % en todos los macros. El socio lo verá cuando lo apruebes.';
  }
  const labels = flagged.map((f) => MACRO_LABELS[f] ?? f);
  return `Borrador listo. Revisa ${joinEs(labels)}: ${labels.length === 1 ? 'se aleja' : 'se alejan'} más del 10 % del objetivo.`;
}
