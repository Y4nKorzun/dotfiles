const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const test = require("node:test");

const configRoot = join(__dirname, "..");
const globalRoot = execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim();
const piAgentRoot = join(globalRoot, "@earendil-works", "pi-coding-agent");
const piPeerRoot = join(piAgentRoot, "node_modules");
const createJiti = require(join(piPeerRoot, "jiti", "lib", "jiti.cjs"));
const jiti = createJiti(__filename, {
  alias: {
    "@earendil-works/pi-coding-agent": join(piAgentRoot, "dist", "index.js"),
    "@earendil-works/pi-tui": join(piPeerRoot, "@earendil-works", "pi-tui", "dist", "index.js"),
  },
});
const extensionDir = join(configRoot, "extensions", "output-styles");
const { findStyle, isDisableKeyword, parseOutputStyle, renderStylePrompt } = jiti(join(extensionDir, "styles.ts"));
const { loadOutputStyles, readSelection, writeSelection } = jiti(join(extensionDir, "store.ts"));
const { registerOutputStyles } = jiti(join(extensionDir, "index.ts"));

const ELI5 = ["---", "name: ELI5", 'description: "keep it simple pls"', "keep-coding-instructions: true", "---", "", "Small words."].join(
  "\n",
);

function withStylesDir(t, files) {
  const dir = mkdtempSync(join(tmpdir(), "pi-output-styles-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content, "utf8");
  return { stylesDir: dir, selectionPath: join(dir, "selected.json") };
}

/** Registers the extension against fakes, exposing what it wired up. */
function registerWith(paths) {
  const commands = new Map();
  const handlers = new Map();
  registerOutputStyles(
    {
      registerCommand: (name, command) => commands.set(name, command),
      on: (event, handler) => handlers.set(event, handler),
    },
    paths,
  );
  return { command: commands.get("style"), onBeforeAgentStart: handlers.get("before_agent_start") };
}

function fakeContext(selection) {
  const calls = { notices: [], selectOptions: null };
  return {
    calls,
    ctx: {
      ui: {
        notify: (message, type) => calls.notices.push([message, type]),
        select: async (_title, options) => {
          calls.selectOptions = options;
          return typeof selection === "function" ? selection(options) : selection;
        },
      },
    },
  };
}

test("parseOutputStyle reads frontmatter and body", () => {
  const style = parseOutputStyle(ELI5, "fallback");

  assert.equal(style.name, "ELI5");
  assert.equal(style.description, "keep it simple pls");
  assert.equal(style.keepCodingInstructions, true);
  assert.equal(style.instructions, "Small words.");
});

test("parseOutputStyle falls back to the filename and honours keep-coding-instructions: false", () => {
  const style = parseOutputStyle("---\nkeep-coding-instructions: false\n---\nBe terse.\n", "terse");

  assert.equal(style.name, "terse");
  assert.equal(style.description, "");
  assert.equal(style.keepCodingInstructions, false);
  assert.equal(style.instructions, "Be terse.");
});

test("parseOutputStyle treats a file without frontmatter as pure instructions", () => {
  const style = parseOutputStyle("Just talk plainly.\n", "plain");

  assert.equal(style.name, "plain");
  assert.equal(style.keepCodingInstructions, true);
  assert.equal(style.instructions, "Just talk plainly.");
});

test("renderStylePrompt states precedence according to keep-coding-instructions", () => {
  const kept = renderStylePrompt(parseOutputStyle(ELI5, "ELI5"));
  const overriding = renderStylePrompt(parseOutputStyle("---\nkeep-coding-instructions: false\n---\nBe terse.", "terse"));

  assert.match(kept, /^# Output Style: ELI5/);
  assert.match(kept, /Small words\.$/);
  assert.match(kept, /not how carefully you work/);
  assert.match(overriding, /the output style wins/);
});

test("findStyle matches case-insensitively, isDisableKeyword covers the off words", () => {
  const styles = [parseOutputStyle(ELI5, "ELI5")];

  assert.equal(findStyle(styles, "eli5").name, "ELI5");
  assert.equal(findStyle(styles, "nope"), undefined);
  assert.equal(isDisableKeyword(" OFF "), true);
  assert.equal(isDisableKeyword("none"), true);
  assert.equal(isDisableKeyword("ELI5"), false);
});

test("loadOutputStyles reads *.md only, sorted, with paths", (t) => {
  const paths = withStylesDir(t, { "ELI5.md": ELI5, "brief.md": "Be brief.", "notes.txt": "ignored" });

  const styles = loadOutputStyles(paths.stylesDir);

  assert.deepEqual(
    styles.map((style) => style.name),
    ["brief", "ELI5"],
  );
  assert.equal(styles[1].path, join(paths.stylesDir, "ELI5.md"));
});

test("loadOutputStyles returns nothing for a missing directory", () => {
  assert.deepEqual(loadOutputStyles(join(tmpdir(), "pi-output-styles-does-not-exist")), []);
});

test("selection round-trips and degrades to null", (t) => {
  const paths = withStylesDir(t, {});

  assert.equal(readSelection(paths.selectionPath), null);
  writeSelection(paths.selectionPath, "ELI5");
  assert.equal(readSelection(paths.selectionPath), "ELI5");
  writeSelection(paths.selectionPath, null);
  assert.equal(readSelection(paths.selectionPath), null);
  writeFileSync(paths.selectionPath, "{ not json", "utf8");
  assert.equal(readSelection(paths.selectionPath), null);
});

test("/style <name> persists the choice and appends the style to the system prompt", async (t) => {
  const paths = withStylesDir(t, { "ELI5.md": ELI5 });
  const { command, onBeforeAgentStart } = registerWith(paths);
  const { ctx, calls } = fakeContext(undefined);

  assert.equal(await onBeforeAgentStart({ systemPrompt: "BASE" }), undefined);

  await command.handler("eli5", ctx);

  assert.deepEqual(calls.notices, [["Output style: ELI5", undefined]]);
  assert.equal(readSelection(paths.selectionPath), "ELI5");
  const result = await onBeforeAgentStart({ systemPrompt: "BASE" });
  assert.match(result.systemPrompt, /^BASE\n\n# Output Style: ELI5/);
  assert.match(result.systemPrompt, /Small words\./);
});

test("a persisted selection is active from registration", async (t) => {
  const paths = withStylesDir(t, { "ELI5.md": ELI5 });
  writeSelection(paths.selectionPath, "ELI5");

  const { onBeforeAgentStart } = registerWith(paths);

  assert.match((await onBeforeAgentStart({ systemPrompt: "BASE" })).systemPrompt, /# Output Style: ELI5/);
});

test("/style off clears the style", async (t) => {
  const paths = withStylesDir(t, { "ELI5.md": ELI5 });
  writeSelection(paths.selectionPath, "ELI5");
  const { command, onBeforeAgentStart } = registerWith(paths);
  const { ctx, calls } = fakeContext(undefined);

  await command.handler("off", ctx);

  assert.deepEqual(calls.notices, [["Output style off", undefined]]);
  assert.equal(readSelection(paths.selectionPath), null);
  assert.equal(await onBeforeAgentStart({ systemPrompt: "BASE" }), undefined);
});

test("/style with an unknown name reports an error and keeps the current style", async (t) => {
  const paths = withStylesDir(t, { "ELI5.md": ELI5 });
  writeSelection(paths.selectionPath, "ELI5");
  const { command } = registerWith(paths);
  const { ctx, calls } = fakeContext(undefined);

  await command.handler("nope", ctx);

  assert.deepEqual(calls.notices, [["Unknown output style: nope", "error"]]);
  assert.equal(readSelection(paths.selectionPath), "ELI5");
});

test("bare /style opens a picker that marks the active style", async (t) => {
  const paths = withStylesDir(t, { "ELI5.md": ELI5, "brief.md": "Be brief." });
  writeSelection(paths.selectionPath, "ELI5");
  const { command } = registerWith(paths);
  const { ctx, calls } = fakeContext((options) => options.find((option) => option.includes("brief")));

  await command.handler("  ", ctx);

  assert.deepEqual(calls.selectOptions, ["  brief", "● ELI5 — keep it simple pls", "off (Pi default)"]);
  assert.equal(readSelection(paths.selectionPath), "brief");
});

test("cancelling the picker changes nothing", async (t) => {
  const paths = withStylesDir(t, { "ELI5.md": ELI5 });
  writeSelection(paths.selectionPath, "ELI5");
  const { command } = registerWith(paths);
  const { ctx, calls } = fakeContext(undefined);

  await command.handler("", ctx);

  assert.deepEqual(calls.notices, []);
  assert.equal(readSelection(paths.selectionPath), "ELI5");
});

test("the picker's off row disables the style", async (t) => {
  const paths = withStylesDir(t, { "ELI5.md": ELI5 });
  writeSelection(paths.selectionPath, "ELI5");
  const { command } = registerWith(paths);
  const { ctx } = fakeContext("off (Pi default)");

  await command.handler("", ctx);

  assert.equal(readSelection(paths.selectionPath), null);
});

test("argument completions offer style names and off", (t) => {
  const paths = withStylesDir(t, { "ELI5.md": ELI5 });
  const { command } = registerWith(paths);

  assert.deepEqual(
    command.getArgumentCompletions("").map((item) => item.value),
    ["ELI5", "off"],
  );
  assert.deepEqual(
    command.getArgumentCompletions("of").map((item) => item.value),
    ["off"],
  );
  assert.equal(command.getArgumentCompletions("zzz"), null);
});
