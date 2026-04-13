import { createContext, FC, PropsWithChildren, useContext, useEffect, useState } from "react";

export const ACCENT_COLORS = [
  { name: "Sapphire", primary: "#3B82F6", secondary: "#60A5FA", glow: "rgba(59,130,246,0.3)" },
  { name: "Emerald", primary: "#10B981", secondary: "#34D399", glow: "rgba(16,185,129,0.3)" },
  { name: "Rose", primary: "#F43F5E", secondary: "#FB7185", glow: "rgba(244,63,94,0.3)" },
  { name: "Amber", primary: "#F59E0B", secondary: "#FBBF24", glow: "rgba(245,158,11,0.3)" },
  { name: "Violet", primary: "#8B5CF6", secondary: "#A78BFA", glow: "rgba(139,92,246,0.3)" },
  { name: "Cyan", primary: "#06B6D4", secondary: "#22D3EE", glow: "rgba(6,182,212,0.3)" },
  { name: "Fuchsia", primary: "#D946EF", secondary: "#E879F9", glow: "rgba(217,70,239,0.3)" },
  { name: "Lime", primary: "#84CC16", secondary: "#A3E635", glow: "rgba(132,204,22,0.3)" },
  { name: "Orange", primary: "#F97316", secondary: "#FB923C", glow: "rgba(249,115,22,0.3)" },
  { name: "Teal", primary: "#14B8A6", secondary: "#2DD4BF", glow: "rgba(20,184,166,0.3)" },
];

type AccentColorContextType = {
  accentIndex: number;
  accent: typeof ACCENT_COLORS[0];
};

const AccentColorContext = createContext<AccentColorContextType>({
  accentIndex: 0,
  accent: ACCENT_COLORS[0],
});

export const AccentColorProvider: FC<PropsWithChildren> = ({ children }) => {
  const [accentIndex, setAccentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setAccentIndex((prev) => (prev + 1) % ACCENT_COLORS.length);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const accent = ACCENT_COLORS[accentIndex];
    document.documentElement.style.setProperty("--accent-primary", accent.primary);
    document.documentElement.style.setProperty("--accent-secondary", accent.secondary);
    document.documentElement.style.setProperty("--accent-glow", accent.glow);
  }, [accentIndex]);

  return (
    <AccentColorContext.Provider value={{ accentIndex, accent: ACCENT_COLORS[accentIndex] }}>
      {children}
    </AccentColorContext.Provider>
  );
};

export const useAccentColor = () => useContext(AccentColorContext);
