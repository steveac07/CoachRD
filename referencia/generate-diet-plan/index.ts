// Supabase Edge Function (Deno) · POST /functions/v1/generate-diet-plan
// Flujo: auth -> perfil + objetivos + catálogo -> Claude (structured outputs)
//        -> validación Zod -> macros calculados por código -> borrador para el coach.
//
// Secrets (supabase secrets set ...):
//   ANTHROPIC_API_KEY, ANTHROPIC_MODEL (opcional)
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase.

import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import {
  computeTargets,
  deviation,
  type Food,
  householdMeasure,
  type Macros,
  macrosForPortion,
  roundMacros,
  sumMacros,
} from "../_shared/nutrition.ts";

const MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-5-5";
const MAX_DEVIATION_PCT = 10; // fuera de ±10 % se marca para revisión del coach

// ---------------------------------------------------------------------------
// Contrato con la IA: SOLO ids del catálogo + gramos. Nada de macros.
// ---------------------------------------------------------------------------
const AiPlan = z.object({
  meals: z
    .array(
      z.object({
        slot: z.enum(["desayuno", "almuerzo", "merienda", "cena", "pre_entreno", "post_entreno"]),
        dish_name: z.string().min(2).max(80),
        items: z
          .array(z.object({ food_id: z.string(), grams: z.number().positive().max(800) }))
          .min(1)
          .max(8),
        prep_tip: z.string().max(240),
      }),
    )
    .min(3)
    .max(6),
});
type AiPlan = z.infer<typeof AiPlan>;

// JSON Schema equivalente para output_config.format (additionalProperties:false
// obligatorio en cada objeto; rangos numéricos se validan después con Zod).
function buildJsonSchema(foodIds: string[]) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["meals"],
    properties: {
      meals: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["slot", "dish_name", "items", "prep_tip"],
          properties: {
            slot: {
              type: "string",
              enum: ["desayuno", "almuerzo", "merienda", "cena", "pre_entreno", "post_entreno"],
            },
            dish_name: { type: "string" },
            prep_tip: { type: "string" },
            items: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["food_id", "grams"],
                properties: {
                  food_id: { type: "string", enum: foodIds }, // imposible inventar alimentos
                  grams: { type: "number" },
                },
              },
            },
          },
        },
      },
    },
  };
}

const SYSTEM_PROMPT = `Eres el motor de planificación de CoachRD, supervisado por un entrenador y nutricionista en República Dominicana.
Construyes menús con comida dominicana real (víveres, arroz con habichuelas, guisados criollos, mangú, aguacate) en versiones de cocción ligera: hervido, horneado, air fryer, guisado con sofrito natural. Nada frito por inmersión.
Reglas:
- Usa EXCLUSIVAMENTE los food_id del catálogo recibido. Nunca inventes alimentos.
- Indica gramos en peso COCIDO, redondeados a múltiplos de 5.
- Ajusta gramos para acercarte a los objetivos diarios (±5 %). El sistema recalculará los macros; no los incluyas.
- Respeta el número de comidas y las exclusiones.
- prep_tip: una frase práctica en español dominicano neutro.
- No des consejos médicos ni diagnósticos.`;

// ---------------------------------------------------------------------------
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

function ageFrom(birthDate: string): number {
  const b = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now < new Date(now.getFullYear(), b.getMonth(), b.getDate())) age--;
  return age;
}

async function callClaude(userPrompt: string, schema: unknown): Promise<AiPlan> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      output_config: { format: { type: "json_schema", schema } },
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const text = data?.content?.find((b: { type: string }) => b.type === "text")?.text;
  if (typeof text !== "string") throw new Error("Respuesta sin bloque de texto");
  return AiPlan.parse(JSON.parse(text)); // segunda barrera: rangos y longitudes
}

// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  // 1. Identidad del usuario a partir de su JWT (nunca de un campo del body)
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: auth, error: authErr } = await userClient.auth.getUser();
  if (authErr || !auth.user) return json(401, { error: "unauthorized" });
  const userId = auth.user.id;

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // 2. Datos de entrada
  const [{ data: profile }, { data: targetRow }, { data: foods }] = await Promise.all([
    admin.from("client_profiles").select("*").eq("user_id", userId).single(),
    admin.from("nutrition_targets").select("*").eq("user_id", userId).maybeSingle(),
    admin.from("foods").select("id,name,kcal_100g,protein_100g,carbs_100g,fat_100g,household_unit,household_unit_g")
      .eq("active", true),
  ]);
  if (!profile) return json(404, { error: "profile_not_found" });
  if (!profile.consent_health_data_at) return json(403, { error: "consent_required" });
  if (!foods?.length) return json(500, { error: "empty_food_catalog" });

  // Rate limit simple: 1 generación cada 10 min por usuario (controla coste de API)
  const { data: last } = await admin.from("diet_plans").select("created_at")
    .eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (last && Date.now() - new Date(last.created_at).getTime() < 10 * 60_000) {
    return json(429, { error: "too_many_requests" });
  }

  // 3. Objetivos: los del coach si existen; si no, cálculo automático
  const target: Macros = targetRow
    ? { kcal: targetRow.kcal, protein_g: targetRow.protein_g, carbs_g: targetRow.carbs_g, fat_g: targetRow.fat_g }
    : computeTargets({
      sex: profile.sex,
      age: ageFrom(profile.birth_date),
      heightCm: Number(profile.height_cm),
      weightKg: Number(profile.weight_kg),
      activity: profile.activity_level,
      goal: profile.goal,
    });

  const excluded = new Set<string>(profile.excluded_food_ids ?? []);
  const catalog = (foods as Food[]).filter((f) => !excluded.has(f.id));
  const byId = new Map(catalog.map((f) => [f.id, f]));

  const userPrompt = [
    `Objetivo diario: ${target.kcal} kcal | P ${target.protein_g} g | C ${target.carbs_g} g | G ${target.fat_g} g`,
    `Meta: ${profile.goal}. Comidas al día: ${profile.meals_per_day}.`,
    `Catálogo (id · nombre · por 100 g: kcal/P/C/G):`,
    ...catalog.map((f) => `${f.id} · ${f.name} · ${f.kcal_100g}/${f.protein_100g}/${f.carbs_100g}/${f.fat_100g}`),
  ].join("\n");

  // 4. IA
  let aiPlan: AiPlan;
  try {
    aiPlan = await callClaude(userPrompt, buildJsonSchema(catalog.map((f) => f.id)));
  } catch (e) {
    console.error(e);
    return json(502, { error: "ai_generation_failed" });
  }

  // 5. Macros calculados por código
  const meals = aiPlan.meals.map((meal) => {
    const items = meal.items.map(({ food_id, grams }) => {
      const food = byId.get(food_id);
      if (!food) throw new Error(`food_id fuera de catálogo: ${food_id}`);
      return {
        food_id,
        name: food.name,
        grams,
        household: householdMeasure(food, grams),
        macros: roundMacros(macrosForPortion(food, grams)),
      };
    });
    return { ...meal, items, macros: roundMacros(sumMacros(items.map((i) => i.macros))) };
  });
  const totals = roundMacros(sumMacros(meals.map((m) => m.macros)));
  const dev = deviation(totals, target);
  const needsReview = Object.values(dev).some((v) => Math.abs(v) > MAX_DEVIATION_PCT);

  // 6. Borrador (el cliente no lo ve hasta que el coach lo aprueba — ver RLS)
  const { data: plan, error: insErr } = await admin.from("diet_plans").insert({
    user_id: userId,
    status: "draft",
    model: MODEL,
    plan: { meals },
    totals: { ...totals, target },
    deviation: { ...dev, needs_review: needsReview },
  }).select("id").single();
  if (insErr) return json(500, { error: "db_insert_failed" });

  return json(201, { plan_id: plan.id, status: "draft", needs_review: needsReview });
});
