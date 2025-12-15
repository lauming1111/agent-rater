"use client";

import { useCallback, useEffect, useState } from "react";

export type ThemeMode = "system" | "light" | "dark";

export function useThemeMode(initial: ThemeMode = "system") {
  const [themeMode, setThemeMode] = useState<ThemeMode>(initial);
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!media) return;

    const apply = () => setSystemTheme(media.matches ? "dark" : "light");
    apply();

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", apply);
      return () => media.removeEventListener("change", apply);
    }

    media.addListener(apply);
    return () => media.removeListener(apply);
  }, []);

  const effectiveTheme = themeMode === "system" ? systemTheme : themeMode;
  const isDark = effectiveTheme === "dark";

  const toggleThemeMode = useCallback(() => {
    setThemeMode((prev) => {
      if (prev === "system") return isDark ? "light" : "dark";
      if (prev === "dark") return "light";
      return "system";
    });
  }, [isDark]);

  return { themeMode, setThemeMode, systemTheme, effectiveTheme, isDark, toggleThemeMode };
}
