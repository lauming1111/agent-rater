"use client";

import { type ReactNode } from "react";

import type { ThemeMode } from "./useThemeMode";

type StickyHeaderProps = {
  themeMode: ThemeMode;
  isDark: boolean;
  onToggleTheme: () => void;
  children?: ReactNode;
};

export function StickyHeader({ themeMode, isDark, onToggleTheme, children }: StickyHeaderProps) {
  return (
    <div
      className={`fixed right-4 top-4 z-50 sm:right-6 lg:right-10 ${
        isDark ? "text-slate-100" : "text-slate-900"
      }`}
    >
      <div
        className={`flex flex-col items-end gap-2 rounded-2xl p-2 ${
          isDark ? "bg-slate-950/70 backdrop-blur" : "bg-slate-50/70 backdrop-blur"
        }`}
      >
        <button
          type="button"
          onClick={onToggleTheme}
          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition ${
            isDark
              ? "border-slate-700 bg-slate-800 text-slate-100 hover:border-emerald-400 hover:text-emerald-200"
            : "border-slate-200 bg-slate-50 text-slate-800 hover:border-emerald-300 hover:text-emerald-700"
          }`}
        >
          {themeMode === "system"
            ? `Theme: System (${isDark ? "Dark" : "Light"})`
            : `Theme: ${themeMode === "dark" ? "Dark" : "Light"}`}
        </button>
        {children}
      </div>
    </div>
  );
}
