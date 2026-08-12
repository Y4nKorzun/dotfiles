import { CustomEditor, type KeybindingsManager } from "@earendil-works/pi-coding-agent";
import {
  type EditorTheme,
  matchesKey,
  type TUI,
  truncateToWidth,
  visibleWidth,
} from "@earendil-works/pi-tui";
import { isPrintableChar, Key } from "./keys";
import { isAtWordEnd, wordForwardTarget } from "./motions";

export type EditorMode = "normal" | "insert";

/** Keys that only act when pressed twice (`gg`, `dd`). */
type PendingOperator = "d" | "g";

/** A single-keystroke normal-mode command. */
type NormalCommand = () => void;

const MODE_LABEL: Readonly<Record<EditorMode, string>> = {
  normal: " NORMAL ",
  insert: " INSERT ",
};

/**
 * Pi's fullscreen transcript can be scrolled; the inline TUI cannot. The
 * scrolling methods are therefore probed at runtime rather than assumed.
 */
type ScrollableTui = TUI & {
  scrollBy(lines: number): void;
  scrollToTop(): void;
  scrollToBottom(): void;
};

/**
 * A Neovim-style modal editor for Pi's prompt.
 *
 * Insert mode delegates wholesale to Pi's editor. Normal mode intercepts input
 * and re-emits the terminal sequence that produces the equivalent edit, so the
 * underlying editor keeps ownership of the buffer, undo history and rendering.
 */
export class ModalEditor extends CustomEditor {
  private mode: EditorMode = "insert";
  private pendingOperator: PendingOperator | undefined;

  /**
   * Supplied by the extension host; see `index.ts`.
   *
   * The editor only signals intent — it owns no session state and draws no
   * modals, so both hooks stay unset in isolation (and their keys unclaimed).
   */
  onRenameSession?: () => void;
  onHotkeys?: () => void;

  /**
   * `CustomEditor` keeps its keybindings private, so the subclass holds its own
   * reference to resolve user-configured actions such as `tui.input.submit`.
   */
  constructor(
    tui: TUI,
    theme: EditorTheme,
    private readonly modalKeybindings: KeybindingsManager,
  ) {
    super(tui, theme, modalKeybindings);
  }

  /**
   * Every normal-mode command reachable with one keystroke.
   *
   * `g` and `d` are absent: they are operator-pending prefixes handled before
   * this table is consulted.
   *
   * A `Map` rather than a plain object: keystrokes are arbitrary strings, and a
   * pasted `"toString"` would otherwise resolve through `Object.prototype` to a
   * function and be dispatched as if it were a command.
   */
  private readonly normalCommands: ReadonlyMap<string, NormalCommand> = new Map<
    string,
    NormalCommand
  >(
    Object.entries({
      // Motions
      h: () => this.forward(Key.left),
      l: () => this.forward(Key.right),
      b: () => this.forward(Key.wordLeft),
      w: () => this.moveWordForward(),
      e: () => this.moveWordEnd(),
      "0": () => this.forward(Key.lineStart),
      $: () => this.forward(Key.lineEnd),

      // Transcript navigation, falling back to cursor movement when the
      // transcript cannot scroll.
      j: () => {
        if (!this.scrollBy(1)) this.forward(Key.down);
      },
      k: () => {
        if (!this.scrollBy(-1)) this.forward(Key.up);
      },
      G: () => void this.scrollTo("bottom"),

      // Edits
      x: () => this.forward(Key.deleteForward),
      D: () => this.forward(Key.killToLineEnd),
      u: () => this.forward(Key.undo),

      // Entering insert mode
      i: () => this.enterInsert(),
      a: () => {
        this.forward(Key.right);
        this.enterInsert();
      },
      I: () => {
        this.forward(Key.lineStart);
        this.enterInsert();
      },
      A: () => {
        this.forward(Key.lineEnd);
        this.enterInsert();
      },
      C: () => {
        this.forward(Key.killToLineEnd);
        this.enterInsert();
      },
      o: () => {
        this.forward(Key.lineEnd);
        this.insertTextAtCursor("\n");
        this.enterInsert();
      },
      O: () => {
        this.forward(Key.lineStart);
        this.insertTextAtCursor("\n");
        this.forward(Key.up);
        this.enterInsert();
      },
    } satisfies Record<string, NormalCommand>),
  );

  // ── Input dispatch ──────────────────────────────────────────────────────

  handleInput(data: string): void {
    if (this.handleGlobalShortcut(data)) return;

    if (matchesKey(data, "escape")) {
      this.pendingOperator = undefined;
      // A second Esc in normal mode falls through to Pi, which interrupts.
      if (this.mode === "insert") this.mode = "normal";
      else this.forward(data);
      return;
    }

    if (this.mode === "insert") {
      this.forward(data);
      return;
    }

    this.handleNormalMode(data);
  }

