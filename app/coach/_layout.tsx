// Acceso al panel: hace falta sesión y que la cuenta esté en `coaches`.
import { Redirect, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Body, Button, Card, Heading, Loading } from '@/components/coach/ui';
import { fetchCoach } from '@/lib/coach/api';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { type Coach, CoachProvider } from '@/providers/CoachProvider';

type CoachState = { status: 'loading' } | { status: 'coach'; coach: Coach } | { status: 'not_coach' } | { status: 'error' };

export default function CoachLayout() {
  const { user, loading } = useAuth();
  const [state, setState] = useState<CoachState>({ status: 'loading' });

  useEffect(() => {
    if (!user) return;
    let active = true;
    setState({ status: 'loading' });
    fetchCoach(user.id)
      .then((coach) => active && setState(coach ? { status: 'coach', coach } : { status: 'not_coach' }))
      .catch(() => active && setState({ status: 'error' }));
    return () => {
      active = false;
    };
  }, [user]);

  if (loading) return <Loading />;
  if (!user) return <Redirect href="/login" />;
  if (state.status === 'loading') return <Loading label="Abriendo tu cuaderno…" />;

  if (state.status !== 'coach') {
    return (
      <View className="flex-1 justify-center bg-canvas px-4 dark:bg-canvas-dark">
        <View className="w-full max-w-md gap-4 self-center">
          <Heading eyebrow="Panel del coach">
            {state.status === 'not_coach' ? 'Esta cuenta es de socio' : 'No se pudo abrir el panel'}
          </Heading>
          <Card>
            <Body muted>
              {state.status === 'not_coach'
                ? 'El panel es para los coaches del gimnasio. Si eres coach, pide al gimnasio que active tu cuenta.'
                : 'Revisa tu conexión y vuelve a intentarlo.'}
            </Body>
            <Button label="Salir" variant="secondary" onPress={() => void supabase.auth.signOut()} />
          </Card>
        </View>
      </View>
    );
  }

  return (
    <CoachProvider coach={state.coach}>
      <Stack screenOptions={{ headerTintColor: '#0E7C74', headerTitleStyle: { fontWeight: '700' } }}>
        <Stack.Screen name="index" options={{ title: 'Socios' }} />
        <Stack.Screen name="socio/[id]" options={{ title: 'Ficha del socio' }} />
        <Stack.Screen name="plan/[planId]" options={{ title: 'Revisión del plan' }} />
      </Stack>
    </CoachProvider>
  );
}
