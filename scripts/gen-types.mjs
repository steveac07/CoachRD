// Genera los tipos de Supabase y los escribe en la app y en las Edge Functions.
// Las Edge Functions no pueden importar fuera de supabase/functions/, así que llevan su copia.
//
//   node scripts/gen-types.mjs --local                    (base local: npm run db:start)
//   node scripts/gen-types.mjs --project-id <project-ref> (proyecto remoto)
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const TARGETS = ['types/database.ts', 'supabase/functions/_shared/database.types.ts'];

const [flag, value] = process.argv.slice(2);
// En la CLI v3 la base local es el destino por defecto: --local ya no hace falta.
const args = ['supabase', 'gen', 'types', 'typescript', '--schema', 'public'];
if (flag === '--project-id' && /^[a-z0-9]+$/.test(value ?? '')) {
  args.push('--project-id', value);
} else if (flag !== '--local') {
  console.error('Uso: node scripts/gen-types.mjs --local | --project-id <project-ref>');
  process.exit(1);
}

// execSync pasa por la shell (cmd.exe en Windows), donde npx es npx.cmd.
const types = execSync(`npx ${args.join(' ')}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
for (const target of TARGETS) {
  writeFileSync(target, types);
  console.log(`Tipos escritos en ${target}`);
}
