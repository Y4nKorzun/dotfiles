/**
 * Output styles as data: frontmatter parsing, lookup, and prompt rendering.
 *
 * The file format mirrors Claude Code's `output-styles/*.md` — `name`,
 * `description`, `keep-coding-instructions` frontmatter over a Markdown body —
 * so a style file can be copied between the two agents unchanged.
 *
 * One semantic difference is unavoidable: Claude Code *replaces* its default
 * coding instructions with the style, while a Pi extension can only *append* to
 * the system prompt from `before_agent_start` (`buildSystemPrompt` is not part
 * of Pi's public API). `keep-coding-instructions: false` therefore renders a
 * precedence note instead of a true replacement; for a real replacement use
 * `SYSTEM.md`.
 *
 * Everything here is pure — the filesystem lives in `store.ts`.
 */

/** A style file after parsing. */
export interface OutputStyle {
  /** `name:` from frontmatter, otherwise the filename without extension. */
  readonly name: string;
  /** Shown in the `/style` picker and in argument autocomplete. */
  readonly description: string;
  /** `false` marks a style that overrides Pi's default response guidance. */
  readonly keepCodingInstructions: boolean;
  /** The Markdown body below the frontmatter. */
  readonly instructions: string;
}

/** Leading `---` block, tolerating CRLF and trailing spaces on the fences. */
const FRONTMATTER_PATTERN = /^---[^\S\r\n]*\r?\n([\s\S]*?)\r?\n---[^\S\r\n]*(?:\r?\n|$)/;
const QUOTED_VALUE_PATTERN = /^(['"])([\s\S]*)\1$/;

/** Words that clear the active style, for `/style off` and the picker. */
const DISABLE_KEYWORDS: readonly string[] = ["off", "none", "default"];

export function isDisableKeyword(value: string): boolean {
  return DISABLE_KEYWORDS.includes(value.trim().toLowerCase());
}

/** The canonical spelling written back when a style is cleared. */
export const DISABLE_KEYWORD = DISABLE_KEYWORDS[0];

/**
 * Flat `key: value` frontmatter only. Styles are prose with a handful of
 * scalars, so a YAML dependency would buy nothing.
 */
function parseFrontmatter(block: string): Map<string, string> {
  const fields = new Map<string, string>();
  for (const line of block.split(/\r?\n/)) {
    if (line.trimStart().startsWith("#")) continue;
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    if (!key) continue;
    fields.set(key, line.slice(separator + 1).trim().replace(QUOTED_VALUE_PATTERN, "$2"));
  }
  return fields;
}

export function parseOutputStyle(source: string, fallbackName: string): OutputStyle {
  const match = FRONTMATTER_PATTERN.exec(source);
  const fields = match ? parseFrontmatter(match[1]) : new Map<string, string>();
  return {
    name: fields.get("name") || fallbackName,
    description: fields.get("description") ?? "",
    // Absent means "keep": dropping Pi's guidelines is the exceptional case.
    keepCodingInstructions: (fields.get("keep-coding-instructions") ?? "true").toLowerCase() !== "false",
    instructions: (match ? source.slice(match[0].length) : source).trim(),
  };
}

export function findStyle<T extends OutputStyle>(styles: readonly T[], name: string): T | undefined {
  const wanted = name.trim().toLowerCase();
  return styles.find((style) => style.name.toLowerCase() === wanted);
}

/** The block appended to the system prompt while a style is active. */
export function renderStylePrompt(style: OutputStyle): string {
  const precedence = style.keepCodingInstructions
    ? "It governs how you talk to the user, not how carefully you work or which tools you use."
    : "Where it conflicts with the default response guidelines, the output style wins.";
  return [`# Output Style: ${style.name}`, `Respond according to the output style below. ${precedence}`, style.instructions].join(
    "\n\n",
  );
}
