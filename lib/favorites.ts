import { getSupabase } from "./supabase";

export type FavoriteRow = {
  id: string;
  user_id: string;
  food_name: string;
  fatsecret_id: string | null;
  default_serving: Record<string, unknown> | null;
  created_at: string;
};

export async function listFavorites(userId: string): Promise<FavoriteRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("favorites")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as FavoriteRow[];
}

export async function addFavorite(input: {
  user_id: string;
  food_name: string;
  fatsecret_id?: string;
  default_serving?: Record<string, unknown>;
}): Promise<FavoriteRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("favorites")
    .insert({
      user_id: input.user_id,
      food_name: input.food_name,
      fatsecret_id: input.fatsecret_id ?? null,
      default_serving: input.default_serving ?? null,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "favorite failed");
  return data as FavoriteRow;
}
