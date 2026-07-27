import OpenAI from "openai";
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

function getClient() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is required");
  return new OpenAI({ apiKey: key });
}

const SYSTEM = `Ты парсер еды. Верни ТОЛЬКО JSON-массив объектов { "name": string, "amount": number, "unit": string }.
Единицы: г, мл, шт, порция. Язык названий — русский. Без комментариев.`;

export async function parseMealText(text: string): Promise<ParsedFoodItem[]> {
  const client = getClient();
  async function once(extra?: string) {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: extra ? `${extra}\n\n${text}` : text,
        },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "";
    return normalizeParsedItems(extractJsonArray(raw));
  }

  try {
    return await once();
  } catch {
    return await once("Верни только валидный JSON-массив.");
  }
}

export async function estimateMacros(item: ParsedFoodItem): Promise<{
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}> {
  const client = getClient();
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [
      {
        role: "system",
        content:
          'Оцени КБЖУ. Верни ТОЛЬКО JSON: {"calories":number,"protein":number,"fat":number,"carbs":number}',
      },
      {
        role: "user",
        content: `${item.amount} ${item.unit} ${item.name}`,
      },
    ],
  });
  const raw = completion.choices[0]?.message?.content ?? "";
  const obj = extractJsonObject(raw);
  return {
    calories: Number(obj.calories) || 0,
    protein: Number(obj.protein) || 0,
    fat: Number(obj.fat) || 0,
    carbs: Number(obj.carbs) || 0,
  };
}
