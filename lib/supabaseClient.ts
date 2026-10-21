"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/authShared";

let client: SupabaseClient | null = null;

/** Client Supabase du navigateur (connexion des clients seulement : aucune donnée du site n'est chez Supabase). */
export const supabase = () =>
  (client ??= createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, detectSessionInUrl: true, flowType: "pkce" },
  }));

/** En-tête à joindre aux appels du site qui demandent un client connecté. */
export async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase().auth.getSession();
  return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}
