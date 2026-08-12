import { InteractiveMode } from "@earendil-works/pi-coding-agent";
import {
  type Component,
  type Focusable,
  matchesKey,
  type OverlayHandle,
  truncateToWidth,
  type TUI,
  visibleWidth,
} from "@earendil-works/pi-tui";
import { isPrintableChar, Key } from "./keys";

type SelectorMode = "normal" | "search";

/**
 * A focus target handed to us by Pi.
 *
 * `Component.handleInput` is optional, but a selector's focus target always
 * consumes input — `Required` makes that contract explicit instead of forcing
 * non-null assertions at every call site.
 */
type SelectorFocus = Focusable & Required<Pick<Component, "handleInput">>;

type SelectorFactory = (done: () => void) => {
  component: Component;
  focus: SelectorFocus;
  dispose?: () => void;
};

/**
 * The subset of `InteractiveMode` the patched method relies on.
 *
 * `showSelector` is private in Pi's public types, so this shape is duplicated
 * here deliberately; `installModalSelectorPatch` fails loudly if it drifts.
 */
type SelectorHost = {
  ui: TUI;
  editor: Component & Focusable & { reloadPi?(): void };
  activeSelectorToken: object | undefined;
  activeSelectorDispose: (() => void) | undefined;
  disposeActiveSelector(): void;
};

type SelectorMethod = (this: SelectorHost, create: SelectorFactory) => void;

const OVERLAY_OPTIONS = {
  anchor: "center",
  width: "80%",
  maxHeight: "80%",
  margin: 2,
} as const;

/** Fraction of the terminal the modal may occupy, and rows reserved for chrome. */
const MAX_HEIGHT_RATIO = 0.8;
const RESERVED_ROWS = 4;

const STATUS_TEXT: Readonly<Record<SelectorMode, string>> = {
  normal: " NORMAL · i or / search ",
  search: " SEARCH · Esc normal ",
};

/**
 * Neovim navigation mapped onto the sequences Pi's selectors understand.
 *
 * A `Map` rather than an object literal: a pasted `"constructor"` would resolve
 * through `Object.prototype` and be forwarded as a function.
 */
const NAVIGATION: ReadonlyMap<string, string> = new Map([
  ["h", Key.altLeft],
  ["j", Key.down],
  ["k", Key.up],
  ["l", Key.altRight],
]);

/**
 * Wraps one of Pi's selectors so it behaves modally.
 *
 * Normal mode maps `hjkl` onto the selector's own navigation and swallows the
 * remaining printable keys; search mode forwards everything so the selector's
 * filter input works unchanged.
 */
class ModalSelector implements Component, Focusable {
  private isFocused = false;
  private mode: SelectorMode = "normal";

  constructor(
    private readonly tui: TUI,
    private readonly component: Component,
    private readonly focus: SelectorFocus,
    private readonly reloadPi?: () => void,
  ) {}

  get focused(): boolean {
    return this.isFocused;
  }

  set focused(value: boolean) {
    this.isFocused = value;
    this.focus.focused = value;
  }

  handleInput(data: string): void {
    if (this.reloadPi && matchesKey(data, "shift+ctrl+r")) {
      this.reloadPi();
      return;
    }

    if (this.mode === "search") {
      if (matchesKey(data, "escape")) {
        this.setMode("normal");
        return;
      }
      this.focus.handleInput(data);
      return;
    }

    if (data === "i" || data === "/") {
      this.setMode("search");
      return;
    }

    const navigation = NAVIGATION.get(data);
    if (navigation) {
      this.focus.handleInput(navigation);
      return;
    }

    if (matchesKey(data, "ctrl+d")) {
      this.focus.handleInput(Key.pageDown);
      return;
    }

    if (matchesKey(data, "ctrl+u")) {
      this.focus.handleInput(Key.pageUp);
      return;
    }

    // Unmapped printable keys are swallowed; Esc and friends reach the selector.
    if (isPrintableChar(data)) return;
    this.focus.handleInput(data);
  }

