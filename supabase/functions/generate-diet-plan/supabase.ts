// Adaptadores de Supabase para el handler. Dos clientes con papeles distintos:
//   - el del usuario (clave anon + su JWT): identidad y autorización, con RLS;
//   - el de servicio (service_role): lecturas del socio y el insert del borrador, sin RLS.

import { createClient, type SupabaseClient } from '../_shared/deps.ts';
import type { Database } from '../_shared/database.types.ts';
import type { Food } from '../_shared/nutrition.ts';
import type { HandlerDeps } from './handler.ts';

type Db = SupabaseClient<Database>;

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
}

const SERVER_AUTH = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } as const;

function userClient(config: SupabaseConfig, authorization: string): Db {
  return createClient<Database>(config.url, config.anonKey, {
    auth: SERVER_AUTH,
    global: { headers: { Authorization: authorization } },
  });
}

function fail(what: string, message: string): never {
  throw new Error(`${what}: ${message}`);
}

export function supabaseDeps(
  config: SupabaseConfig,
): Pick<
  HandlerDeps,
  'authenticate' | 'isCoachOf' | 'loadClient' | 'loadActiveFoods' | 'lastPlanCreatedAt' | 'saveDraft'
> {
  const admin: Db = createClient<Database>(config.url, config.serviceRoleKey, { auth: SERVER_AUTH });

  return {
    async authenticate(authorization) {
      const { data, error } = await userClient(config, authorization).auth.getUser();
      return error || !data.user ? null : data.user.id;
    },

    async isCoachOf(authorization, clientId) {
      const { data, error } = await userClient(config, authorization).rpc('is_coach_of', { client: clientId });
      if (error) fail('is_coach_of', error.message);
      return data === true;
    },

    async loadClient(clientId) {
      const [profile, targets] = await Promise.all([
        admin
          .from('client_profiles')
          .select('goal, meals_per_day, excluded_food_ids, consent_health_data_at')
          .eq('user_id', clientId)
          .maybeSingle(),
        admin
          .from('nutrition_targets')
          .select('kcal, protein_g, carbs_g, fat_g')
          .eq('user_id', clientId)
          .maybeSingle(),
      ]);
      if (profile.error) fail('client_profiles', profile.error.message);
      if (targets.error) fail('nutrition_targets', targets.error.message);
      if (!profile.data) return null;
      return {
        goal: profile.data.goal,
        mealsPerDay: profile.data.meals_per_day,
        excludedFoodIds: profile.data.excluded_food_ids,
        consentAt: profile.data.consent_health_data_at,
        targets: targets.data,
      };
    },

    async loadActiveFoods(): Promise<Food[]> {
      const { data, error } = await admin
        .from('foods')
        .select('id, name, category, kcal_100g, protein_100g, carbs_100g, fat_100g, household_unit, household_unit_g')
        .eq('active', true)
        .order('id');
      if (error) fail('foods', error.message);
      return data;
    },

    async lastPlanCreatedAt(clientId) {
      const { data, error } = await admin
        .from('diet_plans')
        .select('created_at')
        .eq('user_id', clientId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) fail('diet_plans', error.message);
      return data ? new Date(data.created_at) : null;
    },

    async saveDraft({ clientId, model, draft }) {
      const { data, error } = await admin
        .from('diet_plans')
        .insert({
          user_id: clientId,
          status: 'draft',
          model,
          plan: draft.plan,
          totals: draft.totals,
          deviation: draft.deviation,
        })
        .select('id')
        .single();
      if (error) fail('diet_plans insert', error.message);
      return data.id;
    },
  };
}
