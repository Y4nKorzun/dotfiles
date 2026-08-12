const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { join } = require("node:path");
const test = require("node:test");

const globalRoot = execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim();
const piAgentRoot = join(globalRoot, "@earendil-works", "pi-coding-agent");
const piPeerRoot = join(piAgentRoot, "node_modules");
const createJiti = require(join(piPeerRoot, "jiti", "lib", "jiti.cjs"));
const jiti = createJiti(__filename);

// motions.ts depends on nothing but strings, so it loads without any Pi stubs.
const { isAtWordEnd, wordForwardTarget } = jiti(
  join(__dirname, "..", "extensions", "modal-editor", "motions.ts"),
);

test("w skips the current chunk and the whitespace after it", () => {
  assert.equal(wordForwardTarget("one two", 0), 4);
  assert.equal(wordForwardTarget("one two", 1), 4);
  assert.equal(wordForwardTarget("a   b", 1), 4);
});

test("w treats punctuation as its own chunk", () => {
  assert.equal(wordForwardTarget("foo.bar", 0), 3);
  assert.equal(wordForwardTarget("foo.bar", 3), 4);
});

test("w reports no movement at end of line so the caller can wrap", () => {
  assert.equal(wordForwardTarget("one two", 7), 7);
  assert.equal(wordForwardTarget("", 0), 0);
});

test("w uses Unicode word classes, not ASCII", () => {
  assert.equal(wordForwardTarget("привет мир", 0), 7);
});

test("e detects the last character of a word", () => {
  assert.equal(isAtWordEnd("one two", 2), true);
  assert.equal(isAtWordEnd("one", 2), true);
  assert.equal(isAtWordEnd("one two", 1), false);
  assert.equal(isAtWordEnd("one two", 3), false);
});
