import type { KeybindingsManager } from "@earendil-works/pi-coding-agent";
// `Keybinding` lives in pi-tui, but pi-coding-agent declaration-merges its own
// `app.*` actions into it — so this single union covers both namespaces.
import type { Keybinding } from "@earendil-works/pi-tui";

/** One line of a cheatsheet: the keys to press, and what they do. */
export type ShortcutRow = readonly [keys: string, description: string];

export type ShortcutGroup = {
  readonly title: string;
  readonly rows: readonly ShortcutRow[];
};

/**
 * Static cheatsheet for the Neovim layer this extension adds (`/keymaps`).
 *
 * These bindings are implemented here rather than by Pi, so they are literals
 * rather than resolved through the keybindings manager.
 */
export const KEYMAP_GROUPS = [
  {
    title: "MODES",
    rows: [
      ["Esc", "INSERT → NORMAL; again interrupts"],
      ["i/a · I/A", "insert/append · line start/end"],
      ["o/O", "open line below/above"],
    ],
  },
  {
    title: "TRANSCRIPT · NORMAL · FULLSCREEN",
    rows: [
      ["j/k · Ctrl+d/u", "scroll one line / half page"],
      ["gg/G", "scroll to top/bottom"],
    ],
  },
  {
    title: "EDITING · NORMAL",
    rows: [
      ["h/l · w/b/e", "move character / word"],
      ["0/$", "move to line start/end"],
      ["x · dd", "delete character / line"],
      ["D/C · u", "delete/change to EOL · undo"],
    ],
  },
  {
    title: "MODALS",
    rows: [
      ["h/j/k/l", "tree branches / move selection"],
      ["Ctrl+d/u", "page down/up"],
      ["i or /", "enter search mode"],
      ["Esc", "normal mode / close"],
    ],
  },
] as const satisfies readonly ShortcutGroup[];

/**
 * A cheatsheet row that names a Pi action instead of a literal key.
 *
 * The keys are resolved at display time, so the overlay always reflects the
 * user's own keybindings. `satisfies` checks every action id against Pi's
 * `Keybinding` union, so a renamed action fails to typecheck.
 */
type HotkeyDefinition = {
  readonly title: string;
  readonly rows: readonly (readonly [action: Keybinding, description: string])[];
};

const PI_HOTKEY_DEFINITIONS = [
  {
    title: "INPUT",
    rows: [
      ["tui.input.submit", "Submit input"],
      ["tui.input.newLine", "Insert newline"],
      ["tui.input.tab", "Complete / autocomplete"],
      ["app.clipboard.pasteImage", "Paste image or text"],
    ],
  },
  {
    title: "EDITOR",
    rows: [
      ["tui.editor.cursorLeft", "Move cursor left"],
      ["tui.editor.cursorWordLeft", "Move one word left"],
      ["tui.editor.cursorLineStart", "Move to line start"],
      ["tui.editor.deleteWordBackward", "Delete word backward"],
      ["tui.editor.undo", "Undo"],
    ],
  },
  {
    title: "CONTROL",
    rows: [
      ["app.interrupt", "Cancel / abort"],
      ["app.clear", "Clear editor"],
      ["app.exit", "Exit when empty"],
      ["app.suspend", "Suspend"],
    ],
  },
  {
    title: "MODELS & VIEW",
    rows: [
      ["app.thinking.cycle", "Cycle thinking level"],
      ["app.model.cycleForward", "Next model"],
      ["app.model.cycleBackward", "Previous model"],
      ["app.model.select", "Open model selector"],
      ["app.tools.expand", "Toggle tool output"],
      ["app.thinking.toggle", "Toggle thinking blocks"],
      ["app.editor.external", "Open external editor"],
    ],
  },
  {
    title: "MESSAGES",
    rows: [
      ["app.message.copy", "Copy last message"],
      ["app.message.followUp", "Queue follow-up"],
      ["app.message.dequeue", "Restore queued message"],
    ],
  },
  {
    title: "TRANSCRIPT",
    rows: [
      ["tui.altScreen.pageUp", "Scroll one page up"],
      ["tui.altScreen.pageDown", "Scroll one page down"],
      ["tui.altScreen.previousPrompt", "Previous prompt"],
      ["tui.altScreen.nextPrompt", "Next prompt"],
      ["tui.altScreen.top", "Scroll to top"],
      ["tui.altScreen.bottom", "Scroll to bottom"],
    ],
  },
] as const satisfies readonly HotkeyDefinition[];

/** Shortcuts owned by this extension rather than by Pi. */
const EXTENSION_SHORTCUTS: ShortcutGroup = {
  title: "SESSION",
  rows: [
    ["Ctrl+r", "Rename current session"],
    ["Ctrl+Shift+r", "Reload Pi"],
  ],
};

/**
 * Builds the `/hotkeys` cheatsheet against the user's current keybindings.
 *
 * Actions with no bound key are dropped rather than rendered as a blank row.
 */
export function resolvePiHotkeyGroups(
  keybindings: KeybindingsManager,
): readonly ShortcutGroup[] {
  return [
    EXTENSION_SHORTCUTS,
    ...PI_HOTKEY_DEFINITIONS.map((group) => ({
      title: group.title,
      rows: group.rows
        .map(([action, description]): ShortcutRow => [
          keybindings.getKeys(action).join(" / "),
          description,
        ])
        .filter(([keys]) => keys.length > 0),
    })),
  ];
}
