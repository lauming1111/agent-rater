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
      className={`sticky top-0 z-50 flex justify-end px-4 py-4 sm:px-6 lg:px-10 ${
        isDark ? "bg-slate-950/80 backdrop-blur" : "bg-slate-50/80 backdrop-blur"
      }`}
    >
      <div className="flex flex-col items-end gap-2">
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

