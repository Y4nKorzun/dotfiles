/**
 * The filesystem side of output styles: the `*.md` files themselves and the
 * pointer to the active one. Split from `styles.ts` so parsing and prompt shape
 * stay testable without touching disk.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { type OutputStyle, parseOutputStyle } from "./styles";

const STYLE_EXTENSION = ".md";

export interface LoadedOutputStyle extends OutputStyle {
  /** Absolute path of the file this style came from. */
  readonly path: string;
}

/** Persisted shape of the selection file; `null` means "no style". */
interface SelectionFile {
  style: string | null;
}

export function loadOutputStyles(dir: string): LoadedOutputStyle[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch (error) {
    // A missing directory just means "no styles yet"; anything else is a bug.
    if ((error as { code?: string }).code !== "ENOENT") throw error;
    return [];
  }
  return entries
    .filter((entry) => extname(entry).toLowerCase() === STYLE_EXTENSION)
    .map((entry) => {
      const path = join(dir, entry);
      return { ...parseOutputStyle(readFileSync(path, "utf8"), basename(entry, extname(entry))), path };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function readSelection(path: string): string | null {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<SelectionFile> | null;
    const style = parsed?.style;
    return typeof style === "string" && style.length > 0 ? style : null;
  } catch {
    // A missing or hand-mangled pointer must never break startup.
    return null;
  }
}

export function writeSelection(path: string, style: string | null): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify({ style } satisfies SelectionFile, null, 2)}\n`, "utf8");
}
