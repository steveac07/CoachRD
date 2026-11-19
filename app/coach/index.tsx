import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Body, Button, Card, Heading, Loading, Notice, Pill, Screen } from '@/components/coach/ui';
import { type ClientListItem, createDemoDietForms, fetchClients, fetchDietForms } from '@/lib/coach/api';
import { ageOn, clientName, type DietForm, GOAL_LABELS } from '@/lib/coach/assessment';
import { fmt } from '@/lib/nutrition/targets';
import { supabase } from '@/lib/supabase';
import { useCoach } from '@/providers/CoachProvider';

type Data = { clients: ClientListItem[]; forms: DietForm[] };

export default function ClientsScreen() {
  const coach = useCoach();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);
  const [creatingForms, setCreatingForms] = useState(false);

  const load = useCallback(async () => {
    try {
      const [clients, forms] = await Promise.all([fetchClients(coach.user_id), fetchDietForms(coach.user_id)]);
      setData({ clients, forms });
      setError(false);
    } catch {
      setError(true);
    }
  }, [coach.user_id]);

  // Al volver de una ficha, la lista se actualiza (objetivos recién guardados).
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function createForms() {
    setCreatingForms(true);
    try {
      await createDemoDietForms(coach.user_id);
      await load();
    } catch {
      setError(true);
    }
    setCreatingForms(false);
  }

  if (!data && !error) return <Loading label="Cargando tus socios…" />;

  return (
    <Screen>
      <View className="flex-row flex-wrap items-end justify-between gap-3">
        <Heading eyebrow="Cuaderno del coach">{`Hola, ${coach.display_name}`}</Heading>
        <Button label="Salir" variant="secondary" onPress={() => void supabase.auth.signOut()} />
      </View>

      {error ? <Notice level="bad">No se pudieron cargar tus datos. Revisa tu conexión y vuelve a intentarlo.</Notice> : null}

      {data && data.forms.length === 0 ? (
        <Card title="Formas dietéticas">
          <Body>
            Aún no tienes formas dietéticas. Empieza con las cuatro de la demo: Definición criolla, Recomposición, Volumen
            limpio y Vegetariana.
          </Body>
          <Button label="Crear las formas de la demo" onPress={createForms} busy={creatingForms} />
        </Card>
      ) : null}

      {data ? (
        <Card title={`Socios · ${data.clients.length}`}>
          {data.clients.length === 0 ? (
            <Body muted>Cuando un socio elija tu gimnasio y complete su perfil, aparecerá aquí.</Body>
          ) : (
            <View className="gap-2">
              {data.clients.map(({ profile, targets }) => (
                <Link key={profile.user_id} href={{ pathname: '/coach/socio/[id]', params: { id: profile.user_id } }} asChild>
                  <Pressable
                    accessibilityRole="link"
                    className="min-h-11 flex-row flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface2 px-3 py-3 active:opacity-80 dark:border-line-dark dark:bg-surface2-dark"
                  >
                    <View className="gap-0.5">
                      <Text className="text-base font-semibold text-ink dark:text-ink-dark">{clientName(profile)}</Text>
                      <Text className="text-sm text-muted dark:text-muted-dark">
                        {`${ageOn(profile.birth_date, new Date())} años · ${fmt(profile.weight_kg, 1)} kg · ${
                          GOAL_LABELS[profile.goal] ?? profile.goal
                        }`}
                      </Text>
                    </View>
                    {targets ? (
                      <Pill level="good">{`${fmt(targets.kcal)} kcal/día`}</Pill>
                    ) : (
                      <Pill level="warn">Sin objetivos</Pill>
                    )}
                  </Pressable>
                </Link>
              ))}
            </View>
          )}
        </Card>
      ) : null}
    </Screen>
  );
}
