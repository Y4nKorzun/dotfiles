/**
 * `/style` — Claude Code-style output styles for Pi.
 *
 * Styles are Markdown files in `<agent dir>/output-styles/`; the active one is
 * appended to the system prompt on every turn through `before_agent_start` (the
 * hook Pi's own `pirate.ts` example uses), and the choice is persisted next to
 * the styles so it survives restarts.
 *
 * See `styles.ts` for the file format and why this appends rather than replaces.
 */
import { join } from "node:path";
import { type ExtensionAPI, type ExtensionCommandContext, getAgentDir } from "@earendil-works/pi-coding-agent";
import type { AutocompleteItem } from "@earendil-works/pi-tui";
import { DISABLE_KEYWORD, findStyle, isDisableKeyword, renderStylePrompt } from "./styles";
import { type LoadedOutputStyle, loadOutputStyles, readSelection, writeSelection } from "./store";

const STYLES_DIR_NAME = "output-styles";
const SELECTION_FILE_NAME = "selected.json";
const DISABLE_OPTION_LABEL = "off (Pi default)";
/** Keeps picker rows aligned whether or not they carry the active marker. */
const ACTIVE_MARKER = "● ";
const INACTIVE_MARKER = "  ";

export interface OutputStylePaths {
  /** Directory scanned for `*.md` style files. */
  readonly stylesDir: string;
  /** JSON file holding the name of the active style. */
  readonly selectionPath: string;
}

export default function outputStyles(pi: ExtensionAPI): void {
  const stylesDir = join(getAgentDir(), STYLES_DIR_NAME);
  registerOutputStyles(pi, { stylesDir, selectionPath: join(stylesDir, SELECTION_FILE_NAME) });
}

/** Exported separately so tests can point the extension at a temp directory. */
export function registerOutputStyles(pi: ExtensionAPI, paths: OutputStylePaths): void {
  let styles = loadOutputStyles(paths.stylesDir);
  let selectedName = readSelection(paths.selectionPath);

  pi.registerCommand("style", {
    description: "Choose an output style (how the agent talks to you)",
    getArgumentCompletions: (prefix) => completeStyleName(styles, prefix),
    handler: async (args, ctx) => {
      // Re-scan so a style file added since startup shows up without /reload.
      styles = loadOutputStyles(paths.stylesDir);
      const requested = args.trim() || (await pickStyle(ctx, styles, selectedName, paths.stylesDir));
      if (requested === undefined) return;

      if (isDisableKeyword(requested)) {
        selectedName = null;
        writeSelection(paths.selectionPath, null);
        ctx.ui.notify("Output style off");
        return;
      }

      const style = findStyle(styles, requested);
      if (!style) {
        ctx.ui.notify(`Unknown output style: ${requested}`, "error");
        return;
      }
      selectedName = style.name;
      writeSelection(paths.selectionPath, style.name);
      ctx.ui.notify(`Output style: ${style.name}`);
    },
  });

  pi.on("before_agent_start", (event) => {
    // Resolved per turn: the selection may name a style that was since deleted.
    const style = selectedName ? findStyle(styles, selectedName) : undefined;
    if (!style) return undefined;
    return { systemPrompt: `${event.systemPrompt}\n\n${renderStylePrompt(style)}` };
  });
}

/** Returns a style name, the disable keyword, or `undefined` when cancelled. */
async function pickStyle(
  ctx: ExtensionCommandContext,
  styles: readonly LoadedOutputStyle[],
  selectedName: string | null,
  stylesDir: string,
): Promise<string | undefined> {
  if (styles.length === 0) {
    ctx.ui.notify(`No output styles in ${stylesDir}`, "warning");
    return undefined;
  }
  const labels = styles.map(
    (style) =>
      `${style.name === selectedName ? ACTIVE_MARKER : INACTIVE_MARKER}${style.name}` +
      (style.description ? ` — ${style.description}` : ""),
  );
  const choice = await ctx.ui.select("Output style", [...labels, DISABLE_OPTION_LABEL]);
  if (choice === undefined) return undefined;
  const index = labels.indexOf(choice);
  return index === -1 ? DISABLE_KEYWORD : styles[index].name;
}

function completeStyleName(styles: readonly LoadedOutputStyle[], prefix: string): AutocompleteItem[] | null {
  const wanted = prefix.trim().toLowerCase();
  const items: AutocompleteItem[] = [
    ...styles.map((style) => ({ value: style.name, label: style.name, description: style.description || undefined })),
    { value: DISABLE_KEYWORD, label: DISABLE_KEYWORD, description: "Use Pi's default response style" },
  ];
  const matches = items.filter((item) => item.value.toLowerCase().startsWith(wanted));
  return matches.length > 0 ? matches : null;
}
