
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "client_assessments": {
                  Row: {
                    "body_fat_pct": number,"diet_form_id": string | null,"kcal_adjust": number,"lean_gain_kg": number,"target_body_fat_pct": number,"updated_at": string,"updated_by": string | null,"user_id": string,"weeks": number
                  }
                  ComputedFields: never
                  Insert: {
                    "body_fat_pct": number,"diet_form_id"?: string | null,"kcal_adjust"?: number,"lean_gain_kg"?: number,"target_body_fat_pct": number,"updated_at"?: string,"updated_by"?: string | null,"user_id": string,"weeks": number
                  }
                  Update: {
                    "body_fat_pct"?: number,"diet_form_id"?: string | null,"kcal_adjust"?: number,"lean_gain_kg"?: number,"target_body_fat_pct"?: number,"updated_at"?: string,"updated_by"?: string | null,"user_id"?: string,"weeks"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "client_assessments_diet_form_id_fkey"
      columns: ["diet_form_id"]
isOneToOne: false
      referencedRelation: "diet_forms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_assessments_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "client_profiles"
      referencedColumns: ["user_id"]
    }
                  ]
                },"client_profiles": {
                  Row: {
                    "activity_level": string,"birth_date": string,"coach_id": string,"consent_health_data_at": string | null,"display_name": string | null,"excluded_food_ids": (string)[],"goal": string,"height_cm": number,"meals_per_day": number,"sex": string,"shop_period": string,"updated_at": string,"user_id": string,"weight_kg": number
                  }
                  ComputedFields: never
                  Insert: {
                    "activity_level": string,"birth_date": string,"coach_id": string,"consent_health_data_at"?: string | null,"display_name"?: string | null,"excluded_food_ids"?: (string)[],"goal": string,"height_cm": number,"meals_per_day"?: number,"sex": string,"shop_period"?: string,"updated_at"?: string,"user_id": string,"weight_kg": number
                  }
                  Update: {
                    "activity_level"?: string,"birth_date"?: string,"coach_id"?: string,"consent_health_data_at"?: string | null,"display_name"?: string | null,"excluded_food_ids"?: (string)[],"goal"?: string,"height_cm"?: number,"meals_per_day"?: number,"sex"?: string,"shop_period"?: string,"updated_at"?: string,"user_id"?: string,"weight_kg"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "client_profiles_coach_id_fkey"
      columns: ["coach_id"]
isOneToOne: false
      referencedRelation: "coaches"
      referencedColumns: ["user_id"]
    }
                  ]
                },"coaches": {
                  Row: {
                    "created_at": string,"display_name": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"diet_forms": {
                  Row: {
                    "coach_id": string,"created_at": string,"excluded_origins": (string)[],"fat_pct": number,"id": string,"kcal_adjust_pct": number,"meals_per_day": number,"name": string,"note": string,"protein_g_per_kg_lbm": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "coach_id": string,"created_at"?: string,"excluded_origins"?: (string)[],"fat_pct"?: number,"id"?: string,"kcal_adjust_pct"?: number,"meals_per_day"?: number,"name": string,"note"?: string,"protein_g_per_kg_lbm"?: number,"updated_at"?: string
                  }
                  Update: {
                    "coach_id"?: string,"created_at"?: string,"excluded_origins"?: (string)[],"fat_pct"?: number,"id"?: string,"kcal_adjust_pct"?: number,"meals_per_day"?: number,"name"?: string,"note"?: string,"protein_g_per_kg_lbm"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "diet_forms_coach_id_fkey"
      columns: ["coach_id"]
isOneToOne: false
      referencedRelation: "coaches"
      referencedColumns: ["user_id"]
    }
                  ]
                },"diet_plans": {
                  Row: {
                    "approved_at": string | null,"approved_by": string | null,"created_at": string,"deviation": NonNullable<Json>,"id": string,"model": string,"plan": NonNullable<Json>,"status": Database["public"]['Enums']["plan_status"],"totals": NonNullable<Json>,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "approved_at"?: string | null,"approved_by"?: string | null,"created_at"?: string,"deviation": NonNullable<Json>,"id"?: string,"model": string,"plan": NonNullable<Json>,"status"?: Database["public"]['Enums']["plan_status"],"totals": NonNullable<Json>,"user_id": string
                  }
                  Update: {
                    "approved_at"?: string | null,"approved_by"?: string | null,"created_at"?: string,"deviation"?: NonNullable<Json>,"id"?: string,"model"?: string,"plan"?: NonNullable<Json>,"status"?: Database["public"]['Enums']["plan_status"],"totals"?: NonNullable<Json>,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "diet_plans_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "client_profiles"
      referencedColumns: ["user_id"]
    }
                  ]
                },"foods": {
                  Row: {
                    "active": boolean,"buy_name": string | null,"buy_unit": string,"carbs_100g": number,"category": string,"fat_100g": number,"fiber_100g": number | null,"household_unit": string | null,"household_unit_g": number | null,"id": string,"is_fresh": boolean,"kcal_100g": number,"name": string,"origin": string,"protein_100g": number,"raw_g_per_100g": number,"shop_section": string | null,"source": string,"unit_g": number | null,"unit_label_plural": string | null,"unit_label_singular": string | null,"verified": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"buy_name"?: string | null,"buy_unit"?: string,"carbs_100g": number,"category": string,"fat_100g": number,"fiber_100g"?: number | null,"household_unit"?: string | null,"household_unit_g"?: number | null,"id": string,"is_fresh"?: boolean,"kcal_100g": number,"name": string,"origin": string,"protein_100g": number,"raw_g_per_100g"?: number,"shop_section"?: string | null,"source": string,"unit_g"?: number | null,"unit_label_plural"?: string | null,"unit_label_singular"?: string | null,"verified"?: boolean
                  }
                  Update: {
                    "active"?: boolean,"buy_name"?: string | null,"buy_unit"?: string,"carbs_100g"?: number,"category"?: string,"fat_100g"?: number,"fiber_100g"?: number | null,"household_unit"?: string | null,"household_unit_g"?: number | null,"id"?: string,"is_fresh"?: boolean,"kcal_100g"?: number,"name"?: string,"origin"?: string,"protein_100g"?: number,"raw_g_per_100g"?: number,"shop_section"?: string | null,"source"?: string,"unit_g"?: number | null,"unit_label_plural"?: string | null,"unit_label_singular"?: string | null,"verified"?: boolean
                  }
                  Relationships: [
                    
                  ]
                },"nutrition_targets": {
                  Row: {
                    "carbs_g": number,"fat_g": number,"kcal": number,"meals_per_day": number | null,"protein_g": number,"set_by": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "carbs_g": number,"fat_g": number,"kcal": number,"meals_per_day"?: number | null,"protein_g": number,"set_by"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "carbs_g"?: number,"fat_g"?: number,"kcal"?: number,"meals_per_day"?: number | null,"protein_g"?: number,"set_by"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "nutrition_targets_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "client_profiles"
      referencedColumns: ["user_id"]
    }
                  ]
                },"shopping_checks": {
                  Row: {
                    "checked_at": string,"item_key": string,"list_key": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "checked_at"?: string,"item_key": string,"list_key": string,"user_id": string
                  }
                  Update: {
                    "checked_at"?: string,"item_key"?: string,"list_key"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shopping_checks_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "client_profiles"
      referencedColumns: ["user_id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "has_diet_form_assigned":
{ Args: { "form": string }; Returns: boolean
                           },
"is_coach_of":
{ Args: { "client": string }; Returns: boolean
                           },
"owns_diet_form":
{ Args: { "form": string }; Returns: boolean
                           },
"save_coach_assessment":
{ Args: { "p_body_fat_pct": number,"p_carbs_g": number,"p_client": string,"p_diet_form_id": string,"p_fat_g": number,"p_kcal": number,"p_kcal_adjust": number,"p_lean_gain_kg": number,"p_meals_per_day": number,"p_protein_g": number,"p_target_body_fat_pct": number,"p_weeks": number }; Returns: undefined
                           }
          }
          Enums: {
            "plan_status": "draft"|"approved"|"rejected"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "plan_status": ["draft", "approved", "rejected"]
          }
        }
} as const
