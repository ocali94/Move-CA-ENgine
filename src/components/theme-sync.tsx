"use client";

import { useEffect } from "react";

/**
 * Re-applies the persisted theme class after hydration. The inline script in
 * the root layout prevents a flash before paint, but React can restore the
 * server-rendered className during hydration; this effect wins afterwards.
 */
export function ThemeSync() {
  useEffect(() => {
    const theme = window.localStorage.getItem("move-ca-theme") ?? "dark";
    document.documentElement.classList.toggle("light", theme === "light");
    document.documentElement.classList.toggle("dark", theme !== "light");
  }, []);

  return null;
}
