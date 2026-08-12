/**
 * Pure cursor-motion arithmetic.
 *
 * These functions know nothing about Pi, the TUI, or terminal sequences: they
 * map (line text, column) to a target column. Keeping them free of the editor
 * makes the fiddliest part of the extension — Neovim's word boundaries —
 * inspectable and testable on plain strings.
 */

/** A word character: letters, digits and underscore, per Neovim's `iskeyword`. */
const WORD = "\\p{L}\\p{N}_";

/**
 * One Neovim "chunk": a run of word characters, a run of punctuation, or a run
 * of whitespace. `w` advances chunk by chunk.
 */
const LEADING_CHUNK = new RegExp(`^([${WORD}]+|[^\\s${WORD}]+|\\s+)`, "u");
const LEADING_SPACE = /^\s+/u;

/**
 * Target column for `w` (move to the start of the next word).
 *
 * Skips the chunk under the cursor, then the whitespace that follows it — so
 * the cursor lands on the first character of the next word rather than on the
 * gap before it. When the cursor already sits in whitespace, the whitespace run
 * itself is the chunk and no extra skip applies.
 *
 * Returns `col` unchanged when there is nothing left on the line, which the
 * caller treats as "wrap to the next line".
 */
export function wordForwardTarget(text: string, col: number): number {
  const rest = text.slice(col);
  const chunk = LEADING_CHUNK.exec(rest)?.[0] ?? "";
  const trailingSpace = LEADING_SPACE.exec(rest.slice(chunk.length))?.[0] ?? "";
  const skipTrailingSpace = LEADING_SPACE.test(chunk) ? 0 : trailingSpace.length;
  return col + chunk.length + skipTrailingSpace;
}

/**
 * True when the cursor sits on the last character of a word.
 *
 * `e` moves to the end of the current word, so a cursor that is already there
 * must step forward first to avoid standing still.
 */
export function isAtWordEnd(text: string, col: number): boolean {
  const onNonSpace = /\S/u.test(text[col] ?? "");
  const nextIsNonSpace = /\S/u.test(text[col + 1] ?? "");
  return onNonSpace && !nextIsNonSpace;
}
