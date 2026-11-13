import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { env } from '@/lib/env';
import type { Database } from '@/types/database';

// Durante el renderizado estático de Expo Router (Node) Platform.OS es 'web' pero no existe window:
// sin sesión que persistir ni pestaña que refrescar.
const isServer = Platform.OS === 'web' && typeof window === 'undefined';

export const supabase = createClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
  auth: {
    // En web supabase-js usa localStorage por defecto (y memoria si no existe, como en el servidor).
    // AsyncStorage solo en nativo: su implementación web accede a window y rompe el render estático.
    ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
    autoRefreshToken: !isServer,
    persistSession: !isServer,
    detectSessionInUrl: false,
  },
});

// En nativo el refresco automático del token solo corre con la app en primer plano.
// Se registra una sola vez, al cargar el módulo. En web supabase-js ya escucha visibilitychange.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
