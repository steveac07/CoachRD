// Resultado del cálculo, con las mismas tarjetas que la ficha de la demo.
import { Text, View } from 'react-native';

import { fmt, type TargetsResult } from '@/lib/nutrition/targets';

import { Body, Card, Pill, Row } from './ui';

const LEVEL_LABEL = { good: 'OK', warn: 'Revisar', bad: 'Alerta' } as const;

function signed(x: number, decimals: number): string {
  return (x > 0 ? '+' : x < 0 ? '−' : '') + fmt(Math.abs(x), decimals);
}

export function TargetsPanel({ result }: { result: TargetsResult }) {
  const t = result.targets;
  const total = t ? t.protein_g * 4 + t.carbs_g * 4 + t.fat_g * 9 : 0;
  const share = (kcal: number) => (total ? Math.round((kcal / total) * 100) : 0);

  return (
    <View className="gap-3">
      <Card title={`Meta en ${result.weeks} semanas`}>
        <View className="flex-row flex-wrap items-center gap-3">
          <Text className="text-3xl font-bold text-ink dark:text-ink-dark">{`${fmt(result.weightKg, 1)} kg`}</Text>
          <Text className="text-xl text-muted dark:text-muted-dark">→</Text>
          <Text className="text-3xl font-bold text-ink dark:text-ink-dark">{`${fmt(result.targetWeightKg, 1)} kg`}</Text>
          <Pill level={result.status.level}>{result.status.label}</Pill>
        </View>
        <Body muted>
          {`${result.status.detail} Ritmo necesario: ${signed(result.neededKgPerWeek, 2)} kg/sem (${
            fmt(Math.abs(result.neededPctPerWeek), 1)
          } %). Grasa: ${fmt(result.bodyFatPct, 1)} % → ${fmt(result.targetBodyFatPct, 1)} %.`}
        </Body>
      </Card>

      <View className="flex-row flex-wrap gap-3">
        <Card title="Composición" className="min-w-56 flex-1">
          <Row label="Masa magra" value={`${fmt(result.leanMassKg, 1)} kg`} />
          <Row label="Masa grasa" value={`${fmt(result.fatMassKg, 1)} kg`} />
          <Row label="IMC" value={fmt(result.bmi, 1)} />
        </Card>
        <Card title="Energía" className="min-w-56 flex-1">
          <Row label="Basal (Katch-McArdle)" value={`${fmt(result.bmr)} kcal`} />
          <Row label="Gasto total" value={`${fmt(result.tdee)} kcal`} />
          <Row label="Plan diario" value={t ? `${fmt(t.kcal)} kcal` : '—'} />
        </Card>
      </View>

      {t ? (
        <Card title="Macros del plan">
          <View
            accessibilityRole="image"
            accessibilityLabel={`Reparto de macros: proteína ${share(t.protein_g * 4)} %, carbohidratos ${
              share(t.carbs_g * 4)
            } %, grasa ${share(t.fat_g * 9)} %`}
            className="h-3 flex-row overflow-hidden rounded-full bg-surface2 dark:bg-surface2-dark"
          >
            <View className="bg-brand" style={{ flex: t.protein_g * 4 }} />
            <View className="bg-warn dark:bg-warn-dark" style={{ flex: t.carbs_g * 4 }} />
            <View className="bg-muted dark:bg-muted-dark" style={{ flex: t.fat_g * 9 }} />
          </View>
          <Row label="Proteína" value={`${t.protein_g} g · ${share(t.protein_g * 4)} %`} />
          <Row label="Carbohidratos" value={`${t.carbs_g} g · ${share(t.carbs_g * 4)} %`} />
          <Row label="Grasa" value={`${t.fat_g} g · ${share(t.fat_g * 9)} %`} />
        </Card>
      ) : null}

      <Card title="Revisión automática">
        {result.checks.length === 0 ? (
          <View className="flex-row items-start gap-2">
            <Pill level="good">OK</Pill>
            <View className="flex-1">
              <Body>{t ? 'Sin alertas. El ritmo y las calorías están en rangos saludables.' : result.status.detail}</Body>
            </View>
          </View>
        ) : (
          result.checks.map((check) => (
            <View key={check.message} className="flex-row items-start gap-2">
              <Pill level={check.level}>{LEVEL_LABEL[check.level]}</Pill>
              <View className="flex-1">
                <Body>{check.message}</Body>
              </View>
            </View>
          ))
        )}
      </Card>
    </View>
  );
}
