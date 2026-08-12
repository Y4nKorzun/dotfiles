const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { pathToFileURL } = require("node:url");
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
const { KeybindingsManager } = jiti(join(piAgentRoot, "dist", "core", "keybindings.js"));
const { InteractiveMode } = jiti(join(piAgentRoot, "dist", "index.js"));
const { TuiAltScreen } = jiti(join(piPeerRoot, "@earendil-works", "pi-tui", "dist", "index.js"));
const modalEditorModule = jiti(join(__dirname, "..", "extensions", "modal-editor", "index.ts"));
const { ModalEditor } = modalEditorModule;

const identity = (text) => text;
const theme = {
  borderColor: identity,
  selectList: {
    selectedPrefix: identity,
    selectedText: identity,
    description: identity,
    scrollInfo: identity,
    noMatch: identity,
  },
};

function createEditor(overrides = {}) {
  return new ModalEditor(
    { requestRender() {}, terminal: { rows: 24 }, ...overrides },
    theme,
    new KeybindingsManager(),
  );
}

test("switches between insert and normal modes", () => {
  const editor = createEditor();
  let interrupted = false;
  editor.onEscape = () => {
    interrupted = true;
  };
  editor.handleInput("a");
  editor.handleInput("\x1b");
  editor.handleInput("z");
  assert.equal(editor.getText(), "a");
  assert.match(editor.render(80).at(-1), / NORMAL $/);
  assert.equal(interrupted, false);

  editor.handleInput("\x1b");
  assert.equal(interrupted, true);

  editor.handleInput("i");
  editor.handleInput("b");
  assert.equal(editor.getText(), "ab");
  assert.match(editor.render(80).at(-1), / INSERT $/);
});

test("Ctrl+r asks the host to rename, leaving the draft untouched", () => {
  const editor = createEditor();
  let renames = 0;
  editor.onRenameSession = () => renames++;

  editor.setText("draft");
  editor.handleInput("\x12");

  assert.equal(renames, 1);
  // The prompt is no longer hijacked with a `/name` command.
  assert.equal(editor.getText(), "draft");
});

test("Ctrl+r is left unclaimed when no rename handler is wired", () => {
  const editor = createEditor();
  editor.setText("draft");
  editor.handleInput("\x12");
  assert.equal(editor.getText(), "draft");
});

test("Ctrl+Shift+r reloads Pi", () => {
  const editor = createEditor();
  let submitted;
  editor.onSubmit = (text) => {
    submitted = text;
  };

  editor.setText("draft");
  editor.handleInput("\x1b[114;6u");

  assert.equal(submitted, "/reload");
  assert.equal(editor.getText(), "");
  assert.match(editor.render(80).at(-1), / INSERT $/);
});

test("supports basic Neovim movement and editing", () => {
  const editor = createEditor();
  editor.setText("abc");
  editor.handleInput("\x1b");
  editor.handleInput("h");
  editor.handleInput("x");
  assert.equal(editor.getText(), "ab");

  editor.handleInput("0");
  editor.handleInput("a");
  editor.handleInput("X");
  assert.equal(editor.getText(), "aXb");
});

test("supports Neovim word, line, open-line, change, and undo commands", () => {
  const editor = createEditor();
  editor.setText("one two");
  editor.handleInput("\x1b");
  editor.handleInput("0");
  editor.handleInput("w");
  editor.handleInput("x");
  assert.equal(editor.getText(), "one wo");
  editor.handleInput("u");
  assert.equal(editor.getText(), "one two");
  editor.handleInput("0");
  editor.handleInput("e");
  editor.handleInput("x");
  assert.equal(editor.getText(), "on two");
  editor.handleInput("u");

  editor.handleInput("I");
  editor.handleInput(">");
  editor.handleInput("\x1b");
  editor.handleInput("A");
  editor.handleInput("<");
  editor.handleInput("\x1b");
  editor.handleInput("o");
  editor.handleInput("next");
  assert.equal(editor.getText(), ">one two<\nnext");

  const above = createEditor();
  above.setText("base");
  above.handleInput("\x1b");
  above.handleInput("O");
  above.handleInput("above");
  assert.equal(above.getText(), "above\nbase");

  const change = createEditor();
  change.setText("abc");
  change.handleInput("\x1b");
  change.handleInput("0");
  change.handleInput("l");
  change.handleInput("C");
  change.handleInput("X");
  assert.equal(change.getText(), "aX");
});

test("deletes the current line with dd as one undoable edit", () => {
  const editor = createEditor();
  editor.setText("one\ntwo\nthree");
  editor.handleInput("\x1b");
  editor.handleInput("\x1b[A");
  editor.handleInput("d");
  editor.handleInput("d");

  assert.equal(editor.getText(), "one\nthree");
  assert.deepEqual(editor.getCursor(), { line: 1, col: 0 });

  editor.handleInput("u");
  assert.equal(editor.getText(), "one\ntwo\nthree");
});

