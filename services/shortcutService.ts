interface Shortcut {
  id: string;
  keys: string[];
  action: () => void;
  description: string;
  category: string;
  enabled: boolean;
}

interface ShortcutGroup {
  name: string;
  shortcuts: Shortcut[];
}

class ShortcutService {
  private shortcuts: Map<string, Shortcut> = new Map();
  private groups: Map<string, ShortcutGroup> = new Map();

  constructor() {
    this.setupGlobalShortcuts();
    this.setupKeyboardListener();
  }

  private setupGlobalShortcuts(): void {
    // IDE shortcuts
    this.registerShortcut({
      id: 'save-project',
      keys: ['ctrl', 's'],
      action: () => {
        // Trigger save action
        const saveEvent = new CustomEvent('shortcut-save');
        document.dispatchEvent(saveEvent);
      },
      description: 'Save current project',
      category: 'IDE',
      enabled: true
    });

    this.registerShortcut({
      id: 'new-prompt',
      keys: ['ctrl', 'enter'],
      action: () => {
        const promptEvent = new CustomEvent('shortcut-new-prompt');
        document.dispatchEvent(promptEvent);
      },
      description: 'Send new prompt',
      category: 'Chat',
      enabled: true
    });

    this.registerShortcut({
      id: 'toggle-preview',
      keys: ['ctrl', 'shift', 'p'],
      action: () => {
        const previewEvent = new CustomEvent('shortcut-toggle-preview');
        document.dispatchEvent(previewEvent);
      },
      description: 'Toggle preview/code view',
      category: 'View',
      enabled: true
    });

    this.registerShortcut({
      id: 'focus-chat',
      keys: ['ctrl', 'shift', 'c'],
      action: () => {
        const chatEvent = new CustomEvent('shortcut-focus-chat');
        document.dispatchEvent(chatEvent);
      },
      description: 'Focus chat input',
      category: 'Navigation',
      enabled: true
    });

    this.registerShortcut({
      id: 'clear-chat',
      keys: ['ctrl', 'shift', 'x'],
      action: () => {
        const clearEvent = new CustomEvent('shortcut-clear-chat');
        document.dispatchEvent(clearEvent);
      },
      description: 'Clear chat history',
      category: 'Chat',
      enabled: true
    });

    // Editor shortcuts (when code editor is focused)
    this.registerShortcut({
      id: 'editor-find',
      keys: ['ctrl', 'f'],
      action: () => {
        const findEvent = new CustomEvent('shortcut-editor-find');
        document.dispatchEvent(findEvent);
      },
      description: 'Find in editor',
      category: 'Editor',
      enabled: true
    });

    this.registerShortcut({
      id: 'editor-replace',
      keys: ['ctrl', 'h'],
      action: () => {
        const replaceEvent = new CustomEvent('shortcut-editor-replace');
        document.dispatchEvent(replaceEvent);
      },
      description: 'Replace in editor',
      category: 'Editor',
      enabled: true
    });

    this.registerShortcut({
      id: 'editor-format',
      keys: ['shift', 'alt', 'f'],
      action: () => {
        const formatEvent = new CustomEvent('shortcut-editor-format');
        document.dispatchEvent(formatEvent);
      },
      description: 'Format document',
      category: 'Editor',
      enabled: true
    });
  }

  private setupKeyboardListener(): void {
    document.addEventListener('keydown', (event) => {
      // Skip if typing in input/textarea
      if (event.target instanceof HTMLInputElement ||
          event.target instanceof HTMLTextAreaElement ||
          (event.target as HTMLElement)?.contentEditable === 'true') {
        return;
      }

      const pressedKeys = this.getPressedKeys(event);

      for (const shortcut of this.shortcuts.values()) {
        if (!shortcut.enabled) continue;

        if (this.keysMatch(shortcut.keys, pressedKeys)) {
          event.preventDefault();
          event.stopPropagation();
          shortcut.action();

          // Show visual feedback
          this.showShortcutFeedback(shortcut);
          break;
        }
      }
    });
  }

  private getPressedKeys(event: KeyboardEvent): string[] {
    const keys: string[] = [];

    if (event.ctrlKey || event.metaKey) keys.push('ctrl');
    if (event.shiftKey) keys.push('shift');
    if (event.altKey) keys.push('alt');

    if (event.key && event.key.length === 1) {
      keys.push(event.key.toLowerCase());
    } else if (event.key) {
      keys.push(event.key.toLowerCase());
    }

    return keys;
  }

  private keysMatch(shortcutKeys: string[], pressedKeys: string[]): boolean {
    if (shortcutKeys.length !== pressedKeys.length) return false;

    return shortcutKeys.every(key => pressedKeys.includes(key));
  }

  private showShortcutFeedback(shortcut: Shortcut): void {
    // Create temporary feedback element
    const feedback = document.createElement('div');
    feedback.textContent = `${shortcut.description} (${shortcut.keys.join('+')})`;
    feedback.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 14px;
      z-index: 9999;
      pointer-events: none;
      animation: fadeInOut 2s ease-in-out;
    `;

    document.body.appendChild(feedback);

    setTimeout(() => {
      document.body.removeChild(feedback);
    }, 2000);
  }

  registerShortcut(shortcut: Shortcut): void {
    this.shortcuts.set(shortcut.id, shortcut);

    // Add to group
    if (!this.groups.has(shortcut.category)) {
      this.groups.set(shortcut.category, {
        name: shortcut.category,
        shortcuts: []
      });
    }

    this.groups.get(shortcut.category)!.shortcuts.push(shortcut);
  }

  unregisterShortcut(id: string): void {
    const shortcut = this.shortcuts.get(id);
    if (shortcut) {
      this.shortcuts.delete(id);

      // Remove from group
      const group = this.groups.get(shortcut.category);
      if (group) {
        group.shortcuts = group.shortcuts.filter(s => s.id !== id);
        if (group.shortcuts.length === 0) {
          this.groups.delete(shortcut.category);
        }
      }
    }
  }

  enableShortcut(id: string): void {
    const shortcut = this.shortcuts.get(id);
    if (shortcut) {
      shortcut.enabled = true;
    }
  }

  disableShortcut(id: string): void {
    const shortcut = this.shortcuts.get(id);
    if (shortcut) {
      shortcut.enabled = false;
    }
  }

  getAllShortcuts(): Shortcut[] {
    return Array.from(this.shortcuts.values());
  }

  getShortcutsByCategory(): ShortcutGroup[] {
    return Array.from(this.groups.values());
  }

  getShortcutDisplayKeys(keys: string[]): string {
    return keys.map(key => {
      switch (key) {
        case 'ctrl': return 'Ctrl';
        case 'shift': return 'Shift';
        case 'alt': return 'Alt';
        default: return key.toUpperCase();
      }
    }).join(' + ');
  }

  // Custom event triggers for components to listen to
  triggerShortcut(id: string): void {
    const shortcut = this.shortcuts.get(id);
    if (shortcut && shortcut.enabled) {
      shortcut.action();
    }
  }
}

export const shortcutService = new ShortcutService();