import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ExerciseId, RepSummary } from "../exercises/types";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseEnabled = Boolean(url && key);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!supabaseEnabled) return null;
  if (!client) client = createClient(url!, key!);
  return client;
}

export interface SessionLog {
  id?: string;
  user_id?: string;
  exercise: ExerciseId;
  reps: number;
  avg_metric: number | null;
  best_score?: number | null;
  session_duration_sec?: number | null;
  metrics_json?: RepSummary[] | null;
  created_at?: string;
}

/**
 * SQL migration — run once in Supabase SQL editor:
 *
 *   create table public.sessions (
 *     id uuid default gen_random_uuid() primary key,
 *     user_id uuid references auth.users on delete cascade,
 *     exercise text not null,
 *     reps int not null,
 *     avg_metric numeric,
 *     best_score numeric,
 *     session_duration_sec numeric,
 *     metrics_json jsonb,
 *     created_at timestamptz default now()
 *   );
 *   alter table public.sessions enable row level security;
 *   create policy "own sessions" on public.sessions
 *     for all using (auth.uid() = user_id);
 *
 *   -- If upgrading an existing table:
 *   alter table public.sessions add column if not exists best_score numeric;
 *   alter table public.sessions add column if not exists session_duration_sec numeric;
 *   alter table public.sessions add column if not exists metrics_json jsonb;
 */
export async function logSession(s: SessionLog): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { data: userData } = await sb.auth.getUser();
  if (!userData.user) return false;
  const { error } = await sb.from("sessions").insert({ ...s, user_id: userData.user.id });
  if (error) throw error;
  return true;
}

export async function fetchSessions(): Promise<SessionLog[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data } = await sb
    .from("sessions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  return data ?? [];
}
