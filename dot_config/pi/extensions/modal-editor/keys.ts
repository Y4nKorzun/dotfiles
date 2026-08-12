/**
 * Terminal input vocabulary shared by the modal editor and the modal selector.
 *
 * Pi's `Editor` consumes raw terminal bytes, so every Neovim command here is
 * expressed as the ANSI/readline sequence the underlying editor already
 * implements. Naming the sequences keeps the command tables readable and turns
 * a mistyped escape code — which otherwise fails silently — into a typo that
 * TypeScript catches.
 */
export const Key = {
  /** Cursor motions (ANSI CSI). */
  left: "\x1b[D",
  right: "\x1b[C",
  up: "\x1b[A",
  down: "\x1b[B",

  /** Readline/emacs bindings implemented by Pi's editor. */
  lineStart: "\x01", // Ctrl+A
  lineEnd: "\x05", // Ctrl+E
  killToLineEnd: "\x0b", // Ctrl+K
  undo: "\x1f", // Ctrl+_
  wordLeft: "\x1bb", // Alt+B
  wordRight: "\x1bf", // Alt+F
  deleteForward: "\x1b[3~", // Delete

  /** Sequences understood by list-like components (selectors, trees). */
  pageDown: "\x1b[6~",
  pageUp: "\x1b[5~",
  altLeft: "\x1b[1;3D",
  altRight: "\x1b[1;3C",

  submit: "\r",
} as const;

export type KeySequence = (typeof Key)[keyof typeof Key];

/**
 * True for a lone printable character.
 *
 * Normal mode swallows these so unmapped letters never leak into the buffer,
 * which is what makes the mode feel modal rather than merely decorated.
 */
export function isPrintableChar(data: string): boolean {
  return data.length === 1 && data.charCodeAt(0) >= 32;
}
