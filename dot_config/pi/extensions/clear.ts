/**
 * `/clear` — an alias for Pi's built-in `/new`.
 *
 * Pi already ships `/new` ("Start a new session"), which internally calls
 * `handleClearCommand`; only the `/clear` spelling is missing. This is a
 * standalone top-level file rather than part of `modal-editor/` because it is a
 * session command with no dependency on modal editing — and Pi loads every
 * top-level file in `extensions/` as its own extension.
 *
 * Registration works here (unlike `/hotkeys`, which `modal-editor` has to
 * intercept in the editor) because no built-in command claims the name.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function clearCommand(pi: ExtensionAPI): void {
  pi.registerCommand("clear", {
    description: "Start a new session (alias for /new)",
    handler: async (_args, ctx) => {
      // `newSession` reports cancellation rather than throwing — e.g. when a
      // `session_before_switch` handler vetoes the switch.
      const { cancelled } = await ctx.newSession();
      if (cancelled) return;
      ctx.ui.notify("New session started");
    },
  });
}
