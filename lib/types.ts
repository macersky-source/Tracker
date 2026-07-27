export type TelegramWebAppUser = {
  id: number;
  first_name?: string;
  username?: string;
};

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type EntrySource = "fatsecret" | "ai_estimate";

export type UserRow = {
  id: string;
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  daily_calories: number;
  daily_protein: number;
  daily_fat: number;
  daily_carbs: number;
};

export type FoodEntryRow = {
  id: string;
  user_id: string;
  entry_date: string;
  meal_type: MealType | null;
  food_name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  serving_amount: number | null;
  serving_unit: string | null;
  source: EntrySource;
  fatsecret_id: string | null;
  raw_input: string | null;
  created_at: string;
};

export type ParsedFoodItem = {
  name: string;
  amount: number;
  unit: string;
};

export type MatchedFoodItem = ParsedFoodItem & {
  food_name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  source: EntrySource;
  fatsecret_id: string | null;
};
