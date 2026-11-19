// Ejecuta calc() de la demo aprobada (referencia/coachrd-demo.html) con varios socios de ejemplo y
// guarda lo que devuelve. lib/nutrition/__tests__/targets.test.ts comprueba que el cálculo de la app
// da exactamente lo mismo. Si cambia la demo, vuelve a ejecutarlo:  node scripts/demo-golden.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const OUT = 'lib/nutrition/__tests__/demo-calc.golden.json';
const html = readFileSync('referencia/coachrd-demo.html', 'utf8');

function extract(startMarker, endMarker) {
  const start = html.indexOf(startMarker);
  if (start < 0) throw new Error(`No encuentro «${startMarker}» en la demo`);
  const end = html.indexOf(endMarker, start);
  if (end < 0) throw new Error(`No encuentro el final de «${startMarker}»`);
  return html.slice(start, end + endMarker.length);
}

const source = [
  extract('const clamp =', ';\n'),
  extract('const fmt =', ';\n'),
  extract('function calc(cl, t){', '\n  return o;\n}'),
].join('\n');
const calc = new Function(`${source}\nreturn calc;`)();

// Formas dietéticas de ejemplo de la demo
const FORMS = {
  def: { name: 'Definición criolla', adjust: -20, protein: 2.4, fatPct: 25 },
  recomp: { name: 'Recomposición', adjust: -10, protein: 2.2, fatPct: 28 },
  vol: { name: 'Volumen limpio', adjust: 10, protein: 2.0, fatPct: 25 },
  veg: { name: 'Vegetariana', adjust: -10, protein: 2.2, fatPct: 30 },
};

const base = { sex: 'F', weight: 70, height: 165, bf: 30, tbf: 24, lean: 1, weeks: 16, act: 1.55, kcalAdj: 0 };
const CASES = [
  ['pérdida en plazo', { ...base }, 'def'],
  ['recomposición de un hombre activo', { ...base, sex: 'M', weight: 88, height: 180, bf: 22, tbf: 15, lean: 2, weeks: 20, act: 1.725 }, 'recomp'],
  ['necesita más semanas', { ...base, bf: 35, tbf: 25, weeks: 10 }, 'recomp'],
  ['ritmo de pérdida muy alto', { ...base, weight: 95, bf: 40, tbf: 22, weeks: 8 }, 'def'],
  ['ritmo de pérdida exigente', { ...base, weight: 80, bf: 32, tbf: 25, weeks: 6, act: 1.375 }, 'def'],
  ['volumen con ganancia alta', { ...base, sex: 'M', weight: 65, height: 175, bf: 12, tbf: 12, lean: 6, weeks: 8, act: 1.9 }, 'vol'],
  ['mantenimiento', { ...base, bf: 25, tbf: 25, lean: 0 }, 'recomp'],
  ['dirección contraria', { ...base, sex: 'M', weight: 60, height: 178, bf: 10, tbf: 10, lean: 5, weeks: 20 }, 'def'],
  ['meta de grasa por debajo del rango saludable', { ...base, tbf: 12, weeks: 40 }, 'def'],
  ['calorías por debajo del basal y carbohidrato bajo', { ...base, weight: 52, height: 150, bf: 28, tbf: 22, act: 1.2, kcalAdj: -300 }, 'def'],
  ['ajuste fino positivo y vegetariana', { ...base, kcalAdj: 150 }, 'veg'],
  ['valores fuera de rango se acotan', { ...base, weight: 300, height: 100, bf: 80, tbf: 1, weeks: 0, lean: 20, kcalAdj: 900 }, 'recomp'],
  ['sin forma dietética', { ...base }, null],
];

const cases = CASES.map(([name, client, formId]) => {
  const form = formId ? FORMS[formId] : null;
  return { name, client, form, expected: calc(client, form) };
});

writeFileSync(OUT, JSON.stringify({ source: 'referencia/coachrd-demo.html · calc()', cases }, null, 2) + '\n');
console.log(`${cases.length} casos escritos en ${OUT}`);
