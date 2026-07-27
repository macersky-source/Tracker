import {
  offToServings,
  searchOpenFoodFacts,
  type OffSearchItem,
} from "./openfoodfacts";

type TokenCache = { accessToken: string; expiresAt: number };
let tokenCache: TokenCache | null = null;

const offCache = new Map<string, OffSearchItem>();

async function getAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.accessToken;
  }
  const id = process.env.FATSECRET_CLIENT_ID;
  const secret = process.env.FATSECRET_CLIENT_SECRET;
  if (!id || !secret) throw new Error("FatSecret credentials missing");

  const basic = Buffer.from(`${id}:${secret}`).toString("base64");
  const res = await fetch("https://oauth.fatsecret.com/connect/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=basic",
  });
  if (!res.ok) throw new Error(`FatSecret token error: ${res.status}`);
  const json = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  tokenCache = {
    accessToken: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return json.access_token;
}

export type FatSecretSearchItem = {
  food_id: string;
  food_name: string;
  brand_name?: string;
  food_description?: string;
};

export type FatSecretServing = {
  serving_id: string;
  serving_description: string;
  metric_serving_amount?: string;
  metric_serving_unit?: string;
  number_of_units?: string;
  calories: string;
  protein: string;
  fat: string;
  carbohydrate: string;
};

export type FatSecretFoodDetail = {
  food_id: string;
  food_name: string;
  servings: FatSecretServing[];
};

function extractFoods(json: unknown): FatSecretSearchItem[] {
  const root = json as Record<string, unknown>;
  if (root.error) {
    const err = root.error as { message?: string };
    throw new Error(err.message ?? "FatSecret API error");
  }

  const foodsSearch = root.foods_search as
    | { results?: { food?: FatSecretSearchItem[] | FatSecretSearchItem } }
    | undefined;
  const foods = root.foods as
    | { food?: FatSecretSearchItem[] | FatSecretSearchItem }
    | undefined;

  const food =
    foodsSearch?.results?.food ??
    foods?.food ??
    null;
  if (!food) return [];
  return Array.isArray(food) ? food : [food];
}

async function searchFatSecret(query: string): Promise<FatSecretSearchItem[]> {
  const token = await getAccessToken();

  // Prefer classic method endpoint (basic scope)
  const legacy = await fetch(
    "https://platform.fatsecret.com/rest/server.api?" +
      new URLSearchParams({
        method: "foods.search",
        search_expression: query,
        format: "json",
        max_results: "20",
      }),
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    },
  );
  const legacyJson = await legacy.json();
  const fromLegacy = extractFoods(legacyJson);
  if (fromLegacy.length) return fromLegacy;

  const url = new URL("https://platform.fatsecret.com/rest/foods/search/v5");
  url.searchParams.set("search_expression", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("max_results", "20");
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  return extractFoods(json);
}

export async function searchFoods(
  query: string,
): Promise<FatSecretSearchItem[]> {
  try {
    const items = await searchFatSecret(query);
    if (items.length) return items;
  } catch (e) {
    console.error("FatSecret search failed, falling back to OFF", e);
  }

  const off = await searchOpenFoodFacts(query);
  for (const item of off) offCache.set(item.food_id, item);
  return off.map((item) => ({
    food_id: item.food_id,
    food_name: item.food_name,
    brand_name: item.brand_name,
    food_description: item.food_description,
  }));
}

export async function getFood(foodId: string): Promise<FatSecretFoodDetail> {
  if (foodId.startsWith("off:")) {
    let item = offCache.get(foodId);
    if (!item) {
      const q = foodId.replace(/^off:/, "");
      const found = await searchOpenFoodFacts(q);
      item = found.find((f) => f.food_id === foodId) ?? found[0];
      if (item) offCache.set(item.food_id, item);
    }
    if (!item) throw new Error("Product not found");
    return {
      food_id: item.food_id,
      food_name: item.food_name,
      servings: offToServings(item),
    };
  }

  const token = await getAccessToken();
  const url = new URL("https://platform.fatsecret.com/rest/food/v5");
  url.searchParams.set("food_id", foodId);
  url.searchParams.set("format", "json");

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = (await res.json()) as {
    error?: { message?: string };
    food?: {
      food_id: string;
      food_name: string;
      servings: { serving: FatSecretServing[] | FatSecretServing };
    };
  };
  if (json.error || !json.food) {
    throw new Error(json.error?.message ?? "FatSecret get failed");
  }
  const serving = json.food.servings.serving;
  return {
    food_id: json.food.food_id,
    food_name: json.food.food_name,
    servings: Array.isArray(serving) ? serving : [serving],
  };
}
