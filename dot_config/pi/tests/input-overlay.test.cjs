const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { join } = require("node:path");
const test = require("node:test");

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
const { showInputPrompt, INPUT_OVERLAY_HEIGHT } = jiti(
  join(__dirname, "..", "extensions", "modal-editor", "input-overlay.ts"),
);
const { stripTerminalSequences, visibleWidth } = jiti(
  join(piPeerRoot, "@earendil-works", "pi-tui", "dist", "index.js"),
);

const theme = { fg: (_color, text) => text };

/** Drives showInputPrompt without a TUI, exposing the overlay it builds. */
function openPrompt(options) {
  let component;
  let overlayOptions;
  const ctx = {
    ui: {
      async custom(factory, opts) {
        overlayOptions = opts;
        return new Promise((resolve) => {
          component = factory({ requestRender() {} }, theme, {}, resolve);
        });
      },
    },
  };
  const result = showInputPrompt(ctx, options);
  return { result, get component() { return component; }, get overlayOptions() { return overlayOptions; } };
}

test("renders a titled box that fits the declared overlay height", async () => {
  const prompt = openPrompt({ title: "RENAME SESSION", initialValue: "old-name", width: 52 });
  const lines = prompt.component.render(52);

  assert.equal(prompt.overlayOptions.overlay, true);
  assert.equal(prompt.overlayOptions.overlayOptions.anchor, "center");
  assert.equal(prompt.overlayOptions.overlayOptions.width, 52);
  assert.equal(prompt.overlayOptions.overlayOptions.maxHeight, INPUT_OVERLAY_HEIGHT);

  assert.equal(lines.length, INPUT_OVERLAY_HEIGHT);
  // The cursor is drawn with inverse-video escapes mid-value, so compare the
  // text only.
  const rendered = stripTerminalSequences(lines.join("\n"));
  assert.match(rendered, /RENAME SESSION/);
  assert.match(rendered, /old-name/);
  assert.match(rendered, /Enter {2}save · Esc {2}cancel/);

  prompt.component.handleInput("\x1b");
  await prompt.result;
});

test("pre-fills an editable value with the cursor at the end", async () => {
  const prompt = openPrompt({ title: "RENAME SESSION", initialValue: "old", width: 52 });

  // Typing must append, not prepend — the whole point of a rename prompt.
  prompt.component.handleInput("-name");
  prompt.component.handleInput("\r");

  assert.equal(await prompt.result, "old-name");
});

test("resolves undefined when cancelled", async () => {
  const prompt = openPrompt({ title: "RENAME SESSION", initialValue: "old", width: 52 });

  prompt.component.handleInput("\x1b");

  assert.equal(await prompt.result, undefined);
});

test("keeps every row padded to the box width", () => {
  const prompt = openPrompt({ title: "RENAME SESSION", initialValue: "x".repeat(200), width: 52 });

  // A value far wider than the box must not break the frame.
  for (const line of prompt.component.render(52)) {
    assert.equal(visibleWidth(line), 52);
  }
  prompt.component.handleInput("\x1b");
});
