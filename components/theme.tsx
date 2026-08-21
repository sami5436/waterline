"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "waterline-theme";

/**
 * Runs before first paint so a returning dark-mode visitor never sees a white
 * flash. It only reads the stored choice — light is the default, regardless of
 * what the operating system prefers.
 */
export const themeBootScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  STORAGE_KEY,
)});document.documentElement.dataset.theme=(t==="dark"||t==="light")?t:"light";}catch(e){document.documentElement.dataset.theme="light";}})();`;

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: "light",
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Matches what the server rendered; the effect below adopts the stored
  // choice, which the boot script has already applied to the DOM.
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const stored = document.documentElement.dataset.theme;
    if (stored === "dark" || stored === "light") setTheme(stored);
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Private browsing, blocked storage — the choice just won't persist.
      }
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${dark ? "light" : "dark"} mode`}
      title={`Switch to ${dark ? "light" : "dark"} mode`}
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-card text-fg-muted transition-colors hover:border-line-strong hover:bg-muted hover:text-fg"
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="3.1" stroke="currentColor" strokeWidth="1.2" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <line
          key={deg}
          x1="8"
          y1="1.4"
          x2="8"
          y2="3"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          transform={`rotate(${deg} 8 8)`}
        />
      ))}
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M13.2 9.6A5.6 5.6 0 0 1 6.4 2.8a5.6 5.6 0 1 0 6.8 6.8Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
