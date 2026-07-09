"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);
  const nextTheme: Theme = theme === "dark" ? "light" : "dark";

  useEffect(() => {
    const currentTheme = getCurrentTheme();
    setDocumentTheme(currentTheme);
    setTheme(currentTheme);
    setMounted(true);
  }, []);

  return (
    <button
      aria-label={mounted ? `Switch to ${nextTheme} mode` : "Toggle color theme"}
      aria-pressed={mounted ? theme === "dark" : undefined}
      className="theme-toggle"
      onClick={() => {
        setDocumentTheme(nextTheme);
        storeTheme(nextTheme);
        setTheme(nextTheme);
      }}
      type="button"
    >
      {mounted ? (theme === "dark" ? "Light" : "Dark") : "Theme"}
    </button>
  );
}

function getCurrentTheme(): Theme {
  const activeTheme = document.documentElement.dataset.theme;
  if (activeTheme === "dark" || activeTheme === "light") {
    return activeTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function setDocumentTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

function storeTheme(theme: Theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Theme still changes for the current page when storage is unavailable.
  }
}
