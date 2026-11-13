// Pantalla temporal de diagnóstico (solo __DEV__). Borrar cuando exista el flujo de login real.
// Web: /dev/supabase-check · Expo Go: exp://<ip>:8081/--/dev/supabase-check
import { Redirect, Stack } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

type FoodsCount = { status: 'idle' | 'loading' } | { status: 'ok'; count: number } | { status: 'error'; message: string };

export default function SupabaseCheckRoute() {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }
  return <SupabaseCheckScreen />;
}

function SupabaseCheckScreen() {
  const { session, user, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [foods, setFoods] = useState<FoodsCount>({ status: 'idle' });

  // Solo lectura: head + count no descarga filas. Con RLS, sin sesión debe dar 0 sin error.
  const countFoods = useCallback(async () => {
    setFoods({ status: 'loading' });
    const { count, error } = await supabase.from('foods').select('*', { count: 'exact', head: true });
    setFoods(error ? { status: 'error', message: error.message } : { status: 'ok', count: count ?? 0 });
  }, []);

  useEffect(() => {
    if (!loading) {
      void countFoods();
    }
  }, [loading, session?.access_token, countFoods]);

  async function signIn() {
    setAuthBusy(true);
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setAuthError(error.message);
    } else {
      setPassword('');
    }
    setAuthBusy(false);
  }

  async function signOut() {
    setAuthBusy(true);
    setAuthError(null);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthError(error.message);
    }
    setAuthBusy(false);
  }

  return (
    <ScrollView className="flex-1 bg-white dark:bg-neutral-950" contentContainerClassName="gap-6 p-5" keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Supabase (dev)' }} />

      <Section title="Sesión">
        {loading ? (
          <ActivityIndicator />
        ) : session ? (
          <>
            <Text className="text-base text-green-700 dark:text-green-400">Con sesión</Text>
            <Text className="text-sm text-neutral-700 dark:text-neutral-300">{user?.email ?? user?.id}</Text>
            <Button label="Cerrar sesión" onPress={signOut} disabled={authBusy} />
          </>
        ) : (
          <>
            <Text className="text-base text-neutral-700 dark:text-neutral-300">Sin sesión</Text>
            <TextInput
              className="rounded-lg border border-neutral-300 px-3 py-2 text-base text-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
              placeholder="Email"
              placeholderTextColor="#a3a3a3"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              className="rounded-lg border border-neutral-300 px-3 py-2 text-base text-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
              placeholder="Contraseña"
              placeholderTextColor="#a3a3a3"
              autoCapitalize="none"
              autoComplete="password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={signIn}
            />
            <Button label="Iniciar sesión" onPress={signIn} disabled={authBusy || !email.trim() || !password} />
          </>
        )}
        {authError && <Text className="text-sm text-red-600 dark:text-red-400">{authError}</Text>}
      </Section>

      <Section title="Tabla foods">
        {foods.status === 'ok' && (
          <Text className="text-base text-neutral-900 dark:text-neutral-100">
            {foods.count} filas visibles {session ? '(esperado: 10)' : '(esperado sin sesión: 0)'}
          </Text>
        )}
        {foods.status === 'error' && <Text className="text-sm text-red-600 dark:text-red-400">Error: {foods.message}</Text>}
        {(foods.status === 'loading' || foods.status === 'idle') && <ActivityIndicator />}
        <Button label="Volver a contar" onPress={countFoods} disabled={foods.status === 'loading'} />
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <Text className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{title}</Text>
      {children}
    </View>
  );
}

function Button({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      className={`items-center rounded-lg bg-blue-600 px-4 py-3 active:bg-blue-700 ${disabled ? 'opacity-50' : ''}`}
      onPress={onPress}
      disabled={disabled}
    >
      <Text className="text-base font-semibold text-white">{label}</Text>
    </Pressable>
  );
}
