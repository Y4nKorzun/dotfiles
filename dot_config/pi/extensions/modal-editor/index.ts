/**
 * A Neovim layer for Pi.
 *
 * Three independent pieces, wired together here:
 *  - `editor`    — modal (normal/insert) editing in the prompt
 *  - `selector`  — Pi's built-in selectors rendered as modal overlays
 *  - `overlay` + `shortcuts` — the `/keymaps` and `/hotkeys` cheatsheets
 *
 * Pi discovers extensions one level deep, so this directory is loaded as a
 * single extension via `index.ts`; the sibling modules are plain imports.
 */
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { ModalEditor } from "./editor";
import { showInputPrompt } from "./input-overlay";
import { showShortcuts } from "./overlay";
import { installModalSelectorPatch } from "./selector";
import { KEYMAP_GROUPS, resolvePiHotkeyGroups } from "./shortcuts";

export { ModalEditor } from "./editor";

/** The Neovim cheatsheet is narrow; Pi's hotkey list needs room for key names. */
const KEYMAPS_WIDTH = 60;
const HOTKEYS_WIDTH = 80;
const RENAME_WIDTH = 52;

/**
 * Ctrl+r: rename the session through a small modal.
 *
 * Every Pi call here can throw once this closure's extension runtime has been
 * reloaded out from under it. This runs detached from `handleInput`, so an
 * escaping rejection would surface as an unhandled rejection rather than a
 * failed keystroke — losing the rename is the better outcome.
 */
async function renameSession(pi: ExtensionAPI, ctx: Pick<ExtensionContext, "ui">): Promise<void> {
  try {
    const current = pi.getSessionName();
    const name = await showInputPrompt(ctx, {
      title: "RENAME SESSION",
      initialValue: current ?? "",
      width: RENAME_WIDTH,
    });

    const trimmed = name?.trim();
    if (!trimmed || trimmed === current) return;
    pi.setSessionName(trimmed);
  } catch {
    // Stale runtime — see above.
  }
}

export default function modalEditor(pi: ExtensionAPI): void {
  installModalSelectorPatch();

  pi.registerCommand("keymaps", {
    description: "Show Neovim keymaps",
    handler: async (_args, ctx) =>
      showShortcuts(ctx, {
        title: "NEOVIM KEYMAPS",
        groups: KEYMAP_GROUPS,
        width: KEYMAPS_WIDTH,
      }),
  });

  pi.on("session_start", (_event, ctx) => {
    ctx.ui.setEditorComponent((tui, theme, keybindings) => {
      const editor = new ModalEditor(tui, theme, keybindings);
      editor.onRenameSession = () => void renameSession(pi, ctx);
      // `/hotkeys` is typed into the prompt rather than registered as a command,
      // so it can render the live keybindings captured in this factory.
      editor.onHotkeys = () =>
        void showShortcuts(ctx, {
          title: "PI HOTKEYS",
          groups: resolvePiHotkeyGroups(keybindings),
          width: HOTKEYS_WIDTH,
        });
      return editor;
    });
  });
}
