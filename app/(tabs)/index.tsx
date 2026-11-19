import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Body, Card, Heading, Screen } from '@/components/coach/ui';

export default function HomeScreen() {
  return (
    <Screen>
      <View className="gap-4 pt-10">
        <Heading eyebrow="CoachRD">Nutrición y entrenamiento de tu gimnasio</Heading>
        <Card>
          <Body>
            El coach define las formas dietéticas y los objetivos de cada socio. El plan se calcula por reglas y el coach lo
            aprueba antes de que el socio lo vea.
          </Body>
          <Link href="/login" asChild>
            <Pressable
              accessibilityRole="link"
              className="min-h-11 items-center justify-center rounded-xl bg-brand px-4 py-2.5 active:opacity-80"
            >
              <Text className="text-base font-semibold text-white">Entrar al panel del coach</Text>
            </Pressable>
          </Link>
        </Card>
      </View>
    </Screen>
  );
}
