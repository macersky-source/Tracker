import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ParsedFoodItem } from "./types";

export function extractJsonArray(raw: string): unknown {
  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const text = fence ? fence[1].trim() : trimmed;
  return JSON.parse(text);
}

export function extractJsonObject(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  let text = fence ? fence[1].trim() : trimmed;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) text = text.slice(start, end + 1);
  const parsed = JSON.parse(text) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Expected object");
  }
  return parsed as Record<string, unknown>;
}

export function normalizeParsedItems(data: unknown): ParsedFoodItem[] {
  if (!Array.isArray(data)) throw new Error("Expected array");
  return data.map((row) => {
    const r = row as Record<string, unknown>;
    const name = String(r.name ?? "").trim();
    const amount = Number(r.amount);
    const unit = String(r.unit ?? "г").trim() || "г";
    if (!name || !Number.isFinite(amount) || amount <= 0) {
      throw new Error("Invalid item");
    }
    return { name, amount, unit };
  });
}

function getModel(system: string) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is required");
  const genAI = new GoogleGenerativeAI(key);
  return genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: system,
  });
}

const PARSE_SYSTEM = `Ты парсер еды. Верни ТОЛЬКО JSON-массив объектов { "name": string, "amount": number, "unit": string }.
Единицы: г, мл, шт, порция. Язык названий — русский. Без комментариев.`;

export async function parseMealText(text: string): Promise<ParsedFoodItem[]> {
  const model = getModel(PARSE_SYSTEM);
  async function once(prompt: string) {
    const result = await model.generateContent(prompt);
    const raw = result.response.text();
    return normalizeParsedItems(extractJsonArray(raw));
  }

  try {
    return await once(text);
  } catch {
    return await once(`Верни только валидный JSON-массив.\n\n${text}`);
  }
}

export async function estimateMacros(item: ParsedFoodItem): Promise<{
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}> {
  const model = getModel(
    'Оцени КБЖУ. Верни ТОЛЬКО JSON: {"calories":number,"protein":number,"fat":number,"carbs":number}',
  );
  const result = await model.generateContent(
    `${item.amount} ${item.unit} ${item.name}`,
  );
  const obj = extractJsonObject(result.response.text());
  return {
    calories: Number(obj.calories) || 0,
    protein: Number(obj.protein) || 0,
    fat: Number(obj.fat) || 0,
    carbs: Number(obj.carbs) || 0,
  };
}
