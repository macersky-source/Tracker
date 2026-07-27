"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/client-api";
import type { MatchedFoodItem, MealType } from "@/lib/types";

export function AddText({ onSaved }: { onSaved: () => void }) {
  const [text, setText] = useState("");
  const [items, setItems] = useState<MatchedFoodItem[]>([]);
  const [mealType, setMealType] = useState<MealType>("snack");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function parse() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const data = (await apiFetch("/api/food/parse", {
        method: "POST",
        body: JSON.stringify({ text }),
      })) as { items: MatchedFoodItem[] };
      setItems(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка разбора");
    } finally {
      setBusy(false);
    }
  }

  async function saveAll() {
    if (!items.length || busy) return;
    setBusy(true);
    setError(null);
    try {
      for (const item of items) {
        await apiFetch("/api/diary", {
          method: "POST",
          body: JSON.stringify({
            meal_type: mealType,
            food_name: item.food_name,
            calories: item.calories,
            protein: item.protein,
            fat: item.fat,
            carbs: item.carbs,
            serving_amount: item.amount,
            serving_unit: item.unit,
            source: item.source,
            fatsecret_id: item.fatsecret_id ?? undefined,
            raw_input: text,
          }),
        });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2>Добавить текстом</h2>
      <label className="field">
        Что съели?
        <textarea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="гречка с курицей и салат"
        />
      </label>
      <label className="field">
        Приём пищи
        <select
          value={mealType}
          onChange={(e) => setMealType(e.target.value as MealType)}
        >
          <option value="breakfast">Завтрак</option>
          <option value="lunch">Обед</option>
          <option value="dinner">Ужин</option>
          <option value="snack">Перекус</option>
        </select>
      </label>
      <button type="button" className="btn" disabled={busy} onClick={() => void parse()}>
        {busy && !items.length ? "Разбираю…" : "Разобрать"}
      </button>
      {error && <p className="error">{error}</p>}
      {items.map((item, idx) => (
        <div className="preview-item" key={`${item.food_name}-${idx}`}>
          <div>
            <strong>
              {item.food_name}
              {item.source === "ai_estimate" ? " ≈" : ""}
            </strong>
            <div style={{ color: "#6b7580", fontSize: "0.85rem" }}>
              {item.amount} {item.unit} · {Math.round(item.calories)} ккал
            </div>
          </div>
          <button
            type="button"
            onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
          >
            Убрать
          </button>
        </div>
      ))}
      {items.length > 0 && (
        <button
          type="button"
          className="btn"
          style={{ marginTop: 12 }}
          disabled={busy}
          onClick={() => void saveAll()}
        >
          {busy ? "Сохраняю…" : "Сохранить всё"}
        </button>
      )}
    </section>
  );
}
