import { searchFoods, getFood } from "../lib/fatsecret";
import { parseMealText } from "../lib/openai-parse";

async function main() {
  const foods = await searchFoods("tvorog");
  console.log("SEARCH", foods.length, foods[0]?.food_name, foods[0]?.food_id);
  if (foods[0]) {
    const d = await getFood(foods[0].food_id);
    console.log("DETAIL", d.food_name, d.servings[0]?.calories);
  }
  const parsed = await parseMealText("гречка 150г и курица 120г");
  console.log("PARSE", JSON.stringify(parsed));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
