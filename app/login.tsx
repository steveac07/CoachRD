import { Redirect, Stack } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, TextInput, View } from 'react-native';

import { Button, Card, Heading, Loading, Notice } from '@/components/coach/ui';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

const INPUT =
  'min-h-11 rounded-xl border border-line bg-surface px-3 text-base text-ink dark:border-line-dark dark:bg-surface-dark dark:text-ink-dark';

export default function LoginScreen() {
  const { session, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) return <Loading />;
  if (session) return <Redirect href="/coach" />;

  async function signIn() {
    setBusy(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    // Si entra, AuthProvider recibe la sesión y la pantalla redirige sola.
    if (authError) {
      setError(
        authError.message === 'Invalid login credentials'
          ? 'El correo o la contraseña no coinciden. Revísalos y prueba otra vez.'
          : 'No se pudo entrar ahora mismo. Prueba otra vez en unos minutos.',
      );
    }
    setBusy(false);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 justify-center bg-canvas px-4 dark:bg-canvas-dark"
    >
      <Stack.Screen options={{ title: 'Entrar', headerShown: false }} />
      <View className="w-full max-w-md gap-4 self-center">
        <Heading eyebrow="Panel del coach">Entra a tu cuaderno</Heading>
        <Card>
          <View className="gap-1">
            <Text nativeID="email-label" className="text-sm font-medium text-muted dark:text-muted-dark">
              Correo
            </Text>
            <TextInput
              testID="login-email"
              accessibilityLabelledBy="email-label"
              accessibilityLabel="Correo"
              className={INPUT}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              inputMode="email"
              value={email}
              onChangeText={setEmail}
            />
          </View>
          <View className="gap-1">
            <Text nativeID="password-label" className="text-sm font-medium text-muted dark:text-muted-dark">
              Contraseña
            </Text>
            <TextInput
              testID="login-password"
              accessibilityLabelledBy="password-label"
              accessibilityLabel="Contraseña"
              className={INPUT}
              autoCapitalize="none"
              autoComplete="password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={signIn}
            />
          </View>
          {error ? <Notice level="bad">{error}</Notice> : null}
          <Button label="Entrar" onPress={signIn} busy={busy} disabled={!email.trim() || !password} />
        </Card>
      </View>
    </KeyboardAvoidingView>
  );
}