  /** Shortcuts that must work in both modes. Returns true when consumed. */
  private handleGlobalShortcut(data: string): boolean {
    if (matchesKey(data, "shift+ctrl+r")) {
      this.reloadPi();
      return true;
    }

    if (this.onRenameSession && matchesKey(data, "ctrl+r")) {
      this.pendingOperator = undefined;
      this.onRenameSession();
      return true;
    }

    if (
      this.onHotkeys &&
      this.modalKeybindings.matches(data, "tui.input.submit") &&
      this.getText().trim() === "/hotkeys"
    ) {
      this.setText("");
      this.onHotkeys();
      return true;
    }

    return false;
  }

  private handleNormalMode(data: string): void {
    if (matchesKey(data, "ctrl+d")) {
      this.pendingOperator = undefined;
      this.scrollBy(this.halfPage());
      return;
    }

    if (matchesKey(data, "ctrl+u")) {
      this.pendingOperator = undefined;
      this.scrollBy(-this.halfPage());
      return;
    }

    if (this.handlePendingOperator(data)) return;
    this.pendingOperator = undefined;

    const command = this.normalCommands.get(data);
    if (command) {
      command();
      return;
    }

    // Unmapped printable keys are swallowed so they never reach the buffer;
    // control sequences (arrows, Enter, …) still reach Pi.
    if (isPrintableChar(data)) return;
    this.forward(data);
  }

  /** Handles the doubled-key commands `gg` and `dd`. Returns true when consumed. */
  private handlePendingOperator(data: string): boolean {
    if (data !== "g" && data !== "d") return false;

    if (this.pendingOperator === data) {
      this.pendingOperator = undefined;
      if (data === "g") this.scrollTo("top");
      else this.deleteCurrentLine();
    } else {
      this.pendingOperator = data;
    }
    return true;
  }

  // ── Commands ────────────────────────────────────────────────────────────

  reloadPi(): void {
    this.resetToInsert();
    this.setText("/reload");
    this.forward(Key.submit);
  }

  private enterInsert(): void {
    this.mode = "insert";
  }

  private resetToInsert(): void {
    this.pendingOperator = undefined;
    this.mode = "insert";
  }

  /** Sends a raw sequence to the underlying editor, bypassing modal handling. */
  private forward(sequence: string): void {
    super.handleInput(sequence);
  }

  private moveWordForward(): void {
    const { line, col } = this.getCursor();
    const target = wordForwardTarget(this.getLines()[line] ?? "", col);

    // Nothing left on this line: step across the line break instead.
    if (target === col && line < this.getLines().length - 1) {
      this.forward(Key.right);
      return;
    }

    // Walk one cell at a time so the editor keeps its own column bookkeeping.
    while (this.getCursor().line === line && this.getCursor().col < target) {
      this.forward(Key.right);
    }
  }

  private moveWordEnd(): void {
    const { line, col } = this.getCursor();
    // Already on a word end: move off it so `e` advances to the next word.
    if (isAtWordEnd(this.getLines()[line] ?? "", col)) this.forward(Key.right);

    this.forward(Key.wordRight);
    // Alt+F lands past the word; step back onto its last character.
    if (this.getCursor().col > 0) this.forward(Key.left);
  }

  /** Deletes the cursor line as a single undoable edit. */
  private deleteCurrentLine(): void {
    const { line } = this.getCursor();
    const lines = this.getLines();
    lines.splice(line, 1);
    const targetLine = Math.min(line, Math.max(0, lines.length - 1));

    this.setText(lines.join("\n"));
    while (this.getCursor().line > targetLine) this.forward(Key.up);
    this.forward(Key.lineStart);
  }

  // ── Transcript scrolling ────────────────────────────────────────────────

  private halfPage(): number {
    return Math.max(1, Math.floor(this.tui.terminal.rows / 2));
  }

  /** Returns false when the host TUI has no scrollable transcript. */
  private scrollBy(lines: number): boolean {
    const tui = this.tui as Partial<ScrollableTui>;
    if (typeof tui.scrollBy !== "function") return false;
    tui.scrollBy(lines);
    return true;
  }

  private scrollTo(edge: "top" | "bottom"): boolean {
    const tui = this.tui as Partial<ScrollableTui>;
    const scroll = edge === "top" ? tui.scrollToTop : tui.scrollToBottom;
    if (typeof scroll !== "function") return false;
    scroll.call(this.tui);
    return true;
  }

  // ── Rendering ───────────────────────────────────────────────────────────

  render(width: number): string[] {
    const lines = super.render(width);
    if (lines.length === 0) return lines;

    const label = MODE_LABEL[this.mode];
    const last = lines.length - 1;
    if (visibleWidth(lines[last] ?? "") >= label.length) {
      lines[last] = `${truncateToWidth(lines[last] ?? "", width - label.length, "")}${label}`;
    }
    return lines;
  }
}
