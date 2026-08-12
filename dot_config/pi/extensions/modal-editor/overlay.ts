import type { ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { type Component, type Focusable, matchesKey, type TUI } from "@earendil-works/pi-tui";
import { createBoxRenderer } from "./box";
import type { ShortcutGroup } from "./shortcuts";

/** Cheatsheet rows visible at once, before scrolling. */
const VISIBLE_ROWS = 12;

/** Rows spent on the box itself: two borders, the title and the hint line. */
const CHROME_ROWS = 4;

/** Derived so the overlay box can never be shorter than what `render` emits. */
export const OVERLAY_MAX_HEIGHT = VISIBLE_ROWS + CHROME_ROWS;

const KEYS_COLUMN_WIDTH = 18;

/**
 * A flattened cheatsheet line.
 *
 * A discriminated union rather than one optional-field shape: it makes the two
 * kinds of line structurally distinct, so a group titled with an empty string
 * cannot be mistaken for a binding at render time.
 */
type OverlayRow =
  | { readonly kind: "heading"; readonly text: string }
  | { readonly kind: "binding"; readonly keys: string; readonly description: string };

function flattenGroups(groups: readonly ShortcutGroup[]): readonly OverlayRow[] {
  return groups.flatMap((group): OverlayRow[] => [
    { kind: "heading", text: group.title },
    ...group.rows.map(
      ([keys, description]): OverlayRow => ({ kind: "binding", keys, description }),
    ),
  ]);
}

type ShortcutOverlayOptions = {
  readonly title: string;
  readonly width: number;
  readonly groups: readonly ShortcutGroup[];
};

/** A scrollable, bordered cheatsheet. Closes on Esc, `q` or Enter. */
class ShortcutOverlay implements Component, Focusable {
  focused = false;
  private offset = 0;
  private readonly rows: readonly OverlayRow[];
  private readonly title: string;
  private readonly width: number;

  constructor(
    private readonly tui: TUI,
    private readonly theme: Theme,
    private readonly done: () => void,
    options: ShortcutOverlayOptions,
  ) {
    this.title = options.title;
    this.width = options.width;
    this.rows = flattenGroups(options.groups);
  }

  private get maxOffset(): number {
    return Math.max(0, this.rows.length - VISIBLE_ROWS);
  }

  handleInput(data: string): void {
    if (matchesKey(data, "escape") || matchesKey(data, "return") || data === "q") {
      this.done();
      return;
    }

    if (data === "j" || matchesKey(data, "down")) {
      this.offset = Math.min(this.maxOffset, this.offset + 1);
    } else if (data === "k" || matchesKey(data, "up")) {
      this.offset = Math.max(0, this.offset - 1);
    } else {
      return;
    }
    this.tui.requestRender();
  }

  render(width: number): string[] {
    const box = createBoxRenderer(this.theme, Math.max(2, Math.min(this.width, width)));
    const lines = [box.top(), box.row(this.theme.fg("accent", this.title))];

    for (const item of this.rows.slice(this.offset, this.offset + VISIBLE_ROWS)) {
      lines.push(
        item.kind === "heading"
          ? box.row(this.theme.fg("dim", item.text))
          : box.row(`${item.keys.padEnd(KEYS_COLUMN_WIDTH)}${item.description}`),
      );
    }

    const hint =
      this.rows.length > VISIBLE_ROWS
        ? "↑/↓ or j/k  scroll · Esc/q/Enter  close"
        : "Esc / q / Enter  close";
    lines.push(box.row(this.theme.fg("dim", hint)));
    lines.push(box.bottom());
    return lines;
  }

  invalidate(): void {}
}

/** Presents a cheatsheet as a centered overlay and resolves once it closes. */
export async function showShortcuts(
  ctx: Pick<ExtensionContext, "ui">,
  options: ShortcutOverlayOptions,
): Promise<void> {
  await ctx.ui.custom<void>(
    (tui, theme, _keybindings, done) => new ShortcutOverlay(tui, theme, done, options),
    {
      overlay: true,
      overlayOptions: {
        anchor: "center",
        width: options.width,
        maxHeight: OVERLAY_MAX_HEIGHT,
      },
    },
  );
}
