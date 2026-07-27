import { getSupabase } from "./supabase";
import type { UserRow } from "./types";

export async function upsertTelegramUser(input: {
  telegram_id: number;
  username?: string;
  first_name?: string;
}): Promise<UserRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("users")
    .upsert(
      {
        telegram_id: input.telegram_id,
        username: input.username ?? null,
        first_name: input.first_name ?? null,
      },
      { onConflict: "telegram_id" },
    )
    .select(
      "id, telegram_id, username, first_name, daily_calories, daily_protein, daily_fat, daily_carbs",
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to upsert user");
  }
  return data as UserRow;
}

export async function getUserByTelegramId(
  telegram_id: number,
): Promise<UserRow | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("users")
    .select(
      "id, telegram_id, username, first_name, daily_calories, daily_protein, daily_fat, daily_carbs",
    )
    .eq("telegram_id", telegram_id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as UserRow | null) ?? null;
}

export async function updateUserGoals(
  telegram_id: number,
  goals: Partial<{
    daily_calories: number;
    daily_protein: number;
    daily_fat: number;
    daily_carbs: number;
  }>,
): Promise<UserRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("users")
    .update(goals)
    .eq("telegram_id", telegram_id)
    .select(
      "id, telegram_id, username, first_name, daily_calories, daily_protein, daily_fat, daily_carbs",
    )
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "Failed to update goals");
  }
  return data as UserRow;
}
