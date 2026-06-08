import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeMode = "light" | "dark" | "system";
export type FontSize = "small" | "medium" | "large";

interface ThemeState {
  theme: ThemeMode;
  accent: string;
  fontSize: FontSize;
  highContrast: boolean;
  reducedMotion: boolean;
  setTheme: (t: ThemeMode) => void;
  setAccent: (c: string) => void;
  setFontSize: (s: FontSize) => void;
  setHighContrast: (v: boolean) => void;
  setReducedMotion: (v: boolean) => void;
}

const Ctx = createContext<ThemeState | null>(null);

function read<T extends string | boolean>(k: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const v = localStorage.getItem(k);
  if (v === null) return fallback;
  if (typeof fallback === "boolean") return (v === "true") as T;
  return v as T;
}

function applyTheme(theme: ThemeMode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", isDark);
  root.classList.toggle("light", !isDark);
}

function applyAccent(hex: string) {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--accent-custom", hex);
}

function applyFont(size: FontSize) {
  if (typeof document === "undefined") return;
  const r = document.documentElement;
  r.classList.remove("font-sm", "font-md", "font-lg");
  r.classList.add(size === "small" ? "font-sm" : size === "large" ? "font-lg" : "font-md");
}

function applyContrast(v: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("high-contrast", v);
}

function applyMotion(v: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("reduce-motion", v);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeS] = useState<ThemeMode>("dark");
  const [accent, setAccentS] = useState<string>("#D4AF37");
  const [fontSize, setFontSizeS] = useState<FontSize>("medium");
  const [highContrast, setHCS] = useState(false);
  const [reducedMotion, setRMS] = useState(false);

  useEffect(() => {
    const t = read<ThemeMode>("sf_theme", "dark");
    const a = read<string>("sf_accent", "#D4AF37");
    const f = read<FontSize>("sf_font", "medium");
    const hc = read<boolean>("sf_hc", false);
    const rm = read<boolean>("sf_rm", false);
    setThemeS(t); setAccentS(a); setFontSizeS(f); setHCS(hc); setRMS(rm);
    applyTheme(t); applyAccent(a); applyFont(f); applyContrast(hc); applyMotion(rm);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onMq = () => { if (read<ThemeMode>("sf_theme", "dark") === "system") applyTheme("system"); };
    mq.addEventListener("change", onMq);
    return () => mq.removeEventListener("change", onMq);
  }, []);

  const update = <T extends string | boolean>(key: string, v: T, apply: (v: T) => void, setter: (v: T) => void) => {
    setter(v);
    apply(v);
    if (typeof window !== "undefined") localStorage.setItem(key, String(v));
  };

  return (
    <Ctx.Provider value={{
      theme, accent, fontSize, highContrast, reducedMotion,
      setTheme: (v) => update("sf_theme", v, applyTheme, setThemeS),
      setAccent: (v) => update("sf_accent", v, applyAccent, setAccentS),
      setFontSize: (v) => update("sf_font", v, applyFont, setFontSizeS),
      setHighContrast: (v) => update("sf_hc", v, applyContrast, setHCS),
      setReducedMotion: (v) => update("sf_rm", v, applyMotion, setRMS),
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useTheme() {
  const v = useContext(Ctx);
  if (!v) throw new Error("ThemeProvider missing");
  return v;
}