test("Ctrl+r survives a stale extension runtime", async () => {
  let sessionStartHandler;
  let editorFactory;

  modalEditorModule.default({
    on(event, handler) {
      if (event === "session_start") sessionStartHandler = handler;
    },
    registerCommand() {},
    // Pi's action methods throw once the extension has been reloaded.
    getSessionName() {
      throw new Error("Extension runtime is stale");
    },
  });

  await sessionStartHandler(
    {},
    {
      ui: {
        setEditorComponent(factory) {
          editorFactory = factory;
        },
        async custom() {},
      },
    },
  );

  const editor = editorFactory(
    { requestRender() {}, terminal: { rows: 24 } },
    { ...theme, fg: (_color, text) => text },
    new KeybindingsManager(),
  );

  const rejections = [];
  const onRejection = (reason) => rejections.push(reason);
  process.on("unhandledRejection", onRejection);
  try {
    editor.setText("draft");
    // The rename runs detached, so a throw would escape as an unhandled
    // rejection rather than as a failed keystroke.
    editor.handleInput("\x12");
    await new Promise((resolve) => setImmediate(resolve));
  } finally {
    process.off("unhandledRejection", onRejection);
  }

  assert.deepEqual(rejections, []);
  assert.equal(editor.getText(), "draft");
});

test("does not resolve normal-mode keys through Object.prototype", () => {
  const editor = createEditor();
  editor.setText("hello");
  editor.handleInput("\x1b");

  // Looking these up in an object literal would hit Object.prototype and
  // dispatch a function as if it were a key sequence.
  for (const inherited of ["toString", "constructor", "valueOf"]) {
    editor.handleInput(inherited);
  }
  assert.equal(editor.getText(), "hellotoStringconstructorvalueOf");
});

test("uses Neovim transcript navigation only in normal mode", () => {
  assert.equal(typeof TuiAltScreen.prototype.scrollBy, "function");
  assert.equal(typeof TuiAltScreen.prototype.scrollToTop, "function");
  assert.equal(typeof TuiAltScreen.prototype.scrollToBottom, "function");
  const scrolls = [];
  const edges = [];
  const editor = createEditor({
    scrollBy: (lines) => scrolls.push(lines),
    scrollToTop: () => edges.push("top"),
    scrollToBottom: () => edges.push("bottom"),
  });
  editor.handleInput("j");
  assert.equal(editor.getText(), "j");
  assert.deepEqual(scrolls, []);

  editor.handleInput("\x1b");
  editor.handleInput("j");
  editor.handleInput("k");
  editor.handleInput("\x04");
  editor.handleInput("\x15");
  editor.handleInput("g");
  editor.handleInput("g");
  editor.handleInput("G");

  assert.deepEqual(scrolls, [1, -1, 12, -12]);
  assert.deepEqual(edges, ["top", "bottom"]);
});

test("renders /hotkeys and /keymaps in distinct compact overlays", async () => {
  const commands = new Map();
  let sessionStart;
  let editorFactory;
  let overlayOptions;
  let overlayComponent;
  let rendered = [];
  let renderRequests = 0;
  let closed = false;
  modalEditorModule.default({
    on(event, handler) {
      if (event === "session_start") sessionStart = handler;
    },
    registerCommand(name, command) {
      commands.set(name, command);
    },
  });

  const context = {
    ui: {
      setEditorComponent(factory) {
        editorFactory = factory;
      },
      async custom(factory, options) {
        overlayOptions = options;
        overlayComponent = factory(
          { requestRender: () => renderRequests++ },
          { fg: (_color, text) => text },
          {},
          () => {
            closed = true;
          },
        );
        rendered = overlayComponent.render(72);
      },
    },
  };
  await sessionStart({}, context);
  const editor = editorFactory(
    { requestRender() {}, terminal: { rows: 24 } },
    { ...theme, fg: (_color, text) => text },
    new KeybindingsManager(),
  );
  let submitted;
  editor.onSubmit = (text) => {
    submitted = text;
  };
  assert.equal(commands.has("keymaps"), true);
  editor.setText("/hotkeys");
  editor.handleInput("\x1b[13u");
  await Promise.resolve();

  assert.equal(editor.getText(), "");
  assert.equal(submitted, undefined);
  assert.equal(overlayOptions.overlay, true);
  assert.equal(overlayOptions.overlayOptions.anchor, "center");
  assert.equal(overlayOptions.overlayOptions.width, 80);
  assert.equal(overlayOptions.overlayOptions.maxHeight, 16);
  assert.ok(rendered.length <= 16);
  const hotkeysRendered = rendered.join("\n");
  assert.match(hotkeysRendered, /PI HOTKEYS/);
  assert.match(hotkeysRendered, /Submit input/);
  assert.match(hotkeysRendered, /Rename current session/);
  assert.match(hotkeysRendered, /Reload Pi/);
  assert.doesNotMatch(hotkeysRendered, /dd/);
  overlayComponent.handleInput("j");
  assert.notEqual(overlayComponent.render(72).join("\n"), hotkeysRendered);
  assert.equal(renderRequests, 1);
  overlayComponent.handleInput("q");
  assert.equal(closed, true);

  editor.setText("/help");
  editor.handleInput("\x1b[13u");
  assert.equal(submitted, "/help");

  overlayOptions = undefined;
  rendered = [];
  await commands.get("keymaps").handler("", context);
  assert.equal(overlayOptions.overlay, true);
  assert.equal(overlayOptions.overlayOptions.width, 60);
  const keymapsRendered = rendered.join("\n");
  assert.match(keymapsRendered, /NEOVIM KEYMAPS/);
  assert.match(keymapsRendered, /j\/k/);
  assert.match(keymapsRendered, /dd/);
  assert.doesNotMatch(keymapsRendered, /Submit input/);
  assert.notEqual(keymapsRendered, hotkeysRendered);
  overlayComponent.handleInput("q");
});

