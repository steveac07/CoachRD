// Acceso a datos del panel del coach. Todo pasa por RLS con la sesión del coach:
// ve sus socios (profile_coach_read), su valoración y objetivos (is_coach_of) y sus formas.
import { FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';

import type { Assessment, AssessmentValues, ClientProfile, DietForm } from './assessment';
import { saveArgs } from './assessment';
import { DEMO_DIET_FORMS } from './demoForms';
import { type GenerateErrorBody, generateErrorMessage } from './generateMessages';
import { type PlanStatus, reviewErrorMessage } from './planReview';
import type { DailyTargets } from '@/lib/nutrition/targets';

export type Targets = Pick<Tables<'nutrition_targets'>, 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g' | 'meals_per_day' | 'updated_at'>;
export type PlanSummary = Pick<Tables<'diet_plans'>, 'id' | 'status' | 'created_at' | 'model' | 'deviation'>;

export interface ClientListItem {
  profile: ClientProfile;
  targets: Pick<Targets, 'kcal' | 'updated_at'> | null;
}

export interface ClientDetail {
  profile: ClientProfile;
  assessment: Assessment | null;
  targets: Targets | null;
  plans: PlanSummary[];
}

const PROFILE_COLUMNS =
  'user_id, display_name, sex, birth_date, height_cm, weight_kg, activity_level, goal, meals_per_day, consent_health_data_at';

function fail(what: string, message: string): never {
  throw new Error(`${what}: ${message}`);
}

/** El coach de la sesión, o null si la cuenta no es de coach. */
export async function fetchCoach(userId: string): Promise<Tables<'coaches'> | null> {
  const { data, error } = await supabase.from('coaches').select('*').eq('user_id', userId).maybeSingle();
  if (error) fail('coaches', error.message);
  return data;
}

export async function fetchClients(coachId: string): Promise<ClientListItem[]> {
  const [profiles, targets] = await Promise.all([
    supabase.from('client_profiles').select(PROFILE_COLUMNS).eq('coach_id', coachId).order('display_name'),
    supabase.from('nutrition_targets').select('user_id, kcal, updated_at'),
  ]);
  if (profiles.error) fail('client_profiles', profiles.error.message);
  if (targets.error) fail('nutrition_targets', targets.error.message);
  const byClient = new Map(targets.data.map((t) => [t.user_id, { kcal: t.kcal, updated_at: t.updated_at }]));
  return profiles.data.map((profile) => ({ profile, targets: byClient.get(profile.user_id) ?? null }));
}

export async function fetchClientDetail(clientId: string): Promise<ClientDetail | null> {
  const [profile, assessment, targets, plans] = await Promise.all([
    supabase.from('client_profiles').select(PROFILE_COLUMNS).eq('user_id', clientId).maybeSingle(),
    supabase.from('client_assessments').select('*').eq('user_id', clientId).maybeSingle(),
    supabase
      .from('nutrition_targets')
      .select('kcal, protein_g, carbs_g, fat_g, meals_per_day, updated_at')
      .eq('user_id', clientId)
      .maybeSingle(),
    supabase
      .from('diet_plans')
      .select('id, status, created_at, model, deviation')
      .eq('user_id', clientId)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);
  if (profile.error) fail('client_profiles', profile.error.message);
  if (assessment.error) fail('client_assessments', assessment.error.message);
  if (targets.error) fail('nutrition_targets', targets.error.message);
  if (plans.error) fail('diet_plans', plans.error.message);
  if (!profile.data) return null;
  return { profile: profile.data, assessment: assessment.data, targets: targets.data, plans: plans.data };
}

export async function fetchDietForms(coachId: string): Promise<DietForm[]> {
  const { data, error } = await supabase.from('diet_forms').select('*').eq('coach_id', coachId).order('name');
  if (error) fail('diet_forms', error.message);
  return data;
}

/** Crea las formas de ejemplo de la demo que el coach aún no tenga (no toca las que ya existen). */
export async function createDemoDietForms(coachId: string): Promise<void> {
  const rows = DEMO_DIET_FORMS.map((form) => ({ ...form, coach_id: coachId }));
  const { error } = await supabase.from('diet_forms').upsert(rows, { onConflict: 'coach_id,name', ignoreDuplicates: true });
  if (error) fail('diet_forms', error.message);
}

/** Guarda valoración y objetivos en una sola transacción (RPC `save_coach_assessment`). */
export async function saveAssessment(
  clientId: string,
  values: AssessmentValues,
  targets: DailyTargets,
  form: DietForm,
): Promise<void> {
  const { error } = await supabase.rpc('save_coach_assessment', saveArgs(clientId, values, targets, form));
  if (error) fail('save_coach_assessment', error.message);
}

export type GenerateResult =
  | { ok: true; planId: string; needsReview: boolean; flagged: string[] }
  | { ok: false; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function errorBody(error: unknown): Promise<{ status: number | null; body: GenerateErrorBody | null }> {
  if (!(error instanceof FunctionsHttpError)) return { status: null, body: null };
  const context: unknown = error.context;
  if (!(context instanceof Response)) return { status: null, body: null };
  try {
    const json: unknown = await context.json();
    return { status: context.status, body: isRecord(json) ? json : null };
  } catch {
    return { status: context.status, body: null };
  }
}

/** Pide el borrador del plan a la Edge Function generate-diet-plan. */
export async function generatePlan(clientId: string): Promise<GenerateResult> {
  const { data, error } = await supabase.functions.invoke<unknown>('generate-diet-plan', {
    body: { client_id: clientId },
  });
  if (error) {
    const { status, body } = await errorBody(error);
    return { ok: false, message: generateErrorMessage(status, body) };
  }
  if (!isRecord(data) || typeof data.plan_id !== 'string') {
    return { ok: false, message: generateErrorMessage(null, null) };
  }
  const flagged = Array.isArray(data.flagged) ? data.flagged.filter((f): f is string => typeof f === 'string') : [];
  return { ok: true, planId: data.plan_id, needsReview: data.needs_review === true, flagged };
}

export type PlanDetail = Pick<
  Tables<'diet_plans'>,
  'id' | 'user_id' | 'status' | 'created_at' | 'model' | 'plan' | 'totals' | 'deviation' | 'review_note' | 'reviewed_at'
> & { clientName: string | null };

export async function fetchPlan(planId: string): Promise<PlanDetail | null> {
  const { data, error } = await supabase
    .from('diet_plans')
    .select('id, user_id, status, created_at, model, plan, totals, deviation, review_note, reviewed_at, client_profiles(display_name)')
    .eq('id', planId)
    .maybeSingle();
  if (error) fail('diet_plans', error.message);
  if (!data) return null;
  const { client_profiles: client, ...plan } = data;
  return { ...plan, clientName: client?.display_name ?? null };
}

export type ReviewResult = { ok: true; status: PlanStatus } | { ok: false; message: string };

/** Aprueba o rechaza un borrador (RPC `review_diet_plan`). Al aprobar, el plan aprobado anterior se archiva. */
export async function reviewPlan(planId: string, decision: 'approve' | 'reject', note: string): Promise<ReviewResult> {
  const { data, error } = await supabase.rpc('review_diet_plan', { p_plan: planId, p_decision: decision, p_note: note });
  if (error) return { ok: false, message: reviewErrorMessage(error.code ?? null) };
  return { ok: true, status: data };
}
