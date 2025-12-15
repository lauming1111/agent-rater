"use client";

import { useEffect, useState } from "react";

type BackToTopButtonProps = {
  isDark: boolean;
  thresholdPx?: number;
};

export function BackToTopButton({ isDark, thresholdPx = 500 }: BackToTopButtonProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > thresholdPx);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [thresholdPx]);

  if (!show) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={`fixed bottom-6 right-6 z-50 inline-flex items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold shadow-lg transition hover:-translate-y-0.5 ${
        isDark
          ? "border-slate-700 bg-slate-900 text-slate-100 hover:border-emerald-400 hover:text-emerald-200 shadow-black/40"
          : "border-slate-200 bg-white text-slate-800 hover:border-emerald-300 hover:text-emerald-700"
      }`}
    >
      Back to top
    </button>
  );
}

