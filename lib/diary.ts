import { getSupabase } from "./supabase";
import type { EntrySource, FoodEntryRow, MealType } from "./types";

export function sumMacros(
  entries: Pick<FoodEntryRow, "calories" | "protein" | "fat" | "carbs">[],
): { calories: number; protein: number; fat: number; carbs: number } {
  return entries.reduce(
    (acc, e) => ({
      calories: acc.calories + Number(e.calories),
      protein: acc.protein + Number(e.protein),
      fat: acc.fat + Number(e.fat),
      carbs: acc.carbs + Number(e.carbs),
    }),
    { calories: 0, protein: 0, fat: 0, carbs: 0 },
  );
}

export type CreateEntryInput = {
  user_id: string;
  entry_date: string;
  meal_type?: MealType;
  food_name: string;
  calories: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  serving_amount?: number;
  serving_unit?: string;
  source: EntrySource;
  fatsecret_id?: string;
  raw_input?: string;
};

export async function listEntries(
  userId: string,
  entryDate: string,
): Promise<FoodEntryRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("food_entries")
    .select("*")
    .eq("user_id", userId)
    .eq("entry_date", entryDate)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as FoodEntryRow[];
}

export async function createEntry(
  input: CreateEntryInput,
): Promise<FoodEntryRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("food_entries")
    .insert({
      user_id: input.user_id,
      entry_date: input.entry_date,
      meal_type: input.meal_type ?? null,
      food_name: input.food_name,
      calories: input.calories,
      protein: input.protein ?? 0,
      fat: input.fat ?? 0,
      carbs: input.carbs ?? 0,
      serving_amount: input.serving_amount ?? null,
      serving_unit: input.serving_unit ?? null,
      source: input.source,
      fatsecret_id: input.fatsecret_id ?? null,
      raw_input: input.raw_input ?? null,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "create failed");
  return data as FoodEntryRow;
}

export async function deleteEntry(
  userId: string,
  entryId: string,
): Promise<boolean> {
  const supabase = getSupabase();
  const { error, count } = await supabase
    .from("food_entries")
    .delete({ count: "exact" })
    .eq("id", entryId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}
