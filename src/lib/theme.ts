const THEME_KEY = 'xplore-theme';

export type ThemeName = 'blue' | 'pink';

export function getTheme(): ThemeName {
  return localStorage.getItem(THEME_KEY) === 'pink' ? 'pink' : 'blue';
}

export function setTheme(theme: ThemeName) {
  localStorage.setItem(THEME_KEY, theme);
  document.body.setAttribute('data-theme', theme);
}

export function applyStoredTheme() {
  document.body.setAttribute('data-theme', getTheme());
}
