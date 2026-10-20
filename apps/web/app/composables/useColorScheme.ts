type ColorScheme = "light" | "dark";

const STORAGE_KEY = "indiebar-color-scheme";

export function useColorScheme() {
  const colorScheme = useState<ColorScheme>("color-scheme", () => "light");

  function applyColorScheme(scheme: ColorScheme): void {
    colorScheme.value = scheme;
    if (!import.meta.client) return;

    document.documentElement.classList.toggle("app-dark", scheme === "dark");
    localStorage.setItem(STORAGE_KEY, scheme);
  }

  function initializeColorScheme(): void {
    if (!import.meta.client) return;
    const savedScheme = localStorage.getItem(STORAGE_KEY);
    applyColorScheme(savedScheme === "dark" ? "dark" : "light");
  }

  function toggleColorScheme(): void {
    applyColorScheme(colorScheme.value === "dark" ? "light" : "dark");
  }

  return { colorScheme, initializeColorScheme, toggleColorScheme };
}
