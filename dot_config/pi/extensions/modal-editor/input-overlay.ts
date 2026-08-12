import type { ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { type Component, type Focusable, Input, type TUI } from "@earendil-works/pi-tui";
import { createBoxRenderer } from "./box";
import { Key } from "./keys";

/** border(2) + title(1) + input(1) + hint(1) */
export const INPUT_OVERLAY_HEIGHT = 5;

const HINT = "Enter  save · Esc  cancel";

export type InputPromptOptions = {
  readonly title: string;
  /** Pre-filled and fully editable, unlike a placeholder. */
  readonly initialValue?: string;
  readonly width: number;
};

/**
 * A small titled modal wrapping pi-tui's single-line `Input`.
 *
 * `Input` already implements the editing surface (cursor, kill-ring, undo,
 * paste) and reports Enter/Esc through callbacks, so this component only draws
 * the frame and routes focus.
 */
class InputOverlay implements Component, Focusable {
  private isFocused = false;
  private readonly input = new Input();

  constructor(
    private readonly theme: Theme,
    done: (value: string | undefined) => void,
    private readonly options: InputPromptOptions,
  ) {
    this.input.setValue(options.initialValue ?? "");
    // `setValue` leaves the cursor at column 0, which would make a rename
    // prepend rather than append. Driving the editor with the key sequence is
    // the only public way to move it; if that action is rebound the cursor
    // merely starts at 0, whereas re-typing the value could drop it entirely.
    this.input.handleInput(Key.lineEnd);
    this.input.onSubmit = (value) => done(value);
    this.input.onEscape = () => done(undefined);
  }

  get focused(): boolean {
    return this.isFocused;
  }

  set focused(value: boolean) {
    this.isFocused = value;
    // The child draws the cursor, so focus has to reach it.
    this.input.focused = value;
  }

  handleInput(data: string): void {
    this.input.handleInput(data);
  }

  render(width: number): string[] {
    const box = createBoxRenderer(this.theme, Math.max(2, Math.min(this.options.width, width)));
    const [inputLine = ""] = this.input.render(box.innerWidth - 1);

    return [
      box.top(),
      box.row(this.theme.fg("accent", this.options.title)),
      box.row(inputLine),
      box.row(this.theme.fg("dim", HINT)),
      box.bottom(),
    ];
  }

  invalidate(): void {
    this.input.invalidate();
  }
}

/**
 * Shows a centered single-line prompt.
 *
 * Resolves to the submitted text, or `undefined` when the user cancels — Pi's
 * built-in `ui.input` only takes a placeholder, so a prompt that starts from an
 * existing value has to be built here.
 */
export async function showInputPrompt(
  ctx: Pick<ExtensionContext, "ui">,
  options: InputPromptOptions,
): Promise<string | undefined> {
  return ctx.ui.custom<string | undefined>(
    (_tui: TUI, theme, _keybindings, done) => new InputOverlay(theme, done, options),
    {
      overlay: true,
      overlayOptions: {
        anchor: "center",
        width: options.width,
        maxHeight: INPUT_OVERLAY_HEIGHT,
      },
    },
  );
}
