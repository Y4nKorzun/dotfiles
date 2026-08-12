const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { join } = require("node:path");
const { pathToFileURL } = require("node:url");
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
const clearModule = jiti(join(configRoot, "extensions", "clear.ts"));

function registerClear() {
  const commands = new Map();
  clearModule.default({
    on() {},
    registerCommand(name, command) {
      commands.set(name, command);
    },
  });
  return commands;
}

function contextWith(result) {
  const calls = { newSession: 0, notices: [] };
  const ctx = {
    newSession: async () => {
      calls.newSession++;
      return result;
    },
    ui: {
      notify: (message) => calls.notices.push(message),
    },
  };
  return { ctx, calls };
}

test("registers /clear with a description", () => {
  const commands = registerClear();
  assert.equal(commands.has("clear"), true);
  assert.match(commands.get("clear").description, /new session/i);
});

test("/clear starts a new session and confirms", async () => {
  const commands = registerClear();
  const { ctx, calls } = contextWith({ cancelled: false });

  await commands.get("clear").handler("", ctx);

  assert.equal(calls.newSession, 1);
  assert.deepEqual(calls.notices, ["New session started"]);
});

test("/clear stays quiet when the session switch is cancelled", async () => {
  const commands = registerClear();
  const { ctx, calls } = contextWith({ cancelled: true });

  await commands.get("clear").handler("", ctx);

  assert.equal(calls.newSession, 1);
  assert.deepEqual(calls.notices, []);
});

test("/new remains Pi's built-in, so /clear must not shadow it", async () => {
  const { BUILTIN_SLASH_COMMANDS } = await import(
    pathToFileURL(join(piAgentRoot, "dist", "core", "slash-commands.js")).href
  );
  const names = BUILTIN_SLASH_COMMANDS.map((command) => command.name);

  assert.ok(names.includes("new"));
  // A built-in of the same name would take precedence over the registration.
  assert.equal(names.includes("clear"), false);
});