  private setMode(mode: SelectorMode): void {
    this.mode = mode;
    this.tui.requestRender();
  }

  render(width: number): string[] {
    const maxHeight = Math.max(
      1,
      Math.min(
        Math.floor(this.tui.terminal.rows * MAX_HEIGHT_RATIO),
        this.tui.terminal.rows - RESERVED_ROWS,
      ),
    );
    const indicator = STATUS_TEXT[this.mode];
    const padding = " ".repeat(Math.max(0, width - visibleWidth(indicator)));

    return [
      ...this.component.render(width).slice(0, Math.max(0, maxHeight - 1)),
      truncateToWidth(`${padding}${indicator}`, width, ""),
    ];
  }

  invalidate(): void {
    this.component.invalidate();
  }
}

/**
 * Replacement for `InteractiveMode.showSelector`.
 *
 * Pi swaps the editor out for the selector in place; this shows it as a
 * centered overlay instead, leaving the prompt visible underneath.
 */
function showModalSelector(this: SelectorHost, create: SelectorFactory): void {
  const token = {};
  let dispose: (() => void) | undefined;
  let handle: OverlayHandle | undefined;
  let closed = false;

  const close = (restoreFocus: boolean) => {
    if (closed) return;
    closed = true;
    dispose?.();
    handle?.hide();
    // A newer selector may already own the host; leave its state alone.
    if (this.activeSelectorToken !== token) return;
    this.activeSelectorToken = undefined;
    this.activeSelectorDispose = undefined;
    if (restoreFocus) this.ui.setFocus(this.editor);
    this.ui.requestRender();
  };

  const created = create(() => close(true));
  dispose = created.dispose;
  // The factory may complete synchronously (e.g. a single-option selector).
  if (closed) {
    dispose?.();
    return;
  }

  this.disposeActiveSelector();
  this.activeSelectorToken = token;
  this.activeSelectorDispose = () => close(false);

  try {
    handle = this.ui.showOverlay(
      new ModalSelector(
        this.ui,
        created.component,
        created.focus,
        this.editor.reloadPi?.bind(this.editor),
      ),
      OVERLAY_OPTIONS,
    );
  } catch (error) {
    close(true);
    throw error;
  }
}

/**
 * Holds the active behavior behind a stable wrapper.
 *
 * Reloading the extension re-runs the installer; swapping `behavior` keeps a
 * single wrapper on the prototype instead of stacking one per reload.
 */
type SelectorPatch = {
  behavior: SelectorMethod;
  readonly wrapper: SelectorMethod;
};

const MODAL_SELECTOR_PATCH = Symbol.for("pi.modal-selectors.patch");

type PatchedPrototype = {
  showSelector: SelectorMethod;
  [MODAL_SELECTOR_PATCH]?: SelectorPatch;
};

function createSelectorPatch(behavior: SelectorMethod): SelectorPatch {
  const patch: SelectorPatch = {
    behavior,
    wrapper: function modalSelectorWrapper(this: SelectorHost, create: SelectorFactory): void {
      patch.behavior.call(this, create);
    },
  };
  return patch;
}

/** Idempotently routes Pi's built-in selectors through the modal overlay. */
export function installModalSelectorPatch(): void {
  const prototype = InteractiveMode.prototype as unknown as PatchedPrototype;

  const existing = prototype[MODAL_SELECTOR_PATCH];
  if (existing) {
    existing.behavior = showModalSelector;
    return;
  }

  if (typeof prototype.showSelector !== "function") {
    throw new TypeError("Pi no longer exposes its selector host");
  }

  const patch = createSelectorPatch(showModalSelector);
  Object.defineProperty(prototype, "showSelector", {
    ...Object.getOwnPropertyDescriptor(prototype, "showSelector"),
    value: patch.wrapper,
  });
  Object.defineProperty(prototype, MODAL_SELECTOR_PATCH, {
    value: patch,
    configurable: true,
  });
}
