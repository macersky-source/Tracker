"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-api";
import type { FoodEntryRow } from "@/lib/types";

type DiaryResponse = {
  date: string;
  entries: FoodEntryRow[];
  totals: { calories: number; protein: number; fat: number; carbs: number };
  goals: {
    daily_calories: number;
    daily_protein: number;
    daily_fat: number;
    daily_carbs: number;
  };
};

export function TodayView({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<DiaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const json = (await apiFetch("/api/diary")) as DiaryResponse;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  async function remove(id: string) {
    await apiFetch(`/api/diary/${id}`, { method: "DELETE" });
    await load();
  }

  if (loading) return <p>Загрузка…</p>;
  if (error) return <p className="error">{error}</p>;
  if (!data) return null;

  const pct = Math.min(
    100,
    Math.round((data.totals.calories / data.goals.daily_calories) * 100) || 0,
  );

  return (
    <section>
      <h2>Сегодня</h2>
      <p>
        {Math.round(data.totals.calories)} / {data.goals.daily_calories} ккал
      </p>
      <div className="bar">
        <div className="bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="macros">
        Б {Math.round(data.totals.protein)} · Ж {Math.round(data.totals.fat)} · У{" "}
        {Math.round(data.totals.carbs)}
      </p>
      <ul className="entries">
        {data.entries.map((e) => (
          <li key={e.id}>
            <div>
              <strong>
                {e.food_name}
                {e.source === "ai_estimate" ? " ≈" : ""}
              </strong>
              <span>{Math.round(Number(e.calories))} ккал</span>
            </div>
            <button type="button" onClick={() => void remove(e.id)}>
              Удалить
            </button>
          </li>
        ))}
      </ul>
      {data.entries.length === 0 && <p>Пока пусто — добавьте еду.</p>}
    </section>
  );
}
