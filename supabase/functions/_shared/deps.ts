// Dependencias externas de las Edge Functions, con versión exacta en un solo sitio.
export { default as Anthropic } from 'npm:@anthropic-ai/sdk@1.8.0';
export { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.119.0';
export { z } from 'npm:zod@4.6.7';
