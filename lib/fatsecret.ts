type TokenCache = { accessToken: string; expiresAt: number };
let tokenCache: TokenCache | null = null;

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

export async function searchFoods(
  query: string,
  opts: { region?: string } = {},
): Promise<FatSecretSearchItem[]> {
  const token = await getAccessToken();
  const region = opts.region ?? "RU";
  const url = new URL("https://platform.fatsecret.com/rest/foods/search/v5");
  url.searchParams.set("search_expression", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("region", region);
  url.searchParams.set("max_results", "20");

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`FatSecret search error: ${res.status}`);
  const json = (await res.json()) as {
    foods_search?: {
      results?: { food?: FatSecretSearchItem[] | FatSecretSearchItem };
    };
  };
  const food = json.foods_search?.results?.food;
  if (!food) return [];
  return Array.isArray(food) ? food : [food];
}

export async function getFood(foodId: string): Promise<FatSecretFoodDetail> {
  const token = await getAccessToken();
  const url = new URL("https://platform.fatsecret.com/rest/food/v5");
  url.searchParams.set("food_id", foodId);
  url.searchParams.set("format", "json");

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`FatSecret get error: ${res.status}`);
  const json = (await res.json()) as {
    food: {
      food_id: string;
      food_name: string;
      servings: { serving: FatSecretServing[] | FatSecretServing };
    };
  };
  const serving = json.food.servings.serving;
  return {
    food_id: json.food.food_id,
    food_name: json.food.food_name,
    servings: Array.isArray(serving) ? serving : [serving],
  };
}
