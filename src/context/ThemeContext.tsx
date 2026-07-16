import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getTheme, setTheme, ThemeName } from '../lib/theme';

interface ThemeContextValue {
  section: ThemeName; // 'blue' (electronics) | 'pink' (cosmetics) — the active catalogue
  toggleSection: () => void;
  setSection: (section: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [section, setSectionState] = useState<ThemeName>(() => getTheme());

  useEffect(() => {
    setTheme(section);
  }, [section]);

  function setSection(next: ThemeName) {
    setSectionState(next);
  }

  function toggleSection() {
    setSectionState((prev) => (prev === 'pink' ? 'blue' : 'pink'));
  }

  return (
    <ThemeContext.Provider value={{ section, toggleSection, setSection }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
