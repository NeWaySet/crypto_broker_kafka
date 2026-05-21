import { useEffect, useState } from "react";
import { defaultSettings } from "../data/mockData";
import type { Settings } from "../types";
import { loadJson, saveJson } from "../utils/storage";

const settingsKey = "cryptobroker.settings.v2";

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() => loadJson<Settings>(settingsKey, defaultSettings));

  useEffect(() => {
    saveJson(settingsKey, settings);
    const resolvedTheme = settings.theme === "system"
      ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : settings.theme;
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.dataset.fontSize = settings.fontSize;
    document.documentElement.style.setProperty("--accent", settings.accentColor);
    document.documentElement.dataset.wallpaper = settings.chatBackground;
  }, [settings]);

  function toggleTheme() {
    setSettings((current) => ({
      ...current,
      theme: current.theme === "dark" ? "light" : "dark",
    }));
  }

  return { settings, setSettings, toggleTheme };
}
