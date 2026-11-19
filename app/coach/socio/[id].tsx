// Ficha del socio: valoración del coach, cálculo en vivo (reglas de la demo), guardar objetivos y
// generar el borrador del plan con la Edge Function.
import { Link, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { TargetsPanel } from '@/components/coach/TargetsPanel';
import { Body, Button, Card, Choice, Heading, LinkButton, Loading, Notice, NumberField, Pill, Row, Screen } from '@/components/coach/ui';
import {
  type ClientDetail,
  fetchClientDetail,
  fetchDietForms,
  type GenerateResult,
  generatePlan,
  saveAssessment,
} from '@/lib/coach/api';
import {
  ageOn,
  type AssessmentDraft,
  clientName,
  type DietForm,
  type DraftField,
  draftFromAssessment,
  FIELD_RULES,
  GOAL_LABELS,
  preview,
  saveBlockers,
  validateDraft,
} from '@/lib/coach/assessment';
import { draftReadyMessage } from '@/lib/coach/generateMessages';
import { PLAN_STATUS } from '@/lib/coach/planReview';
import { ACTIVITY_LABELS, fmt, isActivityLevel } from '@/lib/nutrition/targets';
import { useCoach } from '@/providers/CoachProvider';

const FIELD_ORDER: readonly DraftField[] = ['bodyFatPct', 'targetBodyFatPct', 'leanGainKg', 'weeks', 'kcalAdjust'];

type Message = { level: 'good' | 'warn' | 'bad'; text: string } | null;

function sameDraft(a: AssessmentDraft, b: AssessmentDraft): boolean {
  return FIELD_ORDER.every((f) => a[f].trim() === b[f].trim()) && a.dietFormId === b.dietFormId;
}

function dateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-DO', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function ClientScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const coach = useCoach();
  const [detail, setDetail] = useState<ClientDetail | null | undefined>(undefined);
  const [forms, setForms] = useState<DietForm[]>([]);
  const [saved, setSaved] = useState<AssessmentDraft | null>(null);
  const [draft, setDraft] = useState<AssessmentDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [lastPlan, setLastPlan] = useState<Extract<GenerateResult, { ok: true }> | null>(null);

  const load = useCallback(async () => {
    try {
      const [d, f] = await Promise.all([fetchClientDetail(id), fetchDietForms(coach.user_id)]);
      setDetail(d);
      setForms(f);
      if (d) {
        const initial = draftFromAssessment(d.assessment);
        setSaved(initial);
        setDraft((current) => current ?? initial);
      }
    } catch {
      setDetail(null);
    }
  }, [id, coach.user_id]);

  // Al volver de revisar un plan, la ficha se actualiza (estado de los planes recientes).
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const validation = useMemo(() => (draft ? validateDraft(draft) : null), [draft]);
  const form = forms.find((f) => f.id === draft?.dietFormId) ?? null;
  const result = useMemo(
    () => (detail && validation?.ok ? preview(detail.profile, validation.values, form) : null),
    [detail, validation, form],
  );

  if (detail === undefined || !draft || !saved) return <Loading label="Cargando la ficha…" />;
  if (detail === null) {
    return (
      <Screen>
        <Notice level="bad">No encontramos a este socio en tu lista.</Notice>
      </Screen>
    );
  }

  const { profile } = detail;
  const dirty = !sameDraft(draft, saved);
  const blockers = result ? saveBlockers(result, form) : [];
  const canSave = !!validation?.ok && !!result?.targets && !!form && blockers.length === 0 && (dirty || !detail.targets);
  const consent = !!profile.consent_health_data_at;
  const canGenerate = !!detail.targets && !dirty && consent;

  const set = (field: DraftField) => (text: string) => {
    setMessage(null);
    setDraft({ ...draft, [field]: text });
  };

  async function save() {
    if (!validation?.ok || !result?.targets || !form) return;
    setSaving(true);
    setMessage(null);
    try {
      await saveAssessment(profile.user_id, validation.values, result.targets, form);
      setSaved(draft);
      await load();
      setMessage({ level: 'good', text: 'Objetivos guardados. Ya puedes generar su plan.' });
    } catch {
      setMessage({ level: 'bad', text: 'No se pudieron guardar los objetivos. Revisa tu conexión y vuelve a intentarlo.' });
    }
    setSaving(false);
  }

  async function generate() {
    setGenerating(true);
    setMessage(null);
    setLastPlan(null);
    const response = await generatePlan(profile.user_id);
    if (response.ok) {
      setLastPlan(response);
      await load();
    } else {
      setMessage({ level: 'bad', text: response.message });
    }
    setGenerating(false);
  }

  const activity = isActivityLevel(profile.activity_level) ? ACTIVITY_LABELS[profile.activity_level] : profile.activity_level;

  return (
    <Screen>
      <Stack.Screen options={{ title: clientName(profile) }} />
      <Heading eyebrow="Ficha del socio">{clientName(profile)}</Heading>

      <View className="flex-col gap-4 md:flex-row md:items-start">
        <View className="gap-4 md:w-96">
          <Card title="Datos del socio">
            <Row label="Sexo" value={profile.sex === 'M' ? 'Hombre' : 'Mujer'} />
            <Row label="Edad" value={`${ageOn(profile.birth_date, new Date())} años`} />
            <Row label="Peso" value={`${fmt(profile.weight_kg, 1)} kg`} />
            <Row label="Altura" value={`${fmt(profile.height_cm)} cm`} />
            <Row label="Actividad" value={activity} />
            <Row label="Meta" value={GOAL_LABELS[profile.goal] ?? profile.goal} />
            <Body muted>Estos datos los mantiene el socio desde su app.</Body>
          </Card>

          <Card title="Tu valoración">
            <View className="flex-row flex-wrap gap-3">
              {FIELD_ORDER.map((field) => (
                <NumberField
                  key={field}
                  id={`field-${field}`}
                  label={FIELD_RULES[field].label}
                  unit={FIELD_RULES[field].unit}
                  value={draft[field]}
                  onChange={set(field)}
                  error={validation && !validation.ok ? validation.errors[field] : undefined}
                />
              ))}
            </View>
            {forms.length === 0 ? (
              <Notice level="warn">Crea primero tus formas dietéticas desde la lista de socios.</Notice>
            ) : (
              <Choice
                label="Forma dietética"
                value={draft.dietFormId}
                onChange={(value) => {
                  setMessage(null);
                  setDraft({ ...draft, dietFormId: value });
                }}
                options={forms.map((f) => ({
                  value: f.id,
                  label: f.name,
                  hint: `${f.kcal_adjust_pct > 0 ? '+' : ''}${fmt(f.kcal_adjust_pct)} % · ${fmt(f.protein_g_per_kg_lbm, 1)} g/kg magra · ${
                    f.meals_per_day
                  } comidas`,
                }))}
              />
            )}
          </Card>
        </View>

        <View className="flex-1 gap-4">
          {result ? <TargetsPanel result={result} /> : (
            <Card>
              <Body muted>Completa tu valoración para ver el cálculo.</Body>
            </Card>
          )}

          <Card title="Objetivos y plan">
            {detail.targets ? (
              <Body muted>
                {`Guardados el ${dateTime(detail.targets.updated_at)}: ${fmt(detail.targets.kcal)} kcal · P ${
                  detail.targets.protein_g
                } g · C ${detail.targets.carbs_g} g · G ${detail.targets.fat_g} g`}
              </Body>
            ) : (
              <Body muted>Aún no has guardado sus objetivos.</Body>
            )}
            {blockers.map((b) => (
              <Notice key={b} level="warn">
                {b}
              </Notice>
            ))}
            {dirty && detail.targets ? <Notice level="warn">Tienes cambios sin guardar.</Notice> : null}
            {!consent ? (
              <Notice level="warn">
                Falta que el socio acepte el uso de sus datos de salud en su app. En cuanto lo haga, podrás generar su plan.
              </Notice>
            ) : null}
            {message ? <Notice level={message.level}>{message.text}</Notice> : null}
            {lastPlan ? (
              <Notice level={lastPlan.needsReview ? 'warn' : 'good'}>
                {draftReadyMessage(lastPlan.flagged)}
              </Notice>
            ) : null}
            <View className="flex-row flex-wrap gap-2">
              <Button label="Guardar objetivos" onPress={save} busy={saving} disabled={!canSave} />
              <Button label="Generar plan" variant="secondary" onPress={generate} busy={generating} disabled={!canGenerate} />
              {lastPlan ? (
                <LinkButton
                  label="Revisar borrador"
                  variant="primary"
                  href={{ pathname: '/coach/plan/[planId]', params: { planId: lastPlan.planId } }}
                />
              ) : null}
            </View>
          </Card>

          {detail.plans.length > 0 ? (
            <Card title="Planes recientes">
              {detail.plans.map((plan) => {
                const status = PLAN_STATUS[plan.status];
                return (
                  <Link key={plan.id} href={{ pathname: '/coach/plan/[planId]', params: { planId: plan.id } }} asChild>
                    <Pressable
                      accessibilityRole="link"
                      accessibilityLabel={`${plan.status === 'draft' ? 'Revisar' : 'Ver'} el plan del ${dateTime(plan.created_at)}`}
                      className="min-h-11 flex-row flex-wrap items-center justify-between gap-2 rounded-xl px-1 active:bg-surface2 dark:active:bg-surface2-dark"
                    >
                      <Text className="text-sm text-ink dark:text-ink-dark">{dateTime(plan.created_at)}</Text>
                      <View className="flex-row items-center gap-2">
                        <Pill level={status.level}>{status.label}</Pill>
                        <Text className="text-sm font-semibold text-brand">{plan.status === 'draft' ? 'Revisar ›' : 'Ver ›'}</Text>
                      </View>
                    </Pressable>
                  </Link>
                );
              })}
            </Card>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}