test("is discovered by Pi with the /keymaps alias", async () => {
  const { discoverAndLoadExtensions } = await import(
    pathToFileURL(join(piAgentRoot, "dist", "core", "extensions", "loader.js")).href
  );
  const result = await discoverAndLoadExtensions([], "/tmp", join(__dirname, ".."));
  const extension = result.extensions.find((candidate) =>
    candidate.path.endsWith("/modal-editor/index.ts"),
  );

  assert.deepEqual(result.errors, []);
  assert.ok(extension);
  assert.ok(extension.commands.has("keymaps"));
  assert.ok(extension.handlers.has("session_start"));
  assert.equal(extension.handlers.has("session_shutdown"), false);
});

test("does not compete with Zentui's editor component", () => {
  const config = JSON.parse(readFileSync(join(__dirname, "..", "zentui.json"), "utf8"));
  assert.equal(config.components.editor.enabled, false);
});

test("renders built-in Pi selectors as centered modals", () => {
  modalEditorModule.default({
    on() {},
    registerCommand() {},
  });

  const inputs = [];
  let reloads = 0;
  const editor = {
    focused: false,
    handleInput() {},
    invalidate() {},
    reloadPi() {
      reloads++;
    },
    render: () => [],
  };
  const focus = {
    focused: false,
    handleInput: (data) => inputs.push(data),
    invalidate() {},
    render: () => [],
  };
  const component = { invalidate() {}, render: () => ["TREE"] };
  let hidden = false;
  let overlay;
  let focused;
  let renderRequests = 0;
  const host = {
    editor,
    activeSelectorToken: undefined,
    activeSelectorDispose: undefined,
    disposeActiveSelector() {
      const dispose = this.activeSelectorDispose;
      this.activeSelectorToken = undefined;
      this.activeSelectorDispose = undefined;
      dispose?.();
    },
    ui: {
      terminal: { rows: 24 },
      requestRender() {
        renderRequests++;
      },
      setFocus(target) {
        focused = target;
      },
      showOverlay(modal, options) {
        overlay = { modal, options };
        return {
          hide() {
            hidden = true;
            focused = editor;
          },
        };
      },
    },
  };

  InteractiveMode.prototype.showSelector.call(host, () => ({ component, focus }));

  assert.deepEqual(overlay.options, {
    anchor: "center",
    width: "80%",
    maxHeight: "80%",
    margin: 2,
  });
  assert.match(overlay.modal.render(100).at(-1), /NORMAL · i or \/ search/);
  overlay.modal.handleInput("j");
  overlay.modal.handleInput("k");
  overlay.modal.handleInput("h");
  overlay.modal.handleInput("l");
  overlay.modal.handleInput("\x04");
  overlay.modal.handleInput("\x15");
  overlay.modal.handleInput("\x12");
  overlay.modal.handleInput("\x1b[114;6u");
  overlay.modal.handleInput("x");
  assert.deepEqual(inputs, [
    "\x1b[B",
    "\x1b[A",
    "\x1b[1;3D",
    "\x1b[1;3C",
    "\x1b[6~",
    "\x1b[5~",
    "\x12",
  ]);
  assert.equal(reloads, 1);

  overlay.modal.handleInput("/");
  assert.match(overlay.modal.render(100).at(-1), /SEARCH · Esc normal/);
  overlay.modal.handleInput("hjkl");
  overlay.modal.handleInput("\x1b");
  assert.match(overlay.modal.render(100).at(-1), /NORMAL · i or \/ search/);
  overlay.modal.handleInput("\x1b");
  assert.deepEqual(inputs.slice(-2), ["hjkl", "\x1b"]);
  assert.equal(renderRequests, 2);

  host.activeSelectorDispose();
  assert.equal(hidden, true);
  assert.equal(focused, editor);
});
