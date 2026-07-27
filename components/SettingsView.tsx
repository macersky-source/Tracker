"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-api";

type Goals = {
  daily_calories: number;
  daily_protein: number;
  daily_fat: number;
  daily_carbs: number;
};

export function SettingsView() {
  const [goals, setGoals] = useState<Goals>({
    daily_calories: 2000,
    daily_protein: 120,
    daily_fat: 70,
    daily_carbs: 250,
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const data = (await apiFetch("/api/settings")) as { goals: Goals };
        setGoals(data.goals);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ошибка загрузки");
      }
    })();
  }, []);

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const data = (await apiFetch("/api/settings", {
        method: "PATCH",
        body: JSON.stringify(goals),
      })) as { goals: Goals };
      setGoals(data.goals);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2>Цели на день</h2>
      {(
        [
          ["daily_calories", "Калории"],
          ["daily_protein", "Белки (г)"],
          ["daily_fat", "Жиры (г)"],
          ["daily_carbs", "Углеводы (г)"],
        ] as const
      ).map(([key, label]) => (
        <label className="field" key={key}>
          {label}
          <input
            type="number"
            min={1}
            value={goals[key]}
            onChange={(e) =>
              setGoals((g) => ({ ...g, [key]: Number(e.target.value) }))
            }
          />
        </label>
      ))}
      {error && <p className="error">{error}</p>}
      {saved && <p>Сохранено</p>}
      <button type="button" className="btn" disabled={busy} onClick={() => void save()}>
        {busy ? "Сохраняю…" : "Сохранить"}
      </button>
    </section>
  );
}
