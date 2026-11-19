// Revisión del borrador: el coach ve el plan completo y lo aprueba o lo rechaza (RPC review_diet_plan).
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { Body, Button, Card, Heading, Loading, Notice, Pill, Screen } from '@/components/coach/ui';
import { fetchPlan, type PlanDetail, reviewPlan } from '@/lib/coach/api';
import { joinEs } from '@/lib/coach/generateMessages';
import {
  MACRO_KEYS,
  macroLabel,
  type MacrosView,
  type MealView,
  PLAN_STATUS,
  type PlanView,
  planView,
} from '@/lib/coach/planReview';
import { fmt } from '@/lib/nutrition/targets';

const UNITS: Record<(typeof MACRO_KEYS)[number], string> = { kcal: 'kcal', protein_g: 'g', carbs_g: 'g', fat_g: 'g' };
const NOTE_MAX = 500;

type Message = { level: 'good' | 'warn' | 'bad'; text: string } | null;

function dateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-DO', { dateStyle: 'medium', timeStyle: 'short' });
}

const amount = (key: (typeof MACRO_KEYS)[number], value: number) =>
  key === 'kcal' ? `${fmt(value)} kcal` : `${fmt(value, 1)} g`;

function signedPct(x: number): string {
  return `${x > 0 ? '+' : x < 0 ? '−' : ''}${fmt(Math.abs(x), 1)} %`;
}

function TotalsCard({ view }: { view: PlanView }) {
  if (!view.totals) return null;
  const totals = view.totals;
  return (
    <Card title="Total del día frente al objetivo">
      {MACRO_KEYS.map((key) => {
        const flagged = view.flagged.includes(key);
        const target = view.target?.[key];
        const dev = view.deviation?.[key];
        return (
          <View key={key} className="flex-row flex-wrap items-baseline justify-between gap-2">
            <Text className="text-sm text-muted dark:text-muted-dark">{macroLabel(key).replace(/^./, (c) => c.toUpperCase())}</Text>
            <View className="flex-row items-baseline gap-2">
              <Text className="text-base font-semibold text-ink dark:text-ink-dark" style={{ fontVariant: ['tabular-nums'] }}>
                {target !== undefined ? `${amount(key, totals[key])} de ${fmt(target)} ${UNITS[key]}` : amount(key, totals[key])}
              </Text>
              {dev !== undefined ? <Pill level={flagged ? 'warn' : 'good'}>{signedPct(dev)}</Pill> : null}
            </View>
          </View>
        );
      })}
    </Card>
  );
}

function macroLine(m: MacrosView): string {
  return `P ${fmt(m.protein_g, 1)} g · C ${fmt(m.carbs_g, 1)} g · G ${fmt(m.fat_g, 1)} g`;
}

