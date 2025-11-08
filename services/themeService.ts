type Theme = 'dark' | 'light' | 'auto';

interface ThemeConfig {
  name: string;
  colors: {
    bg: string;
    surface: string;
    subtle: string;
    muted: string;
    accent: string;
    text: string;
  };
}

class ThemeService {
  private currentTheme: Theme = 'dark';
  private themes: Record<Theme, ThemeConfig> = {
    dark: {
      name: 'Dark',
      colors: {
        bg: '#0D0D0F',
        surface: '#1C1C1E',
        subtle: '#3A3A3C',
        muted: '#8E8E93',
        accent: '#3B82F6',
        text: '#FFFFFF'
      }
    },
    light: {
      name: 'Light',
      colors: {
        bg: '#FFFFFF',
        surface: '#F8F9FA',
        subtle: '#E9ECEF',
        muted: '#6C757D',
        accent: '#007BFF',
        text: '#212529'
      }
    },
    auto: {
      name: 'Auto',
      colors: {
        bg: '#0D0D0F',
        surface: '#1C1C1E',
        subtle: '#3A3A3C',
        muted: '#8E8E93',
        accent: '#3B82F6',
        text: '#FFFFFF'
      }
    }
  };

  constructor() {
    this.loadTheme();
    this.applyTheme();
    this.setupAutoTheme();
  }

  private loadTheme(): void {
    const saved = localStorage.getItem('theme') as Theme;
    if (saved && saved in this.themes) {
      this.currentTheme = saved;
    }
  }

  private saveTheme(): void {
    localStorage.setItem('theme', this.currentTheme);
  }

  private setupAutoTheme(): void {
    if (this.currentTheme === 'auto') {
      this.updateAutoTheme();
      // Listen for system theme changes
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (this.currentTheme === 'auto') {
          this.updateAutoTheme();
        }
      });
    }
  }

  private updateAutoTheme(): void {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    this.themes.auto = prefersDark ? this.themes.dark : this.themes.light;
    this.applyTheme();
  }

  setTheme(theme: Theme): void {
    this.currentTheme = theme;
    this.saveTheme();

    if (theme === 'auto') {
      this.setupAutoTheme();
    } else {
      this.applyTheme();
    }
  }

  getCurrentTheme(): Theme {
    return this.currentTheme;
  }

  getThemeConfig(): ThemeConfig {
    return this.themes[this.currentTheme];
  }

  private applyTheme(): void {
    const config = this.getThemeConfig();
    const root = document.documentElement;

    // Apply CSS custom properties
    root.style.setProperty('--theme-bg', config.colors.bg);
    root.style.setProperty('--theme-surface', config.colors.surface);
    root.style.setProperty('--theme-subtle', config.colors.subtle);
    root.style.setProperty('--theme-muted', config.colors.muted);
    root.style.setProperty('--theme-accent', config.colors.accent);
    root.style.setProperty('--theme-text', config.colors.text);

    // Update body background
    document.body.style.backgroundColor = config.colors.bg;
    document.body.style.color = config.colors.text;
  }

  getAvailableThemes(): Array<{ key: Theme; config: ThemeConfig }> {
    return Object.entries(this.themes).map(([key, config]) => ({
      key: key as Theme,
      config
    }));
  }

  // Keyboard shortcuts
  private shortcuts: Array<{ keys: string[]; action: () => void; description: string }> = [
    {
      keys: ['ctrl', 'shift', 't'],
      action: () => this.cycleTheme(),
      description: 'Cycle through themes'
    },
    {
      keys: ['ctrl', 'shift', 'l'],
      action: () => this.setTheme('light'),
      description: 'Switch to light theme'
    },
    {
      keys: ['ctrl', 'shift', 'd'],
      action: () => this.setTheme('dark'),
      description: 'Switch to dark theme'
    },
    {
      keys: ['ctrl', 'shift', 'a'],
      action: () => this.setTheme('auto'),
      description: 'Switch to auto theme'
    }
  ];

  private cycleTheme(): void {
    const themes: Theme[] = ['dark', 'light', 'auto'];
    const currentIndex = themes.indexOf(this.currentTheme);
    const nextIndex = (currentIndex + 1) % themes.length;
    this.setTheme(themes[nextIndex]);
  }

  setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (event) => {
      for (const shortcut of this.shortcuts) {
        const keysPressed = shortcut.keys.every(key => {
          switch (key) {
            case 'ctrl': return event.ctrlKey || event.metaKey;
            case 'shift': return event.shiftKey;
            case 'alt': return event.altKey;
            default: return event.key.toLowerCase() === key;
          }
        });

        if (keysPressed) {
          event.preventDefault();
          shortcut.action();
          break;
        }
      }
    });
  }

  getKeyboardShortcuts(): Array<{ keys: string[]; description: string }> {
    return this.shortcuts.map(({ keys, description }) => ({ keys, description }));
  }
}

export const themeService = new ThemeService();