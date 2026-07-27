export type OffSearchItem = {
  food_id: string;
  food_name: string;
  brand_name?: string;
  food_description?: string;
  calories_100g?: number;
  protein_100g?: number;
  fat_100g?: number;
  carbs_100g?: number;
};

function num(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export async function searchOpenFoodFacts(
  query: string,
): Promise<OffSearchItem[]> {
  const url = new URL("https://world.openfoodfacts.org/cgi/search.pl");
  url.searchParams.set("search_terms", query);
  url.searchParams.set("search_simple", "1");
  url.searchParams.set("action", "process");
  url.searchParams.set("json", "1");
  url.searchParams.set("page_size", "20");

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": "CalorieTrackerMiniApp/1.0 (personal use)",
    },
  });
  if (!res.ok) throw new Error(`Open Food Facts error: ${res.status}`);
  const json = (await res.json()) as {
    products?: Array<{
      code?: string;
      product_name?: string;
      product_name_ru?: string;
      brands?: string;
      nutriments?: Record<string, unknown>;
    }>;
  };

  return (json.products ?? [])
    .map((p) => {
      const n = p.nutriments ?? {};
      const name =
        p.product_name_ru?.trim() ||
        p.product_name?.trim() ||
        "Без названия";
      const calories =
        num(n["energy-kcal_100g"]) ??
        (num(n["energy_100g"]) != null
          ? Math.round(Number(n["energy_100g"]) / 4.184)
          : undefined);
      return {
        food_id: `off:${p.code ?? name}`,
        food_name: name,
        brand_name: p.brands || undefined,
        food_description:
          calories != null ? `${calories} ккал / 100г` : undefined,
        calories_100g: calories,
        protein_100g: num(n.proteins_100g),
        fat_100g: num(n.fat_100g),
        carbs_100g: num(n.carbohydrates_100g),
      } satisfies OffSearchItem;
    })
    .filter((p) => p.calories_100g != null);
}

export function offToServings(item: OffSearchItem) {
  const cal = item.calories_100g ?? 0;
  const protein = item.protein_100g ?? 0;
  const fat = item.fat_100g ?? 0;
  const carbs = item.carbs_100g ?? 0;
  return [
    {
      serving_id: "100g",
      serving_description: "100 г",
      metric_serving_amount: "100",
      metric_serving_unit: "g",
      number_of_units: "1",
      calories: String(cal),
      protein: String(protein),
      fat: String(fat),
      carbohydrate: String(carbs),
    },
    {
      serving_id: "50g",
      serving_description: "50 г",
      metric_serving_amount: "50",
      metric_serving_unit: "g",
      number_of_units: "0.5",
      calories: String(Math.round(cal / 2)),
      protein: String(Math.round((protein / 2) * 10) / 10),
      fat: String(Math.round((fat / 2) * 10) / 10),
      carbohydrate: String(Math.round((carbs / 2) * 10) / 10),
    },
  ];
}