function MealCard({ meal }: { meal: MealView }) {
  return (
    <Card title={meal.label}>
      <View className="gap-1">
        <Text className="text-lg font-bold text-ink dark:text-ink-dark">{meal.dishName || 'Sin nombre'}</Text>
        {meal.prepTip ? <Body muted>{meal.prepTip}</Body> : null}
      </View>
      <View className="gap-2">
        {meal.items.map((item, index) => (
          <View key={`${item.foodId}-${index}`} className="flex-row flex-wrap items-baseline justify-between gap-2">
            <View className="min-w-0 flex-1">
              <Text className="text-base text-ink dark:text-ink-dark">{item.name}</Text>
              <Text className="text-sm text-muted dark:text-muted-dark">
                {item.household ? `${fmt(item.grams)} g · ${item.household}` : `${fmt(item.grams)} g`}
              </Text>
            </View>
            {item.macros ? (
              <Text className="text-sm font-semibold text-ink dark:text-ink-dark" style={{ fontVariant: ['tabular-nums'] }}>
                {`${fmt(item.macros.kcal)} kcal`}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
      {meal.macros ? (
        <View className="gap-0.5 border-t border-line pt-2 dark:border-line-dark">
          <Text className="text-sm font-semibold text-ink dark:text-ink-dark">
            {meal.target ? `${fmt(meal.macros.kcal)} de ${fmt(meal.target.kcal)} kcal` : `${fmt(meal.macros.kcal)} kcal`}
          </Text>
          <Text className="text-sm text-muted dark:text-muted-dark">{macroLine(meal.macros)}</Text>
        </View>
      ) : null}
    </Card>
  );
}

export default function PlanReviewScreen() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const [plan, setPlan] = useState<PlanDetail | null | undefined>(undefined);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [message, setMessage] = useState<Message>(null);

  const load = useCallback(async () => {
    try {
      setPlan(await fetchPlan(planId));
    } catch {
      setPlan(null);
    }
  }, [planId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (plan === undefined) return <Loading label="Cargando el plan…" />;
  if (plan === null) {
    return (
      <Screen>
        <Notice level="bad">No encontramos este plan entre los de tus socios.</Notice>
      </Screen>
    );
  }

  const view = planView(plan.plan, plan.totals, plan.deviation);
  const status = PLAN_STATUS[plan.status];
  const name = plan.clientName?.trim() || 'el socio';
  const fichaHref = { pathname: '/coach/socio/[id]', params: { id: plan.user_id } } as const;

  async function review(decision: 'approve' | 'reject') {
    setBusy(decision);
    setMessage(null);
    const result = await reviewPlan(planId, decision, note);
    if (result.ok) {
      setMessage(
        result.status === 'approved'
          ? { level: 'good', text: `Plan aprobado. Ya es el plan de ${name}; si tenía otro aprobado, ese queda archivado.` }
          : { level: 'good', text: 'Plan rechazado. Puedes generar otro desde su ficha cuando quieras.' },
      );
      await load();
    } else {
      setMessage({ level: 'bad', text: result.message });
    }
    setBusy(null);
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Revisión del plan' }} />
      <View className="gap-2">
        <Heading eyebrow="Revisión del plan">{plan.clientName?.trim() || 'Socio sin nombre'}</Heading>
        <View className="flex-row flex-wrap items-center gap-2">
          <Pill level={status.level}>{status.label}</Pill>
          <Text className="text-sm text-muted dark:text-muted-dark">{`Generado el ${dateTime(plan.created_at)}`}</Text>
        </View>
      </View>

      {message ? <Notice level={message.level}>{message.text}</Notice> : null}

      {plan.status === 'draft' && view.flagged.length > 0 ? (
        <Notice level="warn">
          {`Revisa ${joinEs(view.flagged.map(macroLabel))} antes de aprobar: ${
            view.flagged.length === 1 ? 'se aleja' : 'se alejan'
          } más del 10 % del objetivo.`}
        </Notice>
      ) : null}

      {view.meals.length === 0 ? <Notice level="bad">Este plan no tiene comidas que mostrar.</Notice> : null}

      <View className="flex-col gap-4 md:flex-row md:items-start">
        <View className="flex-1 gap-4">
          {view.meals.map((meal) => <MealCard key={meal.slot || meal.label} meal={meal} />)}
        </View>

        <View className="gap-4 md:w-96">
          <TotalsCard view={view} />

          {plan.status === 'draft' ? (
            <Card title="Tu revisión">
              <Body muted>{`Al aprobarlo, ${name} lo verá en su app y su lista de compra saldrá de este plan.`}</Body>
              <View className="gap-1">
                <Text nativeID="review-note-label" className="text-sm font-medium text-muted dark:text-muted-dark">
                  Nota (opcional)
                </Text>
                <TextInput
                  testID="review-note"
                  accessibilityLabelledBy="review-note-label"
                  accessibilityLabel="Nota (opcional)"
                  className="min-h-20 rounded-xl border border-line bg-surface px-3 py-2 text-base text-ink dark:border-line-dark dark:bg-surface-dark dark:text-ink-dark"
                  multiline
                  maxLength={NOTE_MAX}
                  textAlignVertical="top"
                  value={note}
                  onChangeText={setNote}
                />
                <Text className="text-xs text-muted dark:text-muted-dark">{`${note.length}/${NOTE_MAX}`}</Text>
              </View>
              <View className="flex-row flex-wrap gap-2">
                <Button label="Aprobar plan" onPress={() => void review('approve')} busy={busy === 'approve'} disabled={busy !== null} />
                <Button
                  label="Rechazar"
                  variant="secondary"
                  onPress={() => void review('reject')}
                  busy={busy === 'reject'}
                  disabled={busy !== null}
                />
              </View>
            </Card>
          ) : (
            <Card title="Revisión">
              <Body>
                {plan.reviewed_at ? `${status.label} el ${dateTime(plan.reviewed_at)}.` : `${status.label}.`}
              </Body>
              {plan.review_note ? <Body muted>{`Nota: ${plan.review_note}`}</Body> : null}
            </Card>
          )}

          {/* Vuelve a la ficha que ya está en la pila (o la abre si se llegó aquí con un enlace directo). */}
          <Button label="Volver a la ficha" variant="secondary" onPress={() => router.dismissTo(fichaHref)} />
        </View>
      </View>
    </Screen>
  );
}
