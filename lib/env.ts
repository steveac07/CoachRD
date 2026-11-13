// Expo solo inyecta las variables EXPO_PUBLIC_ cuando se leen de forma literal
// (`process.env.EXPO_PUBLIC_X`), así que no se puede indexar process.env dinámicamente.
const rawEnv = {
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
};

type EnvName = keyof typeof rawEnv;

function envError(name: EnvName, problem: string): Error {
  return new Error(
    `[env] ${name} ${problem}. Revisa el archivo .env (usa .env.example como plantilla) ` +
      'y reinicia el servidor con "npx expo start -c".',
  );
}

function required(name: EnvName): string {
  const value = rawEnv[name]?.trim();
  if (!value) {
    throw envError(name, 'no está definida o está vacía');
  }
  return value;
}

function parseSupabaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw envError('EXPO_PUBLIC_SUPABASE_URL', `no es una URL válida ("${value}")`);
  }
  if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    throw envError('EXPO_PUBLIC_SUPABASE_URL', 'debe usar https');
  }
  return value.replace(/\/+$/, '');
}

// La clave del cliente acaba en el bundle: rechazamos cualquier clave con privilegios.
function parsePublishableKey(value: string): string {
  if (value.startsWith('sb_secret_')) {
    throw envError('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'contiene una secret key; usa la publishable (sb_publishable_...) o la anon');
  }
  const payload = value.split('.')[1];
  if (payload) {
    let role: unknown;
    try {
      const json: unknown = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
      role = typeof json === 'object' && json !== null && 'role' in json ? json.role : undefined;
    } catch {
      role = undefined;
    }
    if (role === 'service_role') {
      throw envError('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'contiene la service_role key; usa la anon');
    }
  }
  return value;
}

export const env = {
  supabaseUrl: parseSupabaseUrl(required('EXPO_PUBLIC_SUPABASE_URL')),
  supabasePublishableKey: parsePublishableKey(required('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY')),
} as const;
