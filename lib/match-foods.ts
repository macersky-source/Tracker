import { getFood, searchFoods } from "./fatsecret";
import { estimateMacros } from "./openai-parse";
import type { MatchedFoodItem, ParsedFoodItem } from "./types";

function scaleFromServing(
  item: ParsedFoodItem,
  foodName: string,
  foodId: string,
  serving: {
    serving_description: string;
    metric_serving_amount?: string;
    metric_serving_unit?: string;
    calories: string;
    protein: string;
    fat: string;
    carbohydrate: string;
  },
): MatchedFoodItem {
  const baseCal = Number(serving.calories) || 0;
  const baseP = Number(serving.protein) || 0;
  const baseF = Number(serving.fat) || 0;
  const baseC = Number(serving.carbohydrate) || 0;
  const metricAmount = Number(serving.metric_serving_amount);
  const metricUnit = (serving.metric_serving_unit ?? "").toLowerCase();
  const canScale =
    Number.isFinite(metricAmount) &&
    metricAmount > 0 &&
    (item.unit === "г" || item.unit === "g" || item.unit === "мл" || item.unit === "ml") &&
    (metricUnit === "g" || metricUnit === "ml" || metricUnit === "г" || metricUnit === "мл");

  if (canScale) {
    const factor = item.amount / metricAmount;
    return {
      ...item,
      food_name: foodName,
      calories: Math.round(baseCal * factor * 10) / 10,
      protein: Math.round(baseP * factor * 10) / 10,
      fat: Math.round(baseF * factor * 10) / 10,
      carbs: Math.round(baseC * factor * 10) / 10,
      source: "fatsecret",
      fatsecret_id: foodId,
    };
  }

  return {
    name: item.name,
    amount: item.amount,
    unit: item.unit || serving.serving_description,
    food_name: foodName,
    calories: baseCal,
    protein: baseP,
    fat: baseF,
    carbs: baseC,
    source: "fatsecret",
    fatsecret_id: foodId,
  };
}

export async function matchParsedFoods(
  items: ParsedFoodItem[],
): Promise<MatchedFoodItem[]> {
  const out: MatchedFoodItem[] = [];
  for (const item of items) {
    const results = await searchFoods(item.name);
    const first = results[0];
    if (!first) {
      const macros = await estimateMacros(item);
      out.push({
        ...item,
        food_name: item.name,
        ...macros,
        source: "ai_estimate",
        fatsecret_id: null,
      });
      continue;
    }
    const detail = await getFood(first.food_id);
    const serving = detail.servings[0];
    if (!serving) {
      const macros = await estimateMacros(item);
      out.push({
        ...item,
        food_name: detail.food_name,
        ...macros,
        source: "ai_estimate",
        fatsecret_id: detail.food_id,
      });
      continue;
    }
    out.push(
      scaleFromServing(item, detail.food_name, detail.food_id, serving),
    );
  }
  return out;
}
