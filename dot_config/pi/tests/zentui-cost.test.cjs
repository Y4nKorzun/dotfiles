const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { readFileSync } = require("node:fs");
const { dirname, join } = require("node:path");
const { pathToFileURL } = require("node:url");
const test = require("node:test");

const configRoot = dirname(__dirname);
const globalRoot = execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim();
const piAgentRoot = join(globalRoot, "@earendil-works", "pi-coding-agent");
const piPeerRoot = join(piAgentRoot, "node_modules");
const piAiRoot = join(piPeerRoot, "@earendil-works", "pi-ai", "dist");
const zentuiRoot = join(configRoot, "npm", "node_modules", "pi-zentui", "extensions", "zentui");
const createJiti = require(join(piPeerRoot, "jiti", "lib", "jiti.cjs"));
const jiti = createJiti(__filename, {
  alias: {
    "@earendil-works/pi-coding-agent": join(piAgentRoot, "dist", "index.js"),
    "@earendil-works/pi-tui": join(piPeerRoot, "@earendil-works", "pi-tui", "dist", "index.js"),
  },
});
const { createInitialState, syncState } = jiti(join(zentuiRoot, "state.ts"));
const { resolveFooterTelemetry } = jiti(join(zentuiRoot, "telemetry.ts"));

function usageWithZeroCost() {
  return {
    input: 100000,
    output: 10000,
    cacheRead: 0,
    cacheWrite: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  };
}

function contextFor(model, usage, usingOAuth) {
  return {
    cwd: "/tmp/project",
    model,
    modelRegistry: { isUsingOAuth: () => usingOAuth },
    sessionManager: {
      getEntries: () => [
        {
          type: "message",
          id: "assistant-1",
          message: { role: "assistant", usage },
        },
      ],
    },
    getContextUsage: () => ({ percent: 40, contextWindow: model.contextWindow }),
  };
}

async function loadCatalog(filename) {
  const module = await import(pathToFileURL(join(piAiRoot, "providers", filename)).href);
  const catalog = Object.values(module).find(
    (candidate) =>
      candidate &&
      typeof candidate === "object" &&
      Object.values(candidate).some((model) => model?.provider && model?.cost),
  );
  assert.ok(catalog, `No model catalog exported by ${filename}`);
  return catalog;
}

function firstPricedModel(catalog, predicate = () => true) {
  const model = Object.values(catalog).find(
    (candidate) =>
      predicate(candidate) &&
      [candidate.cost.input, candidate.cost.output].some((rate) => Number(rate) > 0),
  );
  assert.ok(model, "No priced model found");
  return model;
}

test("renders cost for supported auth and provider paths", async (t) => {
  const { calculateCost } = await import(pathToFileURL(join(piAiRoot, "models.js")).href);
  const cases = [
    ["ChatGPT OAuth", "openai-codex.models.js", true],
    ["Claude OAuth", "anthropic.models.js", true, (model) => model.id.startsWith("claude-")],
    ["OpenRouter token", "openrouter.models.js", false],
    ["OpenAI API token", "openai.models.js", false],
  ];

  for (const [label, filename, usingOAuth, predicate] of cases) {
    await t.test(label, async () => {
      const model = firstPricedModel(await loadCatalog(filename), predicate);
      const usage = usageWithZeroCost();
      calculateCost(model, usage);
      const context = contextFor(model, usage, usingOAuth);
      const telemetry = resolveFooterTelemetry(context, { settingsManager: {} });
      const state = createInitialState({});
      syncState(state, context, "", telemetry);

      assert.ok(usage.cost.total > 0);
      assert.notEqual(state.costLabel, "$0.000");
      assert.equal(state.subscription, usingOAuth);
    });
  }
});

test("keeps cost visible without pinning pi-zentui", () => {
  const config = JSON.parse(readFileSync(join(configRoot, "zentui.json"), "utf8"));
  const settings = JSON.parse(readFileSync(join(configRoot, "settings.json"), "utf8"));
  const starship = config.components.footer.styles.starship;

  assert.equal(starship.segments.cost, true);
  assert.match(starship.compactFormat, /\$cost\b/);
  assert.match(starship.compactFormat, /\$subscription\b/);
  assert.ok(settings.packages.includes("npm:pi-zentui"));
  assert.ok(!settings.packages.some((entry) => entry.startsWith("npm:pi-zentui@")));
});
