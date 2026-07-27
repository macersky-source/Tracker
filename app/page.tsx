"use client";

import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import { TodayView } from "@/components/TodayView";
import { AddSearch } from "@/components/AddSearch";
import { AddText } from "@/components/AddText";
import { SettingsView } from "@/components/SettingsView";
import { apiFetch, getInitData } from "@/lib/client-api";

type Tab = "today" | "search" | "text" | "settings";

export default function Home() {
  const [tab, setTab] = useState<Tab>("today");
  const [refreshKey, setRefreshKey] = useState(0);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    window.Telegram?.WebApp?.ready();
    window.Telegram?.WebApp?.expand();
    async function boot() {
      if (!getInitData()) {
        setAuthError(
          "Откройте приложение из Telegram (нет initData в браузере).",
        );
        return;
      }
      try {
        await apiFetch("/api/auth/validate", { method: "POST" });
      } catch (e) {
        setAuthError(e instanceof Error ? e.message : "Auth failed");
      }
    }
    void boot();
  }, []);

  function onSaved() {
    setRefreshKey((k) => k + 1);
    setTab("today");
  }

  return (
    <main className="app">
      <h1>Calorie Tracker</h1>
      {authError && <p className="error">{authError}</p>}
      <Nav tab={tab} onChange={setTab} />
      {tab === "today" && <TodayView refreshKey={refreshKey} />}
      {tab === "search" && <AddSearch onSaved={onSaved} />}
      {tab === "text" && <AddText onSaved={onSaved} />}
      {tab === "settings" && <SettingsView />}
    </main>
  );
}
