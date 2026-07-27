"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-api";
import type { FatSecretFoodDetail, FatSecretSearchItem, FatSecretServing } from "@/lib/fatsecret";
import type { MealType } from "@/lib/types";

export function AddSearch({ onSaved }: { onSaved: () => void }) {
  const [q, setQ] = useState("");
  const [foods, setFoods] = useState<FatSecretSearchItem[]>([]);
  const [detail, setDetail] = useState<FatSecretFoodDetail | null>(null);
  const [serving, setServing] = useState<FatSecretServing | null>(null);
  const [mealType, setMealType] = useState<MealType>("snack");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) {
      setFoods([]);
      return;
    }
    const t = setTimeout(() => {
      void (async () => {
        setSearching(true);
        setError(null);
        try {
          const data = (await apiFetch(
            `/api/food/search?q=${encodeURIComponent(q.trim())}`,
          )) as { foods: FatSecretSearchItem[] };
          setFoods(data.foods);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Ошибка поиска");
        } finally {
          setSearching(false);
        }
      })();
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  async function pickFood(foodId: string) {
    setError(null);
    try {
      const data = (await apiFetch(`/api/food/${foodId}`)) as {
        food: FatSecretFoodDetail;
      };
      setDetail(data.food);
      setServing(data.food.servings[0] ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить продукт");
    }
  }

  async function save() {
    if (!detail || !serving || saving) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/diary", {
        method: "POST",
        body: JSON.stringify({
          meal_type: mealType,
          food_name: detail.food_name,
          calories: Number(serving.calories),
          protein: Number(serving.protein),
          fat: Number(serving.fat),
          carbs: Number(serving.carbohydrate),
          serving_amount: serving.metric_serving_amount
            ? Number(serving.metric_serving_amount)
            : Number(serving.number_of_units ?? 1),
          serving_unit:
            serving.metric_serving_unit ?? serving.serving_description,
          source: "fatsecret",
          fatsecret_id: detail.food_id,
        }),
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  async function addToFavorites() {
    if (!detail || !serving) return;
    setError(null);
    try {
      await apiFetch("/api/favorites", {
        method: "POST",
        body: JSON.stringify({
          food_name: detail.food_name,
          fatsecret_id: detail.food_id,
          default_serving: serving,
        }),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось добавить в избранное");
    }
  }

  return (
    <section>
      <h2>Поиск продуктов</h2>
      <label className="field">
        Запрос
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setDetail(null);
            setServing(null);
          }}
          placeholder="например, творог"
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
      {searching && <p>Ищем…</p>}
      {error && <p className="error">{error}</p>}
      {!detail &&
        foods.map((f) => (
          <button
            key={f.food_id}
            type="button"
            className="list-btn"
            onClick={() => void pickFood(f.food_id)}
          >
            <strong>{f.food_name}</strong>
            {f.brand_name ? ` · ${f.brand_name}` : ""}
            {f.food_description ? (
              <div style={{ color: "#6b7580", fontSize: "0.85rem" }}>
                {f.food_description}
              </div>
            ) : null}
          </button>
        ))}
      {detail && (
        <>
          <p>
            <strong>{detail.food_name}</strong>
          </p>
          <label className="field">
            Порция
            <select
              value={serving?.serving_id ?? ""}
              onChange={(e) => {
                const s =
                  detail.servings.find((x) => x.serving_id === e.target.value) ??
                  null;
                setServing(s);
              }}
            >
              {detail.servings.map((s) => (
                <option key={s.serving_id} value={s.serving_id}>
                  {s.serving_description} — {s.calories} ккал
                </option>
              ))}
            </select>
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn"
              disabled={saving || !serving}
              onClick={() => void save()}
            >
              {saving ? "Сохраняю…" : "Сохранить"}
            </button>
            <button
              type="button"
              className="btn"
              disabled={!serving || !detail}
              onClick={() => void addToFavorites()}
            >
              В избранное
            </button>
          </div>
        </>
      )}
    </section>
  );
}
